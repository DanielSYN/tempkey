import Link from "next/link";

const productLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const accountLinks = [
  { label: "Log in", href: "/login" },
  { label: "Sign up", href: "/signup" },
];

export default function Footer() {
  return (
    <footer className="bg-brand-primary px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <span className="text-lg font-semibold text-brand-onPrimary">
            Tempkey
          </span>
          <p className="mt-2 text-sm text-white/60">
            Timed access for contractors and freelancers &mdash; so no one has
            to remember to revoke it.
          </p>
        </div>

        <div className="flex gap-16">
          <div>
            <h3 className="text-sm font-semibold text-brand-onPrimary">
              Product
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-brand-onPrimary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-onPrimary">
              Account
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-brand-onPrimary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-5xl border-t border-white/10 pt-6">
        <p className="text-xs text-white/60">&copy; 2026 Tempkey</p>
      </div>
    </footer>
  );
}
