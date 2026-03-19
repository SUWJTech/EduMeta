"use client";

import { useMemo, useState } from "react";
import FilterPills from "@/components/market/FilterPills";
import MarketFeed from "@/components/market/MarketFeed";
import MarketSearch from "@/components/market/MarketSearch";
import { MARKET_ITEMS, type MarketCategory } from "@/components/market/mock";

export default function MarketPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketCategory>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MARKET_ITEMS.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  return (
    <main className="flex flex-col gap-4">
      <section className="pt-2">
        <MarketSearch value={query} onChange={setQuery} />
      </section>

      <section>
        <FilterPills value={category} onChange={setCategory} />
      </section>

      <MarketFeed items={filtered} />
    </main>
  );
}
