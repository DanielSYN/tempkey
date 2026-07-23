# Tempkey

Timed access for contractors and freelancers. A business owner connects Slack, Google Drive, Trello, and Notion, adds a contractor with an end date, and Tempkey pulls that person's access automatically when the contract ends.

> **Status:** shelved side project, not actively maintained. Live demo (may go offline at any time): https://tempkey-psi.vercel.app

## How it works

- A business owner signs up and connects the tools their business uses.
- They add a contractor: name, email, which tools/scopes they need, and an end date.
- A scheduled job checks for expired contractors and revokes their access on every connected platform, logging what happened.
- The dashboard shows active contractors, days remaining, and a revocation history.

## Important: revocation isn't automatable everywhere

Before building this, we checked what each platform's public API actually allows a third-party app to do on realistic (non-Enterprise) plan tiers. The honest answer is mixed:

| Platform | Automated revocation? | What actually happens |
|---|---|---|
| **Trello** | ✅ Yes, all plan tiers | Removed from every board/Workspace via the legacy key+token API |
| **Google Drive** | ✅ Yes, all account types | Per-file/folder permission removed via `permissions.delete` |
| **Slack** | ⚠️ Partial, all plan tiers | Kicked from every channel (`conversations.kick`); full account deactivation (`admin.users.remove`) is Enterprise Grid only, so a workspace seat/login isn't revoked automatically |
| **Notion** | ❌ No | Notion's public API has no member/guest removal endpoint (SCIM deprovisioning exists but is Enterprise-only). Tempkey shows which pages a contractor had access to and gives the owner a manual checklist to work through in Notion's own UI |

Don't market this past what's in that table without re-verifying against current platform docs — this is exactly the kind of claim that quietly goes stale.

## Tech stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth (Credentials provider) for business-owner login
- Tailwind CSS
- Deployed on Vercel, database on Neon Postgres (via the Vercel Marketplace integration)

## Setup

Tempkey needs real developer-app credentials from each platform (Slack, Google, Trello, Notion). These have to be created by hand through each platform's own developer console — there's no way around that part.

### 1. Clone and install

```bash
git clone <this-repo-url>
cd tempkey
pnpm install
cp .env.example .env
```

Fill in `.env`:
- `DATABASE_URL` — a local or hosted Postgres connection string
- `DIRECT_URL` — same value as `DATABASE_URL` for a plain Postgres instance; if you're on a pooled/serverless Postgres (Neon, Vercel Postgres), use the provider's *unpooled* connection string here instead (needed for `prisma migrate deploy` to work — pooled connections can't hold the advisory locks migrations need)
- `NEXTAUTH_SECRET` — any random string (`openssl rand -base64 32` works)
- `NEXTAUTH_URL` — `http://localhost:3210` for local dev, or your deployed domain in production
- `CRON_SECRET` — any random string; the production cron endpoint checks this

### 2. Register each platform's app

For every platform below, the redirect URI pattern is `<your-domain>/api/integrations/<platform>/callback`.

- **Slack** — create an app at https://api.slack.com/apps. Under **OAuth & Permissions**, add the redirect URL and, under **Bot Token Scopes**, add: `channels:manage`, `groups:write`, `channels:read`, `groups:read`, `users:read`. Paste `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` into `.env`. Note: adding a redirect URL requires clicking the separate **Save URLs** button, not just "Add".
- **Google** — create an OAuth client at https://console.cloud.google.com (APIs & Services → Credentials), after enabling the **Google Drive API** (APIs & Services → Library). Add the redirect URI to the OAuth client. On the **OAuth consent screen**, manually add the scope `https://www.googleapis.com/auth/drive` (the full URL — abbreviated forms aren't valid input) plus `https://www.googleapis.com/auth/userinfo.email`. Since `drive` is a restricted scope and the app starts in Testing mode, add your own Google account under **Audience → Test users** or the OAuth flow will be blocked as unverified. Paste `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Trello** — get an API key at https://trello.com/power-ups/admin (requires belonging to a Trello Workspace, not just a Board). On the key's settings page (`trello.com/app-key`), add every domain you'll use (including production) to **Allowed Origins**, or Trello will reject the OAuth `return_url`. Paste `TRELLO_API_KEY` (and mirror it into `NEXT_PUBLIC_TRELLO_API_KEY` — Trello's token-authorize flow happens client-side). No app-level secret needed; user tokens are issued per-connection.
- **Notion** — create a **Public** integration (not Internal — Internal integrations don't expose OAuth credentials or a redirect URI field) at https://www.notion.so/my-integrations. Set the redirect URI, and under Capabilities check only **Read content** and **Read user information (without email)**. Grab the **OAuth client ID/secret** from the Distribution tab. Paste `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`.

### 3. Database and local run

```bash
pnpm prisma migrate dev
pnpm dev
```

Runs at `http://localhost:3210`.

### 4. Deploying (Vercel + Neon, as the live demo is set up)

```bash
vercel link
vercel integration add neon    # provisions a Postgres and injects DATABASE_URL/DATABASE_URL_UNPOOLED etc.
```

Map Neon's `DATABASE_URL_UNPOOLED` into `DIRECT_URL` as its own env var (Vercel doesn't do this automatically), set `NEXTAUTH_URL`/`NEXTAUTH_SECRET`/`CRON_SECRET` and the four platform credentials as Vercel env vars, then:

```bash
prisma migrate deploy   # run once against the production DATABASE_URL/DIRECT_URL
vercel deploy --prod
```

Two Vercel CLI quirks worth knowing:
- Env vars added via `vercel env add` default to "sensitive" on Production/Preview, which silently blocks `vercel env pull` from ever reading them back. Pass `--no-sensitive` for anything you might need to pull locally later (e.g. to run a migration from your machine).
- `vercel env add <name> preview` (without a specific git branch) can loop on a "which branch?" prompt even in non-interactive mode — if you hit that, add Preview env vars from the dashboard instead.

The `build` script runs `prisma generate && next build` (plus a `postinstall: prisma generate`) — don't drop that, a fresh clone has no generated Prisma client on disk yet.

## Revocation scheduler

`lib/revocation.ts` (`checkAndRevokeExpired`) finds contractors past their `endDate`, dispatches each unrevoked grant to the right platform module's `revokeGrant`, logs a `RevocationLog` row per attempt, and flips contractor status to `EXPIRED` (clock ran out) then `REVOKED` (once every automatable grant is actually revoked).

- **Locally:** `pnpm revoke:check` runs `checkAndRevokeExpired()` directly and prints the result JSON — no server needed.
- **In production:** an external scheduler (e.g. Vercel Cron) hits `POST /api/cron/revoke` (also responds to `GET`) with `Authorization: Bearer <CRON_SECRET>` on an interval. Requests missing or mismatching `CRON_SECRET` get a 401.
- A contractor with an outstanding Notion grant stays at `EXPIRED`, never `REVOKED`, until the owner completes that step by hand — Notion has no revoke API (see the table above).

## License

No license file yet — treat as all-rights-reserved / ask before reusing.
