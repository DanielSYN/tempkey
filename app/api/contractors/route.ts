import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const grantSchema = z.object({
  platform: z.enum(["SLACK", "GOOGLE", "TRELLO", "NOTION"]),
  scopeType: z.enum(["SLACK_CHANNELS", "GOOGLE_FILES", "TRELLO_BOARD", "NOTION_PAGES"]),
  scopeRefs: z.any(),
});

const contractorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  endDate: z.coerce.date(),
  grants: z.array(grantSchema).min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const parsed = contractorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, endDate, grants } = parsed.data;

  // Resolve each grant's platform to the caller's Integration row for it --
  // scopeRefs alone don't carry which integration they belong to.
  const integrations = await prisma.integration.findMany({
    where: { userId, platform: { in: grants.map((grant) => grant.platform) } },
  });
  const integrationByPlatform = new Map(integrations.map((integration) => [integration.platform, integration]));

  const missing = grants.find((grant) => !integrationByPlatform.has(grant.platform));
  if (missing) {
    return NextResponse.json(
      { error: `No connected ${missing.platform} integration for this account.` },
      { status: 400 }
    );
  }

  const contractor = await prisma.contractor.create({
    data: {
      userId,
      name,
      email,
      endDate,
      status: "ACTIVE",
      grants: {
        create: grants.map((grant) => ({
          integrationId: integrationByPlatform.get(grant.platform)!.id,
          scopeType: grant.scopeType,
          scopeRefs: grant.scopeRefs,
          manualOnly: grant.scopeType === "NOTION_PAGES",
        })),
      },
    },
    include: { grants: true },
  });

  return NextResponse.json(contractor, { status: 201 });
}
