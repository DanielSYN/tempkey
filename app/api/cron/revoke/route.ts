import { NextResponse } from "next/server";
import { checkAndRevokeExpired } from "@/lib/revocation";

// Cron-triggered route -- always run fresh, never statically cached.
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : null;

  const cronSecretHeader = req.headers.get("x-cron-secret");

  const provided = bearerToken || cronSecretHeader;

  return provided === expected;
}

async function handleRevoke(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await checkAndRevokeExpired();

  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request) {
  return handleRevoke(req);
}

// Some cron providers (e.g. simple uptime-style pingers) only support GET --
// support both so either kind of scheduler can trigger this.
export async function GET(req: Request) {
  return handleRevoke(req);
}
