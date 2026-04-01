"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FragmentType = "Tech" | "Academic" | "Engine";
export type FragmentRarity = "common" | "uncommon" | "rare" | "epic";

export type Fragment = {
  id: string;
  type: FragmentType;
  rarity: FragmentRarity;
  timestamp: string;
};

type EnergySphereTraits = {
  color: number;
  roughness: number;
  distortion: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

type UserStore = {
  computePower: number;
  totalComputeMined: number;
  fragments: Fragment[];
  energySphereTraits: EnergySphereTraits;
  mindTags: string[];
  showcaseFiles: string[];
  setComputeSnapshot: (balance: number, totalMined?: number | null) => void;
  addComputePower: (amount: number) => void;
  setComputePower: (amount: number) => void;
  spendComputePower: (amount: number) => boolean;
  setFragments: (fragments: Fragment[]) => void;
  addFragment: (fragment: Fragment) => void;
  removeFragment: (fragmentId: string) => void;
  setEnergySphereTraits: (patch: Partial<EnergySphereTraits>) => void;
  addMindTag: (tag: string) => void;
  addShowcaseFile: (file: string) => void;
  removeShowcaseFile: (file: string) => void;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      computePower: 100,
      totalComputeMined: 100,
      fragments: [],
      energySphereTraits: {
        color: 0.62,
        roughness: 0.38,
        distortion: 0.24,
      },
      mindTags: ["模型训练", "文献阅读"],
      showcaseFiles: [],
      setComputeSnapshot: (balance, totalMined) => {
        if (!Number.isFinite(balance)) return;
        const normalizedBalance = Math.max(0, Math.round(balance));
        const normalizedTotal = Number.isFinite(totalMined ?? Number.NaN)
          ? Math.max(normalizedBalance, Math.round(totalMined as number))
          : undefined;
        set((state) => ({
          computePower: normalizedBalance,
          totalComputeMined: normalizedTotal ?? Math.max(state.totalComputeMined, normalizedBalance),
        }));
      },
      addComputePower: (amount) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const delta = Math.round(amount);
        set((state) => ({
          computePower: state.computePower + delta,
          totalComputeMined: state.totalComputeMined + delta,
        }));
      },
      setComputePower: (amount) => {
        if (!Number.isFinite(amount)) return;
        const normalized = Math.max(0, Math.round(amount));
        set((state) => ({
          computePower: normalized,
          totalComputeMined: Math.max(state.totalComputeMined, normalized),
        }));
      },
      spendComputePower: (amount) => {
        if (!Number.isFinite(amount) || amount <= 0) return false;
        const balance = get().computePower;
        if (balance < amount) return false;
        set({ computePower: balance - amount });
        return true;
      },
      setFragments: (fragments) => {
        const normalized = fragments
          .filter((fragment) => fragment.id.trim().length > 0)
          .map((fragment) => ({
            id: fragment.id.trim(),
            type: fragment.type,
            rarity: fragment.rarity,
            timestamp: fragment.timestamp,
          }));
        set({ fragments: normalized });
      },
      addFragment: (fragment) => {
        const normalizedId = fragment.id.trim();
        if (!normalizedId) return;
        set((state) => {
          const next = [
            { ...fragment, id: normalizedId },
            ...state.fragments.filter((item) => item.id !== normalizedId),
          ];
          return { fragments: next };
        });
      },
      removeFragment: (fragmentId) => {
        const normalizedId = fragmentId.trim();
        if (!normalizedId) return;
        set((state) => ({
          fragments: state.fragments.filter((item) => item.id !== normalizedId),
        }));
      },
      setEnergySphereTraits: (patch) => {
        set((state) => ({
          energySphereTraits: {
            color: clamp01(patch.color ?? state.energySphereTraits.color),
            roughness: clamp01(patch.roughness ?? state.energySphereTraits.roughness),
            distortion: clamp01(patch.distortion ?? state.energySphereTraits.distortion),
          },
        }));
      },
      addMindTag: (tag) => {
        const normalized = tag.trim();
        if (!normalized) return;
        set((state) => {
          const next = [normalized, ...state.mindTags.filter((x) => x !== normalized)];
          return { mindTags: next.slice(0, 12) };
        });
      },
      addShowcaseFile: (file) => {
        const normalized = file.trim();
        if (!normalized) return;
        set((state) => {
          if (state.showcaseFiles.includes(normalized)) return state;
          return { showcaseFiles: [normalized, ...state.showcaseFiles].slice(0, 12) };
        });
      },
      removeShowcaseFile: (file) => {
        set((state) => ({ showcaseFiles: state.showcaseFiles.filter((x) => x !== file) }));
      },
    }),
    {
      name: "edumeta-user-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        computePower: state.computePower,
        totalComputeMined: state.totalComputeMined,
        fragments: state.fragments,
        mindTags: state.mindTags,
        showcaseFiles: state.showcaseFiles,
        energySphereTraits: state.energySphereTraits,
      }),
    }
  )
);
