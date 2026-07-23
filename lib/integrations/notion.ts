// Notion integration: OAuth connect flow + manual-fallback "revocation."
//
// IMPORTANT: Notion's public REST API has no endpoint to remove a member/guest
// from a workspace or strip page-level sharing from a specific user (SCIM
// deprovisioning exists but is Enterprise-plan only and requires the customer
// to hand us a token they generate themselves -- out of scope for MVP). So
// this module never claims to revoke anything in Notion. It connects via
// OAuth so we can show which pages a contractor was invited to (context /
// audit only), and produces a manual checklist for the business owner to
// complete by hand in Notion's own UI. See CLAUDE.md for the full writeup.

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/integrations/notion/callback`;
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    response_type: "code",
    owner: "user",
    state,
  });

  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; meta?: Record<string, unknown> }> {
  const basicAuth = Buffer.from(
    `${process.env.NOTION_CLIENT_ID ?? ""}:${process.env.NOTION_CLIENT_SECRET ?? ""}`
  ).toString("base64");

  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Notion OAuth exchange failed: ${data.error ?? res.statusText}`);
  }

  return {
    accessToken: data.access_token,
    meta: {
      workspaceName: data.workspace_name,
      workspaceId: data.workspace_id,
      botId: data.bot_id,
    },
  };
}

// Best-effort title extraction. Pages keep their title in a "title"-type
// property (property name varies); databases keep it in a top-level `title`
// rich-text array. Falls back to "Untitled" if neither is present/parseable.
function extractTitle(result: Record<string, unknown>): string {
  if (result.object === "database") {
    const title = result.title as Array<{ plain_text?: string }> | undefined;
    const text = title?.map((t) => t.plain_text ?? "").join("") ?? "";
    return text || "Untitled";
  }

  const properties = result.properties as Record<string, { type?: string; title?: Array<{ plain_text?: string }> }> | undefined;
  if (properties) {
    for (const prop of Object.values(properties)) {
      if (prop?.type === "title" && Array.isArray(prop.title)) {
        const text = prop.title.map((t) => t.plain_text ?? "").join("");
        if (text) return text;
      }
    }
  }

  return "Untitled";
}

export async function listSharedPages(
  accessToken: string
): Promise<Array<{ id: string; title: string; url: string }>> {
  const res = await fetch(`${NOTION_API_BASE}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    // Empty body -- no filter -- returns every page/database this
    // integration has been shared on, which is exactly the "what did this
    // contractor's connection touch" context we want.
    body: JSON.stringify({}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Notion search failed: ${data.message ?? res.statusText}`);
  }

  const results = Array.isArray(data.results) ? (data.results as Record<string, unknown>[]) : [];

  return results.map((result) => ({
    id: String(result.id ?? ""),
    title: extractTitle(result),
    url: typeof result.url === "string" ? result.url : "",
  }));
}

// Pure function -- no API call. Notion gives us no way to remove someone
// automatically, so the "revocation" product surface for this platform is a
// checklist a human works through by hand.
export function buildManualRevocationChecklist(
  pages: Array<{ id: string; title: string; url: string }>,
  contractorName: string
): { summary: string; items: Array<{ label: string; url: string }> } {
  return {
    summary: `Notion doesn't allow apps to remove people automatically — remove ${contractorName} from these pages by hand:`,
    items: pages.map((page) => ({ label: page.title, url: page.url })),
  };
}

// Never actually calls Notion to revoke anything -- it can't. This exists so
// the revocation scheduler can treat Notion grants the same shape as every
// other platform's revokeGrant while still surfacing that a human is needed.
export async function revokeGrant(
  _integration: unknown,
  grant: { scopeRefs: unknown },
  contractorName: string
): Promise<{ outcome: "MANUAL_PENDING"; detail: string }> {
  const scopeRefs = grant.scopeRefs as { pageIds?: string[]; pageTitles?: string[] } | null;
  const pageIds = scopeRefs?.pageIds ?? [];
  const pageTitles = scopeRefs?.pageTitles ?? [];

  if (pageIds.length === 0) {
    return {
      outcome: "MANUAL_PENDING",
      detail: `Notion doesn't allow apps to remove people automatically. No specific pages were on record for ${contractorName} -- check Notion's workspace members list directly and remove them by hand.`,
    };
  }

  const pages = pageIds.map((id, i) => ({
    id,
    title: pageTitles[i] ?? "Untitled",
    url: `https://notion.so/${id.replace(/-/g, "")}`,
  }));

  const checklist = buildManualRevocationChecklist(pages, contractorName);
  const itemList = checklist.items.map((item) => `${item.label} (${item.url})`).join("; ");

  return {
    outcome: "MANUAL_PENDING",
    detail: `${checklist.summary} ${itemList}`,
  };
}
