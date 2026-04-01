"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Hexagon, Layers, LogIn, LogOut, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "@/utils/supabase/client";

const cn = (...inputs: Array<string | undefined | null | false>) =>
  twMerge(clsx(inputs));

const items = [
  { href: "/", label: "Home", Icon: Hexagon },
  { href: "/focus", label: "Focus", Icon: Target },
  { href: "/market", label: "Market", Icon: Layers },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [emailPrefix, setEmailPrefix] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(true);
  const hideNav = pathname === "/awakening";

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;
        setEmailPrefix(user?.email ? user.email.split("@")[0] : null);
      } finally {
        if (active) setAuthBusy(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmailPrefix(session?.user?.email ? session.user.email.split("@")[0] : null);
      setAuthBusy(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const onAuthAction = async () => {
    if (authBusy) return;

    if (emailPrefix) {
      setAuthBusy(true);
      try {
        await supabase.auth.signOut();
        setEmailPrefix(null);
        router.push("/login");
        router.refresh();
      } finally {
        setAuthBusy(false);
      }
      return;
    }

    const redirectTo = encodeURIComponent(pathname && pathname.startsWith("/") ? pathname : "/");
    router.push(`/login?redirectTo=${redirectTo}`);
  };

  if (hideNav) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
      <nav className="relative grid grid-cols-4 rounded-2xl border border-white/15 bg-white/14 p-1 shadow-[0_10px_34px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
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
                  className="absolute inset-0 rounded-xl bg-white/14"
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

        <button
          type="button"
          onClick={() => void onAuthAction()}
          disabled={authBusy}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60",
            emailPrefix ? "text-cyan-100" : "text-white/80 hover:text-white"
          )}
        >
          <span className="relative">
            {emailPrefix ? <LogOut className="h-5 w-5" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
          </span>
          <span className="relative">{authBusy ? "Auth..." : emailPrefix ? "Logout" : "Login"}</span>
        </button>
      </nav>
    </div>
  );
}
