"use client";

import Link from "next/link";

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-primary/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className={`rounded text-lg font-bold tracking-tight text-brand-onPrimary ${focusRing}`}
        >
          Tempkey
        </Link>

        <ul className="hidden items-center gap-8 sm:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`rounded text-sm font-medium text-slate-300 transition hover:text-brand-onPrimary ${focusRing}`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-200 transition hover:text-brand-onPrimary ${focusRing}`}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={`inline-flex min-h-11 items-center rounded-md bg-brand-gradient px-4 text-sm font-semibold text-white transition hover:opacity-90 ${focusRing}`}
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
