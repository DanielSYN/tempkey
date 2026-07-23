"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileText, HardDrive, Slack, Trello, Zap, type LucideIcon } from "lucide-react";

interface PlatformCard {
  icon: LucideIcon;
  name: string;
  description: string;
  status: "Automatic" | "Guided manual step";
}

const platforms: PlatformCard[] = [
  {
    icon: Slack,
    name: "Slack",
    description: "Removed from every channel they had access to, on any plan tier.",
    status: "Automatic",
  },
  {
    icon: HardDrive,
    name: "Google Drive",
    description: "Permission revoked on every file and folder they were individually shared on.",
    status: "Automatic",
  },
  {
    icon: Trello,
    name: "Trello",
    description: "Removed from the Workspace and every board in it, in one pass.",
    status: "Automatic",
  },
  {
    icon: FileText,
    name: "Notion",
    description:
      "Notion's API can't remove people, so Tempkey gives you an exact checklist of which pages to clear by hand.",
    status: "Guided manual step",
  },
];

export default function Features() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="bg-brand-primary py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent2">
            What actually gets revoked
          </h2>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-onPrimary sm:text-4xl">
            Real revocation, platform by platform
          </p>
          <p className="mt-4 text-base text-slate-300">
            Three tools revoke automatically the second a contract ends. Notion&rsquo;s API
            doesn&rsquo;t support that, so we&rsquo;re upfront about it instead of pretending
            otherwise &mdash; you get a clear checklist and a full audit trail either way.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((platform, index) => {
            const Icon = platform.icon;
            const isAutomatic = platform.status === "Automatic";
            return (
              <motion.div
                key={platform.name}
                className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-6"
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-brand-onPrimary">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      isAutomatic
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {isAutomatic && <Zap className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />}
                    {platform.status}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-brand-onPrimary">
                  {platform.name}
                </h3>
                <p className="mt-2 text-sm text-slate-300">{platform.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
