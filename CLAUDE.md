# Tempkey

Timed access for contractors and freelancers. A business owner connects Slack, Google Drive, Trello, and Notion, adds a contractor with an end date, and Tempkey pulls that person's access automatically when the contract ends.

This project is unrelated to the parent `agent-flow` repo it lives inside — it just uses this directory as a workspace. Do not touch files outside `tempkey/`.

## Status

Deployed to production on Vercel at **https://tempkey-psi.vercel.app** (project `danielbuilds/tempkey`, linked via `.vercel/project.json`), backed by a Neon Postgres provisioned through the Vercel integration (`neon-cerise-ball`). Local dev against a separate local Postgres instance still works and is unaffected — the two databases are independent (production's Neon DB is empty aside from real signups; local stays the disposable one from the winget install). **All four platform integrations are registered and verified end-to-end in production** — OAuth registration (the human-only part, see "Setup" below for why) is complete.

**OAuth registration progress (completed 2026-07-23):**
- ✅ **Trello** — done and verified. API key is live (`TRELLO_API_KEY` / `NEXT_PUBLIC_TRELLO_API_KEY`), user completed the real `trello.com/1/authorize` flow, and a `TRELLO` row exists in the `Integration` table for their account. Gotcha: the API key's **"Allowed Origins"** setting (on `trello.com/app-key`) originally only listed `http://localhost:3210` — needs the production origin `https://tempkey-psi.vercel.app` added too, or the production OAuth flow will get rejected. Confirm this was added before relying on Trello in production.
- ✅ **Slack** — done and verified end-to-end in production. Redirect URL `https://tempkey-psi.vercel.app/api/integrations/slack/callback` registered under **Bot Token Scopes**: `channels:manage`, `groups:write`, `channels:read`, `groups:read`, `users:read`. Gotcha hit: adding a redirect URL in the Slack app dashboard requires clicking the separate **Save URLs** button — clicking just "Add" doesn't persist it, which caused a `redirect_uri did not match any configured URIs` error on first attempt.
- ✅ **Google** — done and verified end-to-end in production. `lib/integrations/google.ts:19` requests the broad `https://www.googleapis.com/auth/drive` scope (not `drive.file` — this was already the code's decision, not something we chose during setup), so the OAuth consent screen needed that exact scope URL manually added under **Data Access → Add or Remove Scopes → Manually add scopes** (the abbreviated `.../auth/drive` form is documentation shorthand only, not valid literal input — pasting it as-is gets rejected). Because `drive` is a restricted scope and the app is unverified/in Testing, the connecting Google account also had to be added under **Audience → Test users** first, or the flow fails with "Access blocked: app has not completed verification."
- ✅ **Notion** — done and verified end-to-end in production. Used the OAuth client ID/secret from the integration's Distribution tab (not an Internal Integration Secret/access token — the code does a real OAuth redirect flow via `lib/integrations/notion.ts`, needed since any business owner has to be able to connect their own workspace). Connecting a workspace prompts the user to individually select which pages to share — that's inherent to Notion's page-sharing permission model, not a bug or misconfiguration; matches the product design (read-only "what pages was this contractor invited to" audit view, never automated revocation — see "Critical finding" below).

**Deploy mechanics worth knowing if resuming this:**
- `package.json`'s `build` script now runs `prisma generate && next build` (plus a `postinstall: prisma generate`) — the original `next build`-only script passed locally only because a stale `.prisma/client` already existed from earlier `prisma migrate dev`; it would have failed on Vercel's fresh clone.
- `prisma/schema.prisma` now has `directUrl = env("DIRECT_URL")` alongside `url = env("DATABASE_URL")` — Neon's pooled connection string can't run `prisma migrate deploy` (advisory locks need a direct connection), so `DIRECT_URL` (Neon's `DATABASE_URL_UNPOOLED`) is required. Local `.env` mirrors `DATABASE_URL` into `DIRECT_URL` since local Postgres has no pooler.
- Vercel env vars added manually (`vercel env add`) default to **sensitive**, which blocks `vercel env pull` from ever reading them back (resolves as empty string) — pass `--no-sensitive` for anything you might need to pull later (we used this for `DIRECT_URL`, `NEXTAUTH_URL`, Slack credentials).
- The Preview environment is missing `DIRECT_URL`/`NEXTAUTH_SECRET`/`CRON_SECRET`/Slack credentials — `vercel env add <name> preview` without a specific git branch hit a CLI bug looping on a "which git branch?" prompt non-interactively. Not blocking (Production/Development are fully configured), but backfill via the Vercel dashboard's "copy from Production" if Preview deploys are ever needed.
- Local dev server (port 3210) and Agent Flow's own visualizer (ports 3000/3001, unrelated project, see below) are separate from all of this — check what's actually running with `curl -sf` before assuming, don't assume from this doc alone.

**Nothing left to resume on OAuth setup.** All four platforms are connected and verified in production. Remaining work is product/feature work, not setup — e.g. seeding a real contractor to test the end-to-end revocation scheduler against production data, or hardening things noted in "Deploy mechanics" above (Preview environment env vars, etc.).

## Product shape

- Business owner signs up, connects the tools their business uses.
- They add a contractor: name, email, which tools/scopes they need, and an end date.
- A scheduled job checks for expired contractors and revokes their access on every connected platform, logging what happened.
- Dashboard shows active contractors, days remaining, and a revocation history.

## Critical finding: revocation is NOT uniformly automatable

Before writing integration code we researched what each platform's public API actually allows a third-party app to do on the plan tiers a small business would realistically be on (not Enterprise). This changes the product's honest scope — **"connects to your tools and revokes access automatically" is true for three platforms and not fully true for one.** Do not market or build past what's below without re-verifying against current docs.

### Slack — partially automatable (channel-level, all plan tiers)
- `admin.users.remove` (full account deactivation) exists but is **Enterprise Grid only**. Not usable for our target customer.
- `conversations.kick` (remove a member from a specific channel) works on **all plan tiers** — Free, Pro, Business+. This is what we build.
- Scopes needed: `channels:manage`, `groups:write` (kick), `channels:read`, `groups:read` (enumerate), `users:read` (resolve contractor's Slack user ID).
- Product framing: Tempkey removes the contractor from every Slack channel they had access to. It does not deactivate their Slack account (can't, outside Enterprise Grid) — if the workspace gave them a seat/login, that's a manual step for the owner. Say this honestly in the UI.
- Standard (non-`admin*`) scopes are approvable for a normal OAuth app; no Marketplace listing needed for a private per-workspace install.
- Sources: https://docs.slack.dev/reference/methods/admin.users.remove/, https://docs.slack.dev/reference/methods/conversations.kick/

### Google Drive — automatable (per-file/folder permission removal, all account types)
- Primary mechanism: `permissions.list` then `permissions.delete` on each file/folder the contractor was shared on. Works for **personal Gmail accounts and Workspace accounts alike** — no domain admin needed, just OAuth as the file owner.
- Scope: needs the broad `drive` scope (restricted — annual CASA security assessment required for production) to reach files shared *before* Tempkey was installed. The narrower `drive.file` scope avoids CASA but only covers files the user picks through Google Picker at connect-time — plan onboarding around the Picker if we want to defer the CASA cost.
- Secondary/later feature: Admin SDK Directory API (`users.update` with `suspended: true`) can suspend a full Workspace user account, but only reaches customers who provisioned the contractor as an actual Workspace seat (uncommon for small businesses — most just share a Drive folder to a personal Gmail) and requires either per-customer OAuth consent from a Workspace super admin or domain-wide delegation set up manually in their admin console. Treat as v2, not MVP.
- Sources: https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete, https://developers.google.com/admin-sdk/directory/v1/reference/users/update

### Trello — automatable (all plan tiers, but legacy auth only)
- `DELETE /1/boards/{id}/members/{idMember}` removes a member from one board. `DELETE /1/organizations/{id}/members/{idMember}/all` removes them from a Workspace and every board in it in one call — this is the one we use for full revocation.
- No plan-tier gating on either endpoint.
- **Catch:** these endpoints only work with legacy API-key + user-token auth (OAuth1-style), not OAuth2, and scopes are coarse (`read`/`write`/`account` — no per-board granularity). The token owner needs admin rights on the target board/Workspace. Build the connect flow around Trello's key+token issuance, not a modern OAuth2 redirect.
- Sources: https://developer.atlassian.com/cloud/trello/rest/api-group-organizations/, https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/

### Notion — NOT automatable today for target customers (manual-fallback UX required)
- Notion's public REST API has no endpoint to remove a member/guest from a workspace or strip page-level sharing from a specific user. User endpoints are read-only.
- SCIM-based deprovisioning exists but is **Enterprise-plan only** and requires the customer to hand us a token they generate themselves — not a realistic path for our target (small business, non-Enterprise) customer.
- **Product decision:** don't fake automation here. Tempkey "connects" to Notion only to show which pages a contractor was invited to (for context/audit purposes), and when their end date hits, surfaces a clear "remove [contractor] from these Notion pages" checklist/notification the owner completes by hand in Notion's own UI, then marks done in Tempkey. Be upfront about this being manual in the UI copy — do not claim auto-revocation for Notion.
- Source: https://developers.notion.com/reference/user, https://www.notion.com/help/provision-users-and-groups-with-scim

## Tech stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth (Credentials provider) for business-owner login
- Tailwind CSS
- Scheduled revocation check via an API route intended to be hit by an external cron (Vercel Cron in prod; a local script for dev)

## Setup (for a human, not automatable by the agent)

Tempkey needs real developer-app credentials from each platform. These have to be created and pasted in by a person — an agent should never be extracting or harvesting credentials from elsewhere on the machine.

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (a local or hosted Postgres instance) and `NEXTAUTH_SECRET` (any random string).
2. Slack: create an app at https://api.slack.com/apps, add the scopes listed above, set the OAuth redirect URL to `<your-domain>/api/integrations/slack/callback`, paste `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET` into `.env`.
3. Google: create OAuth credentials at https://console.cloud.google.com (APIs & Services → Credentials), enable the Drive API, set redirect URL to `<your-domain>/api/integrations/google/callback`, paste `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
4. Trello: get an API key at https://trello.com/power-ups/admin, paste `TRELLO_API_KEY`. User tokens are issued per-connection through Trello's own token-authorize URL (no secret needed at the app level).
5. Notion: create an integration at https://www.notion.so/my-integrations for the read-only "show what they have access to" piece; paste `NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET`.
6. `pnpm install --ignore-workspace` (this folder is not part of the parent repo's pnpm workspace, so a plain `pnpm install` from here silently no-ops against the monorepo root instead), `pnpm prisma migrate dev`, `pnpm dev`.

Verified locally end-to-end (2026-07-22): installed PostgreSQL 17 via winget, ran the real migration, and smoke-tested signup → login → dashboard render → `/api/integrations/options` → `pnpm revoke:check` against a seeded expired contractor with a (fake-token) Trello grant. Confirmed the contractor flips `ACTIVE → EXPIRED`, a real revocation attempt fires and its failure is logged with a specific error, and status correctly stays `EXPIRED` (not `REVOKED`) when a grant didn't actually succeed. Local Postgres default credentials from the winget install: `postgres`/`postgres` on `localhost:5432`. All test data was deleted afterward — the `tempkey` database exists locally but is empty.

## Marketing landing page

`app/page.tsx` now composes a full marketing site from `components/landing/`: `Navbar`, `Hero` (with a React Three Fiber 3D scene in `Hero3D.tsx` — an abstract rotating icosahedron pair standing in for a literal key/lock, kept low-poly for performance, pauses entirely under `prefers-reduced-motion`), `HowItWorks`, `Features` (accurate per-platform automation/manual copy, pulled from the research above — don't let this drift from what's actually true), `Pricing` ($29 Starter / $79 Growth), `CTA`, `Footer`.

Design tokens live in `app/globals.css` (`:root` CSS variables, defined as raw `R G B` triplets) and `tailwind.config.ts` (`brand-*` color scale via `rgb(var(--color-x) / <alpha-value>)`, so opacity modifiers like `bg-brand-primary/80` work correctly — don't redefine these as plain hex strings again, that silently breaks every `/NN` opacity modifier). Font is Plus Jakarta Sans, loaded once in `globals.css`. Icons are `lucide-react` only, no emoji.

## Revocation scheduler

The scheduler itself lives in `lib/revocation.ts` (`checkAndRevokeExpired`), which finds contractors past their `endDate`, dispatches each unrevoked grant to the right platform module's `revokeGrant`, logs a `RevocationLog` row per attempt, and flips contractor status to `EXPIRED` (clock ran out) then `REVOKED` (once every automatable grant is actually revoked).

- **Locally:** run `pnpm revoke:check` (`scripts/check-expired.ts`). This calls `checkAndRevokeExpired()` directly against whatever `DATABASE_URL` your `.env` points at and prints the result JSON — no server or deploy needed.
- **In production:** an external scheduler hits `POST /api/cron/revoke` (also responds to `GET`, for cron providers that only support GET pings) with an `Authorization: Bearer <CRON_SECRET>` header (or `x-cron-secret: <CRON_SECRET>`) on an interval, e.g. every 15 minutes — Vercel Cron or any scheduler capable of an authenticated HTTP call works. Requests missing or mismatching `CRON_SECRET` get a 401.
- Notion grants always come back `MANUAL_PENDING` (Notion has no revoke API — see above), so a contractor with an outstanding Notion grant stays at `EXPIRED`, not `REVOKED`, until the owner completes that step by hand.

## Task tracking

Progress is tracked via the harness's task list, not a TODO file here. Re-run `TaskList` to see current state if resuming this work.
