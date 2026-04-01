"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Toast from "@/components/focus/Toast";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const EMAIL_REGEX = /^[^\s@]+@((qq\.com)|(gmail\.com)|([A-Za-z0-9-]+\.)*edu\.cn)$/i;
const PASSWORD_REGEX = /^(?=.{6,}$)(?=.*[A-Za-z0-9]).*$/;

async function ensureProfileRow(supabase: SupabaseClient, user: User) {
  const displayName = user.email ? user.email.split("@")[0] : null;
  const payloads: Array<Record<string, unknown>> = [
    { id: user.id, display_name: displayName, avatar_url: "default" },
    { id: user.id, avatar_url: "default" },
    { id: user.id },
  ];

  for (const payload of payloads) {
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) return true;
  }

  const { data, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  return !error && Boolean(data?.id);
}

async function getHasOnboarded(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("has_onboarded")
    .eq("id", userId)
    .maybeSingle<{ has_onboarded: boolean | null }>();

  if (error) return null;
  return data?.has_onboarded ?? null;
}

function isRateLimitError(message: string) {
  return message.toLowerCase().includes("rate limit exceeded");
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => {
    const v = searchParams.get("redirectTo");
    return v && v.startsWith("/") ? v : "/";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const passwordValid = PASSWORD_REGEX.test(password);
  const canSubmit = emailValid && passwordValid && !busy;

  const showRateLimitToast = () => {
    setToast("能量波动频繁，请 60 秒后再试");
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const onSignIn = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (isRateLimitError(error.message)) {
          showRateLimitToast();
          return;
        }
        setMessage(error.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("登录态校验失败，请重试。");
        return;
      }

      const seeded = await ensureProfileRow(supabase, user);
      if (!seeded) setToast("登录成功，节点档案将在进入城市时自动补全");

      const hasOnboarded = await getHasOnboarded(supabase, user.id);
      router.replace(hasOnboarded === false ? "/awakening" : redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        if (isRateLimitError(error.message)) {
          showRateLimitToast();
          return;
        }
        setMessage(error.message);
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (isRateLimitError(signInError.message)) {
          showRateLimitToast();
          return;
        }

        setMessage("注册成功。若开启邮箱验证，请先完成邮箱确认后再登录。");
        return;
      }

      const signedUser = signInData.user;
      const userId = signedUser?.id;
      if (!userId || !signedUser) {
        setMessage("注册成功，但未能获取用户信息。");
        return;
      }

      const seeded = await ensureProfileRow(supabase, signedUser);
      if (!seeded) setToast("注册成功，节点档案将在进入城市时自动补全");

      router.replace("/awakening");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-[calc(100dvh-6rem)] flex-col justify-center overflow-hidden">
      <Toast message={toast} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.14),transparent_36%),radial-gradient(circle_at_85%_0%,rgba(129,140,248,0.16),transparent_34%),radial-gradient(circle_at_50%_130%,rgba(14,165,233,0.1),transparent_40%)]" />

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative mx-auto w-full max-w-md rounded-3xl border border-cyan-200/20 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-6 shadow-[0_24px_64px_rgba(8,47,73,0.35)] backdrop-blur-2xl"
      >
        <div className="inline-flex rounded-full border border-cyan-200/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] tracking-[0.2em] text-cyan-100/80">
          AUTH PORTAL
        </div>
        <div className="mt-3 text-sm font-semibold tracking-tight text-white">连接你的 EduMeta 身份</div>
        <div className="mt-1 text-xs text-white/55">验证通过后将自动返回上一页面</div>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-2">
            <span className="text-xs font-medium text-white/60">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="you@campus.edu"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/20"
            />
            <span className="text-[11px] text-white/45">
              支持：`@qq.com`、`@gmail.com`、以及学校 `@edu.cn`
            </span>
            {!emailValid && email.trim().length > 0 ? (
              <span className="text-[11px] text-white/60">
                <span className="bg-gradient-to-r from-meta-primary to-meta-secondary bg-clip-text text-transparent">
                  邮箱格式无效
                </span>
              </span>
            ) : null}
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium text-white/60">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="至少 6 位"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/20"
            />
            <span className="text-[11px] text-white/45">至少 6 位，包含数字或字母</span>
            {!passwordValid && password.length > 0 ? (
              <span className="text-[11px] text-white/60">
                <span className="bg-gradient-to-r from-meta-primary to-meta-secondary bg-clip-text text-transparent">
                  密码强度不足
                </span>
              </span>
            ) : null}
          </label>

          {message ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-white/70">
              {message}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={onSignIn}
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.95),rgba(79,70,229,0.95))] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(14,165,233,0.28)] transition-transform disabled:opacity-50 active:scale-95"
          >
            {busy ? "连接中..." : "接入元宇宙 (Sign In)"}
          </button>
          <button
            type="button"
            onClick={onSignUp}
            disabled={!canSubmit}
            className="w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-sm transition-transform disabled:opacity-50 active:scale-95"
          >
            创建新节点 (Sign Up)
          </button>
        </div>
      </motion.section>
    </main>
  );
}
