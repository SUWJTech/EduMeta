"use client";

import { motion } from "framer-motion";
import MarketCard from "./MarketCard";
import type { MarketItemRow } from "./types";

const listVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
} as const;

export default function MarketFeed({
  items,
  acceptingId,
  onAccept,
  highlightedId,
}: {
  items: MarketItemRow[];
  acceptingId: string | null;
  onAccept: (item: MarketItemRow, el: HTMLElement) => void;
  highlightedId?: string | null;
}) {
  return (
    <motion.section
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-4"
    >
      {items.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          accepting={acceptingId === item.id}
          onAccept={onAccept}
          highlighted={highlightedId === item.id}
        />
      ))}
    </motion.section>
  );
}
