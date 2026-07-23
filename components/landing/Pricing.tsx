"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

type Plan = {
  name: string;
  price: number;
  description: string;
  features: string[];
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: "Starter",
    price: 29,
    description: "For small teams that just need the basics covered.",
    features: [
      "Unlimited contractors",
      "Core integrations: Slack & Google Drive",
      "Automatic access revocation on end date",
      "Revocation history & audit log",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: 79,
    description: "For teams running more tools and more contractors.",
    features: [
      "Everything in Starter",
      "Full integration access, including Trello & Notion",
      "Priority support",
      "Faster, more frequent revocation checks",
    ],
    featured: true,
  },
];

export default function Pricing() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="pricing" className="bg-brand-background px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-brand-primary sm:text-4xl">
            Simple, self-serve pricing
          </h2>
          <p className="mt-4 text-lg text-brand-secondary">
            Pick a plan and start protecting access today. No demos, no sales
            calls.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl gap-8 sm:grid-cols-2">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`relative flex flex-col rounded-2xl bg-white p-8 ${
                plan.featured
                  ? "border-2 border-brand-accent shadow-xl"
                  : "border border-brand-border shadow-sm"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-8 rounded-full bg-brand-accent px-3 py-1 text-xs font-semibold text-brand-onPrimary">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-brand-primary">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-brand-secondary">
                {plan.description}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-brand-primary">
                  ${plan.price}
                </span>
                <span className="text-sm font-medium text-brand-secondary">
                  /mo
                </span>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-brand-secondary"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90 ${
                  plan.featured
                    ? "bg-brand-gradient text-brand-onPrimary"
                    : "bg-brand-primary text-brand-onPrimary"
                }`}
              >
                Get started
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-brand-secondary">
          No sales calls. Connect your tools and start in minutes.
        </p>
      </div>
    </section>
  );
}
