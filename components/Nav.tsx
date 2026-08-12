"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/data", label: "Data" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-5 sm:gap-7 text-[13px]">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              active
                ? "text-ink border-b border-accent pb-0.5"
                : "text-muted hover:text-ink transition-colors pb-0.5 border-b border-transparent"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
