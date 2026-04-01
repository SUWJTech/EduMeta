"use client";

import { Link2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import FilterPills from "@/components/market/FilterPills";
import MarketFeed from "@/components/market/MarketFeed";
import MarketSearch from "@/components/market/MarketSearch";
import PublishModal from "@/components/market/PublishModal";
import TradeOverlay from "@/components/market/TradeOverlay";
import Toast from "@/components/focus/Toast";
import type { MarketCategory, MarketItemRow } from "@/components/market/types";
import { createClient } from "@/utils/supabase/client";

export default function MarketClient({ initialItems }: { initialItems: MarketItemRow[] }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketCategory>("all");
  const [items, setItems] = useState<MarketItemRow[]>(initialItems);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "info" | "error" } | null>(
    null
  );
  const [trade, setTrade] = useState<{
    open: boolean;
    from: { x: number; y: number };
    to: { x: number; y: number };
    item: MarketItemRow | null;
    targetEl: HTMLElement | null;
  }>({
    open: false,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    item: null,
    targetEl: null,
  });

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const linkRef = useRef<HTMLButtonElement | null>(null);
  const highlightId = searchParams.get("highlight");

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const refreshItems = async () => {
    const supabase = supabaseRef.current;
    const { data, error } = await supabase
      .from("market_items")
      .select("id,user_id,type,title,description,price,status,claimed_by,claimed_at,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setToast({ message: error.message, variant: "error" });
      return;
    }

    setItems((data as MarketItemRow[]) ?? []);
  };

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("market_items_stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_items" },
        () => {
          void refreshItems();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) {
        void supabase.removeChannel(ch);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all") {
        if (category === "skills" && item.type !== "技能") return false;
        if (category === "hardware" && item.type !== "硬件") return false;
        if (category === "requests" && item.type !== "任务") return false;
      }

      if (!q) return true;

      const title = item.title.toLowerCase();
      const desc = item.description?.toLowerCase() ?? "";
      return title.includes(q) || desc.includes(q);
    });
  }, [category, items, query]);

  useEffect(() => {
    if (!highlightId) return;

    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-market-id="${highlightId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);

    return () => window.clearTimeout(id);
  }, [highlightId, filtered.length]);

  const onAccept = async (item: MarketItemRow, el: HTMLElement) => {
    if (acceptingId) return;

    const linkEl = linkRef.current;
    if (!linkEl) {
      setToast({ message: "链接节点未初始化", variant: "error" });
      return;
    }

    const linkRect = linkEl.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();
    const from = { x: linkRect.left + linkRect.width / 2, y: linkRect.top + linkRect.height / 2 };
    const to = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };

    setAcceptingId(item.id);
    setTrade({ open: true, from, to, item, targetEl: el });
  };

  const finalizeAccept = async () => {
    const item = trade.item;

    setTrade((s) => ({ ...s, open: false }));

    if (!item) {
      setAcceptingId(null);
      return;
    }

    try {
      const supabase = supabaseRef.current;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setToast({ message: "请先登录后再共振", variant: "error" });
        return;
      }

      const { error } = await supabase.rpc("accept_market_task", { p_item_id: item.id });

      if (error) {
        if (error.message.includes("ALREADY_CLAIMED")) {
          setToast({ message: "该信号已被其他节点认领", variant: "error" });
          return;
        }
        setToast({ message: error.message, variant: "error" });
        return;
      }

      await refreshItems();
    } finally {
      setAcceptingId(null);
    }
  };

  const onToast = (message: string, variant: "info" | "error" = "info") => {
    setToast({ message, variant });
  };

  return (
    <main className="relative flex flex-col gap-4">
      <Toast message={toast?.message ?? null} variant={toast?.variant ?? "info"} />
      <TradeOverlay
        open={trade.open}
        from={trade.from}
        to={trade.to}
        onDone={() => {
          void finalizeAccept();
        }}
      />

      <section className="pt-2">
        <MarketSearch value={query} onChange={setQuery} />
      </section>

      <section>
        <FilterPills value={category} onChange={setCategory} />
      </section>

      {filtered.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60 backdrop-blur-lg">
          当前维度暂无需求
        </section>
      ) : (
        <MarketFeed
          items={filtered}
          acceptingId={acceptingId}
          onAccept={onAccept}
          highlightedId={highlightId}
        />
      )}

      <button
        ref={linkRef}
        type="button"
        onClick={() => setPublishOpen(true)}
        className="fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full border border-white/10 bg-slate-950/35 text-cyan-100/85 shadow-[0_0_30px_rgba(6,182,212,0.28)] backdrop-blur transition-transform active:scale-95"
        aria-label="发布信号"
      >
        <Link2 className="h-6 w-6" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-meta-secondary text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.45)]">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onPublished={refreshItems}
        onToast={onToast}
      />
    </main>
  );
}
