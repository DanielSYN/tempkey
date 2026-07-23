"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Hero3D from "./Hero3D";

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion
        ? {}
        : { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const item: Variants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: "easeOut" },
    },
  };

  return (
    <section className="relative overflow-hidden bg-brand-primary">
      {/* soft accent glow, purely decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-24 md:grid-cols-2 md:py-32">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-start gap-6"
        >
          <motion.h1
            variants={item}
            className="text-4xl font-extrabold tracking-tight text-brand-onPrimary sm:text-5xl lg:text-6xl"
          >
            Contractor access that expires itself.
          </motion.h1>

          <motion.p variants={item} className="max-w-xl text-lg text-slate-300">
            Give contractors timed access to Slack, Google Drive, Trello, and
            Notion. Set an end date once&nbsp;&mdash;&nbsp;and access revokes
            itself automatically when the contract ends. No one has to
            remember to clean up.
          </motion.p>

          <motion.div variants={item} className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-md bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-accent2/20 transition hover:shadow-brand-accent2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-brand-onPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary"
            >
              Log in
            </Link>
          </motion.div>
        </motion.div>

        <div className="relative h-[320px] w-full sm:h-[400px] md:h-[480px]">
          <Hero3D className="absolute inset-0" />
        </div>
      </div>
    </section>
  );
}
