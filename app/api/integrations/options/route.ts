import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listChannels } from "@/lib/integrations/slack";
import { listFiles } from "@/lib/integrations/google";
import { getWorkspaces, getWorkspaceMembers } from "@/lib/integrations/trello";
import { listSharedPages } from "@/lib/integrations/notion";

// Powers the "add contractor" picker: for every platform the logged-in user
// has connected, fetch the list of items (channels/files/workspaces+members/
// pages) the owner can choose from when scoping a contractor's access.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const integrations = await prisma.integration.findMany({ where: { userId } });
  const byPlatform = new Map(integrations.map((integration) => [integration.platform, integration]));

  const slackIntegration = byPlatform.get("SLACK");
  const googleIntegration = byPlatform.get("GOOGLE");
  const trelloIntegration = byPlatform.get("TRELLO");
  const notionIntegration = byPlatform.get("NOTION");

  const [slack, google, trello, notion] = await Promise.all([
    (async () => {
      if (!slackIntegration) return { connected: false as const };
      try {
        const channels = await listChannels(slackIntegration.accessToken);
        return { connected: true as const, channels };
      } catch (err) {
        return { connected: true as const, error: err instanceof Error ? err.message : "Failed to load Slack channels." };
      }
    })(),
    (async () => {
      if (!googleIntegration) return { connected: false as const };
      try {
        const files = await listFiles(googleIntegration.accessToken);
        return { connected: true as const, files };
      } catch (err) {
        return { connected: true as const, error: err instanceof Error ? err.message : "Failed to load Google Drive files." };
      }
    })(),
    (async () => {
      if (!trelloIntegration) return { connected: false as const };
      try {
        const workspaces = await getWorkspaces(trelloIntegration.accessToken);
        const withMembers = await Promise.all(
          workspaces.map(async (workspace) => {
            const members = await getWorkspaceMembers(trelloIntegration.accessToken, workspace.id);
            return {
              id: workspace.id,
              displayName: workspace.displayName,
              members: members.map((member) => ({
                id: member.id,
                fullName: member.fullName,
                username: member.username,
              })),
            };
          })
        );
        return { connected: true as const, workspaces: withMembers };
      } catch (err) {
        return { connected: true as const, error: err instanceof Error ? err.message : "Failed to load Trello workspaces." };
      }
    })(),
    (async () => {
      if (!notionIntegration) return { connected: false as const };
      try {
        const pages = await listSharedPages(notionIntegration.accessToken);
        return { connected: true as const, pages };
      } catch (err) {
        return { connected: true as const, error: err instanceof Error ? err.message : "Failed to load Notion pages." };
      }
    })(),
  ]);

  return NextResponse.json({ slack, google, trello, notion });
}
