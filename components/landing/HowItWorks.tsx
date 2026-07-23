"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ListChecks, PlugZap, TimerReset, UserPlus, type LucideIcon } from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  note?: string;
}

const steps: Step[] = [
  {
    icon: PlugZap,
    title: "Connect your tools",
    description:
      "One-click OAuth into Slack, Google Drive, Trello, and Notion. Tempkey only asks for the access it needs to manage contractor permissions.",
  },
  {
    icon: UserPlus,
    title: "Add a contractor",
    description:
      "Name, email, which tools they need, and an end date. Set it once when they start and move on with your day.",
  },
  {
    icon: TimerReset,
    title: "Access expires itself",
    description:
      "The moment the end date hits, Tempkey automatically pulls access across every connected tool — no reminder, no follow-up, no forgetting.",
  },
  {
    icon: ListChecks,
    title: "Notion: one manual click",
    description:
      "Notion's API doesn't allow automatic removal, so Tempkey hands you a ready-made checklist of exactly which pages to remove them from.",
    note: "The only manual step in the whole flow.",
  },
];

export default function HowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="bg-brand-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
            How it works
          </h2>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-primary sm:text-4xl">
            Set an end date once. Tempkey handles the rest.
          </p>
          <p className="mt-4 text-base text-brand-secondary">
            Four steps from connecting your tools to a contractor&rsquo;s access disappearing on
            schedule &mdash; automatically, everywhere it can be.
          </p>
        </div>

        <ol className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.title}
                className="relative flex flex-col rounded-xl border border-brand-border bg-white p-6 shadow-sm"
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, delay: index * 0.04, ease: "easeOut" }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-brand-onPrimary">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-brand-secondary">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-brand-primary">{step.title}</h3>
                <p className="mt-2 text-sm text-brand-secondary">{step.description}</p>
                {step.note && (
                  <p className="mt-3 text-xs font-medium text-brand-accent">{step.note}</p>
                )}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
