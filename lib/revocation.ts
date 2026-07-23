// Revocation scheduler: finds contractors whose end date has passed and
// pulls their access on every connected platform.
//
// Per-platform revokeGrant signatures are NOT uniform (see lib/integrations/*):
//   - Slack:  revokeGrant(integration: { accessToken }, grant, contractorEmail)
//   - Google: revokeGrant(integration: { accessToken, refreshToken }, grant, contractorEmail)
//   - Trello: revokeGrant(integration: { accessToken, meta }, grant)              -- no contractor param
//   - Notion: revokeGrant(_integration, grant, contractorName) -> always MANUAL_PENDING
// This module is the one place that knows how to dispatch to each of them.

import { prisma } from "@/lib/prisma";
import type { Platform } from "@prisma/client";
import * as slack from "@/lib/integrations/slack";
import * as google from "@/lib/integrations/google";
import * as trello from "@/lib/integrations/trello";
import * as notion from "@/lib/integrations/notion";

type RevokeResult = { outcome: "SUCCESS" | "FAILED" | "MANUAL_PENDING"; detail?: string };

type IntegrationInput = {
  accessToken: string;
  refreshToken: string | null;
  meta: unknown;
};

async function dispatchRevoke(
  platform: Platform,
  integration: IntegrationInput,
  grant: { scopeRefs: unknown },
  contractor: { email: string; name: string }
): Promise<RevokeResult> {
  switch (platform) {
    case "SLACK":
      return slack.revokeGrant(integration, grant, contractor.email);
    case "GOOGLE":
      return google.revokeGrant(integration, grant, contractor.email);
    case "TRELLO":
      return trello.revokeGrant(integration, grant);
    case "NOTION":
      return notion.revokeGrant(integration, grant, contractor.name);
    default: {
      // Exhaustiveness guard -- if a new Platform is ever added to the schema
      // without wiring it up here, fail loudly instead of silently skipping.
      const _exhaustive: never = platform;
      throw new Error(`No revocation handler for platform: ${_exhaustive}`);
    }
  }
}

export async function checkAndRevokeExpired(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  manualPending: number;
}> {
  const counts = { processed: 0, succeeded: 0, failed: 0, manualPending: 0 };

  const expiredContractors = await prisma.contractor.findMany({
    where: { status: "ACTIVE", endDate: { lte: new Date() } },
    include: {
      grants: {
        where: { revoked: false },
        include: { integration: true },
      },
    },
  });

  for (const contractor of expiredContractors) {
    // The clock ran out -- mark that now, independent of whether every
    // platform's revocation call actually succeeds below.
    if (contractor.status === "ACTIVE") {
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { status: "EXPIRED" },
      });
    }

    // Tracks the outcome of each grant processed in this run so we can
    // decide the contractor's final status afterward without re-querying.
    const revokedInThisRun = new Map<string, boolean>();

    for (const grant of contractor.grants) {
      counts.processed++;

      try {
        const result = await dispatchRevoke(
          grant.integration.platform,
          {
            accessToken: grant.integration.accessToken,
            refreshToken: grant.integration.refreshToken,
            meta: grant.integration.meta,
          },
          { scopeRefs: grant.scopeRefs },
          { email: contractor.email, name: contractor.name }
        );

        await prisma.revocationLog.create({
          data: {
            grantId: grant.id,
            outcome: result.outcome,
            detail: result.detail,
          },
        });

        if (result.outcome === "SUCCESS") {
          await prisma.contractorGrant.update({
            where: { id: grant.id },
            data: { revoked: true, revokedAt: new Date() },
          });
          revokedInThisRun.set(grant.id, true);
          counts.succeeded++;
        } else if (result.outcome === "MANUAL_PENDING") {
          revokedInThisRun.set(grant.id, false);
          counts.manualPending++;
        } else {
          revokedInThisRun.set(grant.id, false);
          counts.failed++;
        }
      } catch (err) {
        // A thrown error (e.g. the platform API call itself blew up) must
        // not stop the rest of this contractor's grants -- or the next
        // contractor -- from being processed.
        const message = err instanceof Error ? err.message : "Unknown error during revocation.";

        await prisma.revocationLog.create({
          data: {
            grantId: grant.id,
            outcome: "FAILED",
            detail: message,
          },
        });

        revokedInThisRun.set(grant.id, false);
        counts.failed++;
      }
    }

    const allNonManualRevoked = contractor.grants
      .filter((grant) => !grant.manualOnly)
      .every((grant) => revokedInThisRun.get(grant.id) === true);

    const anyManualUnrevoked = contractor.grants
      .filter((grant) => grant.manualOnly)
      .some((grant) => revokedInThisRun.get(grant.id) !== true);

    if (allNonManualRevoked && !anyManualUnrevoked) {
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { status: "REVOKED" },
      });
    }
    // Otherwise leave status at EXPIRED -- that's the signal to the
    // dashboard that a manual Notion step (or a failed revocation) is
    // still outstanding.
  }

  return counts;
}
