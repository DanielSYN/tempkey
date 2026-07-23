// Trello integration: legacy key+token connect flow + Workspace-level revocation.
//
// IMPORTANT: the member-removal endpoint we rely on for full revocation
// (`DELETE /1/organizations/{id}/members/{idMember}/all`) only works with
// Trello's legacy API-key + user-token auth, not modern OAuth2. Trello issues
// the token via a browser redirect to trello.com/1/authorize and returns it
// in the URL fragment (`#token=...`), which never reaches the server -- so
// the connect flow is a client-side page (see
// app/integrations/trello/connect/page.tsx) that reads the fragment and
// POSTs the token to app/api/integrations/trello/callback. See CLAUDE.md for
// the full research writeup.

const TRELLO_API_BASE = "https://api.trello.com/1";

function getApiKey(): string {
  return process.env.TRELLO_API_KEY ?? "";
}

export function getAuthorizationUrl(returnUrl: string): string {
  const params = new URLSearchParams({
    expiration: "never",
    name: "Tempkey",
    scope: "read,write,account",
    response_type: "token",
    key: getApiKey(),
    return_url: returnUrl,
  });

  return `https://trello.com/1/authorize?${params.toString()}`;
}

export async function getWorkspaces(
  accessToken: string
): Promise<Array<{ id: string; displayName: string }>> {
  const params = new URLSearchParams({
    key: getApiKey(),
    token: accessToken,
    fields: "displayName",
  });

  const res = await fetch(`${TRELLO_API_BASE}/members/me/organizations?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Failed to list Trello workspaces: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Array<{ id: string; displayName: string }>;

  return data.map((org) => ({ id: org.id, displayName: org.displayName }));
}

export async function getWorkspaceMembers(
  accessToken: string,
  organizationId: string
): Promise<Array<{ id: string; fullName: string; username: string; email?: string }>> {
  const params = new URLSearchParams({
    key: getApiKey(),
    token: accessToken,
    fields: "fullName,username",
  });

  const res = await fetch(
    `${TRELLO_API_BASE}/organizations/${organizationId}/members?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Failed to list Trello workspace members: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Array<{
    id: string;
    fullName: string;
    username: string;
    email?: string;
  }>;

  return data.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    username: member.username,
    email: member.email,
  }));
}

export async function revokeGrant(
  integration: { accessToken: string; meta?: unknown },
  grant: { scopeRefs: unknown }
): Promise<{ outcome: "SUCCESS" | "FAILED"; detail?: string }> {
  const scopeRefs = grant.scopeRefs as { organizationId?: string; memberId?: string } | null;
  const organizationId = scopeRefs?.organizationId;
  const memberId = scopeRefs?.memberId;

  if (!organizationId || !memberId) {
    return { outcome: "FAILED", detail: "Missing organizationId/memberId on grant scopeRefs." };
  }

  const params = new URLSearchParams({
    key: getApiKey(),
    token: integration.accessToken,
  });

  const res = await fetch(
    `${TRELLO_API_BASE}/organizations/${organizationId}/members/${memberId}/all?${params.toString()}`,
    { method: "DELETE" }
  );

  if (res.ok) {
    return { outcome: "SUCCESS" };
  }

  // Member already not found on the Workspace means the end state we want
  // already holds -- treat as a successful revocation, not a failure.
  if (res.status === 404) {
    return { outcome: "SUCCESS", detail: "Member was already removed from the Workspace." };
  }

  const body = await res.text().catch(() => "");

  return {
    outcome: "FAILED",
    detail: `Trello member removal failed: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
  };
}
