// Slack integration: OAuth connect flow + channel-level revocation.
//
// IMPORTANT: full account deactivation (`admin.users.remove`) is Enterprise
// Grid only and NOT usable for our target customer. We instead kick the
// contractor out of every Slack channel we know they had access to via
// `conversations.kick`, which works on all plan tiers. See CLAUDE.md for the
// full research writeup.

const SLACK_OAUTH_SCOPES = [
  "channels:manage",
  "groups:write",
  "channels:read",
  "groups:read",
  "users:read",
].join(",");

const SLACK_API_BASE = "https://slack.com/api";

function getRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/integrations/slack/callback`;
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    scope: SLACK_OAUTH_SCOPES,
    redirect_uri: getRedirectUri(),
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; externalTeamId?: string; meta?: Record<string, unknown> }> {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
    code,
    redirect_uri: getRedirectUri(),
  });

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? res.statusText}`);
  }

  return {
    accessToken: data.access_token,
    externalTeamId: data.team?.id,
    meta: {
      teamName: data.team?.name,
      botUserId: data.bot_user_id,
      scope: data.scope,
    },
  };
}

export async function resolveSlackUserId(accessToken: string, email: string): Promise<string | null> {
  const params = new URLSearchParams({ email });

  const res = await fetch(`${SLACK_API_BASE}/users.lookupByEmail?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  if (!data.ok) {
    // "users_not_found" just means no Slack account for that email -- not an error for us.
    return null;
  }

  return data.user?.id ?? null;
}

// Lets the "add contractor" UI show a checklist of channels to grant access
// to. Uses conversations.list, which only needs the channels:read/groups:read
// scopes we already request.
export async function listChannels(
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const params = new URLSearchParams({
    types: "public_channel,private_channel",
    exclude_archived: "true",
    limit: "200",
  });

  const res = await fetch(`${SLACK_API_BASE}/conversations.list?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(`Slack conversations.list failed: ${data.error ?? res.statusText}`);
  }

  return (data.channels ?? []).map((channel: { id: string; name: string }) => ({
    id: channel.id,
    name: channel.name,
  }));
}

export async function revokeGrant(
  integration: { accessToken: string },
  grant: { scopeRefs: unknown },
  contractorEmail: string
): Promise<{ outcome: "SUCCESS" | "FAILED"; detail?: string }> {
  const scopeRefs = grant.scopeRefs as { channelIds?: string[] } | null;
  const channelIds = scopeRefs?.channelIds ?? [];

  if (channelIds.length === 0) {
    return { outcome: "SUCCESS", detail: "No Slack channels to revoke." };
  }

  const slackUserId = await resolveSlackUserId(integration.accessToken, contractorEmail);

  if (!slackUserId) {
    // No Slack account for this email -- nothing to kick, treat as already revoked.
    return { outcome: "SUCCESS", detail: "Contractor has no Slack account for this email; nothing to revoke." };
  }

  const failures: string[] = [];

  for (const channelId of channelIds) {
    const params = new URLSearchParams({ channel: channelId, user: slackUserId });

    const res = await fetch(`${SLACK_API_BASE}/conversations.kick`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    // "not_in_channel" means the user was already removed/never a member --
    // that's a successful end state for us, not a failure.
    if (!data.ok && data.error !== "not_in_channel") {
      failures.push(`${channelId}: ${data.error ?? "unknown error"}`);
    }
  }

  if (failures.length > 0) {
    return { outcome: "FAILED", detail: `Failed to remove from channels: ${failures.join("; ")}` };
  }

  return { outcome: "SUCCESS" };
}
