"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { localeMeta, locales } from "@/lib/i18n/dictionaries";

export function SiteHeader() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/classroom", label: t("nav.classroom") },
    { href: "/privacy", label: t("nav.privacy") },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--edu-panel-border)] bg-[color:var(--edu-bg)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[color:var(--edu-accent)] to-[color:var(--edu-accent-2)] text-sm font-bold text-[#04141a]">
            E
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{t("brand.name")}</span>
            <span className="text-[10px] uppercase tracking-widest text-[color:var(--edu-text-dim)]">
              {t("brand.sub")}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          {links.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-[color:var(--edu-text)]"
                    : "text-[color:var(--edu-text-dim)] hover:text-[color:var(--edu-text)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 rounded-lg border border-[color:var(--edu-panel-border)] p-0.5">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                locale === l
                  ? "bg-[color:var(--edu-accent)] text-[#04141a]"
                  : "text-[color:var(--edu-text-dim)] hover:text-[color:var(--edu-text)]"
              }`}
              aria-pressed={locale === l}
            >
              {localeMeta[l].label}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[color:var(--edu-panel-border)] px-4 py-1.5 sm:hidden" aria-label="Primary (mobile)">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium text-[color:var(--edu-text-dim)] hover:text-[color:var(--edu-text)]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
