"use client";

import { motion } from "framer-motion";
import MarketCard from "./MarketCard";
import type { MarketItem } from "./mock";

const listVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
} as const;

export default function MarketFeed({ items }: { items: MarketItem[] }) {
  return (
    <motion.section
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-4"
    >
      {items.map((item) => (
        <MarketCard key={item.id} item={item} />
      ))}
    </motion.section>
  );
}

