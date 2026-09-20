"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/", label: "Conversa", icone: IconeConversa },
  { href: "/diario", label: "Diário", icone: IconeDiario },
  { href: "/periodo", label: "Período", icone: IconePeriodo },
  { href: "/corpo", label: "Corpo", icone: IconeCorpo },
  { href: "/perfil", label: "Perfil", icone: IconePerfil },
];

export function Abas() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Seções"
    >
      <ul className="mx-auto max-w-lg flex">
        {ABAS.map(({ href, label, icone: Icone }) => {
          const ativa = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px]"
                style={{ color: ativa ? "var(--accent)" : "var(--muted)" }}
              >
                <Icone ativa={ativa} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconeProps = { ativa: boolean };

const base = (ativa: boolean) => ({
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: ativa ? 2.2 : 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

function IconeConversa({ ativa }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(ativa)} aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-2.8-.4L3 21l1.6-4.6A8.3 8.3 0 0 1 3.6 8 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
    </svg>
  );
}

function IconeDiario({ ativa }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(ativa)} aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
    </svg>
  );
}

function IconePeriodo({ ativa }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(ativa)} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IconeCorpo({ ativa }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(ativa)} aria-hidden>
      <path d="M12 21a7 7 0 0 0 7-7c0-4-3.5-6.6-5.2-10.2a2 2 0 0 0-3.6 0C8.5 7.4 5 10 5 14a7 7 0 0 0 7 7Z" />
    </svg>
  );
}

function IconePerfil({ ativa }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(ativa)} aria-hidden>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}
