import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Called client-side (not a redirect target) by app/integrations/trello/connect/page.tsx
// once it has pulled the user token out of the URL fragment Trello redirected
// back with -- fragments never reach the server, so the token has to be
// handed over explicitly via this POST.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = body?.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;

  const integration = await prisma.integration.upsert({
    where: { userId_platform: { userId, platform: "TRELLO" } },
    update: { accessToken: token },
    create: { userId, platform: "TRELLO", accessToken: token },
  });

  return NextResponse.json({ id: integration.id });
}
