"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="bg-brand-gradient px-6 py-24">
      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-brand-onPrimary sm:text-4xl">
          Stop remembering to revoke access
        </h2>
        <p className="text-lg text-white/80">
          Set an end date once and Tempkey handles the rest &mdash; connect
          your tools, add a contractor, and walk away.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-md bg-brand-onPrimary px-6 py-3 text-sm font-semibold text-brand-primary transition-opacity hover:opacity-90"
        >
          Get started
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </motion.div>
    </section>
  );
}
