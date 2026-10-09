"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Transacciones" },
  { href: "/calidad", label: "Calidad de datos" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="flex gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-surface font-medium text-primary shadow-sm ring-1 ring-border"
                : "text-secondary hover:text-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
