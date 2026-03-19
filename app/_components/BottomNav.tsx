"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Hexagon, Layers, Target } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Array<string | undefined | null | false>) =>
  twMerge(clsx(inputs));

const items = [
  { href: "/", label: "Home", Icon: Hexagon },
  { href: "/focus", label: "Focus", Icon: Target },
  { href: "/market", label: "Market", Icon: Layers },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <nav className="relative grid grid-cols-3 rounded-2xl border-t border-white/10 bg-white/10 p-1 backdrop-blur-md">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                active ? "text-white" : "text-white/70 hover:text-white"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-xl bg-white/10"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

