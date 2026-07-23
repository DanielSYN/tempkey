import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/integrations/slack";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("slack_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: "Invalid or missing OAuth state." }, { status: 400 });
  }

  try {
    const { accessToken, externalTeamId, meta } = await exchangeCodeForToken(code);

    const userId = (session.user as { id: string }).id;
    const metaJson = meta as Prisma.InputJsonValue | undefined;

    await prisma.integration.upsert({
      where: { userId_platform: { userId, platform: "SLACK" } },
      update: { accessToken, externalTeamId, meta: metaJson },
      create: { userId, platform: "SLACK", accessToken, externalTeamId, meta: metaJson },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Slack connection failed." },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(new URL("/dashboard", process.env.NEXTAUTH_URL));
  response.cookies.delete("slack_oauth_state");
  return response;
}
