import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_LABELS = {
  SLACK: "Slack",
  GOOGLE: "Google Drive",
  TRELLO: "Trello",
  NOTION: "Notion",
} as const;

type PlatformKey = keyof typeof PLATFORM_LABELS;

function daysRemaining(endDate: Date): { label: string; expired: boolean } {
  const diffMs = endDate.getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return { label: "expired", expired: true };
  }
  if (days === 0) {
    return { label: "expires today", expired: false };
  }
  return { label: `${days} day${days === 1 ? "" : "s"} remaining`, expired: false };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const userId = (session.user as { id: string }).id;

  const [integrations, contractors] = await Promise.all([
    prisma.integration.findMany({ where: { userId } }),
    prisma.contractor.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        grants: {
          include: {
            integration: true,
            logs: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    }),
  ]);

  const connectedPlatforms = new Set(integrations.map((integration) => integration.platform));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/dashboard/contractors/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add contractor
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <div className="flex flex-col divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {(Object.keys(PLATFORM_LABELS) as PlatformKey[]).map((platform) => {
            const connected = connectedPlatforms.has(platform);
            return (
              <div key={platform} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{PLATFORM_LABELS[platform]}</p>
                  <p className={`text-xs ${connected ? "text-green-600" : "text-slate-500"}`}>
                    {connected ? "Connected" : "Not connected"}
                  </p>
                  {platform === "NOTION" && (
                    <p className="mt-1 max-w-md text-xs text-slate-500">
                      Notion doesn&apos;t support automatic removal &mdash; Tempkey will show you a
                      checklist instead.
                    </p>
                  )}
                </div>
                {!connected && <ConnectLink platform={platform} />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contractors</h2>
        {contractors.length === 0 ? (
          <p className="text-sm text-slate-500">No contractors yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">End date</th>
                  <th className="px-4 py-2">Days remaining</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Grants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contractors.map((contractor) => {
                  const { label } = daysRemaining(contractor.endDate);
                  return (
                    <tr key={contractor.id} className="align-top">
                      <td className="px-4 py-3 font-medium">{contractor.name}</td>
                      <td className="px-4 py-3 text-slate-600">{contractor.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {contractor.endDate.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{label}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={contractor.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ul className="flex flex-col gap-1">
                          {contractor.grants.map((grant) => {
                            const latestLog = grant.logs[0];
                            const state = latestLog
                              ? `${latestLog.outcome.toLowerCase().replace("_", " ")}`
                              : "pending";
                            return (
                              <li key={grant.id} className="text-xs text-slate-600">
                                <span className="font-medium">
                                  {PLATFORM_LABELS[grant.integration.platform as PlatformKey]}
                                </span>
                                {grant.manualOnly && <span className="text-slate-400"> (manual)</span>}
                                {": "}
                                {state}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRED: "bg-amber-100 text-amber-700",
    REVOKED: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function ConnectLink({ platform }: { platform: PlatformKey }) {
  const className =
    "rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100";

  if (platform === "TRELLO") {
    return (
      <Link href="/integrations/trello/connect" className={className}>
        Connect
      </Link>
    );
  }

  const hrefByPlatform: Record<Exclude<PlatformKey, "TRELLO">, string> = {
    SLACK: "/api/integrations/slack/connect",
    GOOGLE: "/api/integrations/google/connect",
    NOTION: "/api/integrations/notion/connect",
  };

  return (
    <a href={hrefByPlatform[platform as Exclude<PlatformKey, "TRELLO">]} className={className}>
      Connect
    </a>
  );
}
