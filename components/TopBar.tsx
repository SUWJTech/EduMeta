import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function TopBar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emailPrefix = user?.email ? user.email.split("@")[0] : null;

  return (
    <header className="flex items-center justify-between">
      <div className="text-base font-semibold tracking-tight">EduMeta</div>

      <div className="flex items-center gap-3">
        {emailPrefix ? (
          <div className="text-right">
            <div className="text-xs font-semibold text-white">{emailPrefix}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-meta-secondary shadow-[0_0_10px_rgba(6,182,212,0.55)]" />
              在线
            </div>
          </div>
        ) : (
          <Link href="/login" className="text-right">
            <div className="text-xs font-semibold text-white">未连接</div>
            <div className="mt-0.5 text-[11px] text-white/45">去登录</div>
          </Link>
        )}

        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-meta-primary/70 to-meta-secondary/60 p-[2px] shadow-[0_0_18px_rgba(139,92,246,0.35)]">
          <div className="h-full w-full rounded-full bg-slate-900/80" />
        </div>
      </div>
    </header>
  );
}
