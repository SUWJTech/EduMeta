"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import PublishModal from "@/components/market/PublishModal";

export default function PublishFab({
  onPublished,
  onToast,
}: {
  onPublished?: () => void | Promise<void>;
  onToast?: (message: string, variant?: "info" | "error") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[5.25rem] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-meta-secondary text-slate-950 shadow-[0_0_28px_rgba(6,182,212,0.38)] transition-transform active:scale-95"
        aria-label="Publish"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <PublishModal
        open={open}
        onClose={() => setOpen(false)}
        onPublished={onPublished}
        onToast={onToast}
      />
    </>
  );
}
