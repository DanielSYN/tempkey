// Google Drive integration: OAuth connect flow + per-file/folder permission
// revocation.
//
// IMPORTANT: unlike Slack/Trello, there is no "kick from everything" call.
// Revocation means walking every file/folder the contractor was granted on
// (grant.scopeRefs.fileIds) and deleting their specific permission via
// `permissions.list` + `permissions.delete`. This works for personal Gmail
// accounts and Workspace accounts alike -- no domain admin needed, just OAuth
// as the file owner. See CLAUDE.md for the full research writeup.
//
// We request the broad `drive` scope (not the narrower `drive.file`) because
// we need to reach files that were shared with the contractor *before*
// Tempkey was installed, not just files picked through a Google Picker at
// connect-time. `access_type=offline` + `prompt=consent` get us a refresh
// token, since the revocation job may run long after the access token
// (~1hr lifetime) was issued.

const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

function getRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`;
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_OAUTH_SCOPES,
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; refreshToken?: string; meta?: Record<string, unknown> }> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Google OAuth exchange failed: ${data.error ?? res.statusText}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    meta: {
      scope: data.scope,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
    },
  };
}

// Access tokens are short-lived (~1hr). The revocation job runs on whatever
// schedule the cron fires, which is very likely after the token from connect
// (or the last refresh) has expired -- so revokeGrant always needs to be
// ready to mint a fresh one from the refresh token.
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${data.error ?? res.statusText}`);
  }

  return data.access_token;
}

// Lets the "add contractor" UI show a checklist of files/folders to grant
// access to. Lists files owned by (or shared with, and shareable by) the
// connected account so the owner can pick which ones the contractor needs.
export async function listFiles(
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const params = new URLSearchParams({
    q: "trashed = false",
    fields: "files(id,name,mimeType)",
    pageSize: "100",
    orderBy: "modifiedTime desc",
  });

  const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive files.list failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    files?: Array<{ id: string; name: string; mimeType: string }>;
  };

  return data.files ?? [];
}

function parseFileIds(scopeRefs: unknown): string[] | null {
  const fileIds = (scopeRefs as { fileIds?: unknown } | null)?.fileIds;
  if (!Array.isArray(fileIds) || !fileIds.every((id) => typeof id === "string")) {
    return null;
  }
  return fileIds;
}

export async function revokeGrant(
  integration: { accessToken: string; refreshToken?: string | null },
  grant: { scopeRefs: unknown },
  contractorEmail: string
): Promise<{ outcome: "SUCCESS" | "FAILED"; detail?: string }> {
  const fileIds = parseFileIds(grant.scopeRefs);

  if (fileIds === null) {
    return { outcome: "FAILED", detail: "Missing fileIds on grant scopeRefs." };
  }

  if (fileIds.length === 0) {
    return { outcome: "SUCCESS", detail: "No Google Drive files to revoke." };
  }

  const targetEmail = contractorEmail.toLowerCase();

  // Shared across the whole run so we refresh the access token at most once,
  // the first time we hit a 401, rather than once per file.
  let accessToken = integration.accessToken;
  let hasRefreshed = false;

  const authedFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const withAuth = (token: string): RequestInit => ({
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });

    let res = await fetch(url, withAuth(accessToken));

    if (res.status === 401 && !hasRefreshed && integration.refreshToken) {
      hasRefreshed = true;
      accessToken = await refreshAccessToken(integration.refreshToken);
      res = await fetch(url, withAuth(accessToken));
    }

    return res;
  };

  let removedCount = 0;
  let alreadyAbsentCount = 0;
  const failures: string[] = [];

  for (const fileId of fileIds) {
    try {
      const listRes = await authedFetch(
        `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,emailAddress)`
      );

      if (!listRes.ok) {
        failures.push(`${fileId}: failed to list permissions (${listRes.status})`);
        continue;
      }

      const listData = (await listRes.json()) as {
        permissions?: Array<{ id: string; emailAddress?: string }>;
      };

      const match = (listData.permissions ?? []).find(
        (permission) => permission.emailAddress?.toLowerCase() === targetEmail
      );

      if (!match) {
        // No permission for this contractor on this file -- the end state we
        // want already holds, not a failure.
        alreadyAbsentCount++;
        continue;
      }

      const deleteRes = await authedFetch(
        `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(match.id)}`,
        { method: "DELETE" }
      );

      if (deleteRes.ok || deleteRes.status === 404) {
        removedCount++;
      } else {
        failures.push(`${fileId}: failed to delete permission (${deleteRes.status})`);
      }
    } catch (err) {
      failures.push(`${fileId}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  if (failures.length > 0) {
    return {
      outcome: "FAILED",
      detail: `Revoked ${removedCount + alreadyAbsentCount}/${fileIds.length} files; failures: ${failures.join("; ")}`,
    };
  }

  return {
    outcome: "SUCCESS",
    detail: `Removed access on ${removedCount} file(s); already absent on ${alreadyAbsentCount} file(s).`,
  };
}
