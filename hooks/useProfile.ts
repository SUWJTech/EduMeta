"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type Profile = {
  id: string;
  compute_power: number;
  total_compute_mined: number;
  focus_hours: number;
  academic: number;
  tech: number;
  social: number;
};

type ProfileRow = {
  id: string;
  compute_power?: number | string | null;
  total_compute_mined?: number | string | null;
  focus_hours: number | string | null;
  academic?: number | string | null;
  tech?: number | string | null;
  social?: number | string | null;
};

function toNumber(v: number | string | null | undefined, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  return typeof v === "number" ? v : Number.parseFloat(v);
}

export function useProfile(userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchProfile = async () => {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle<ProfileRow>();

      if (!active) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile({
        id: data.id,
        compute_power: toNumber(data.compute_power, 0),
        total_compute_mined: toNumber(data.total_compute_mined, toNumber(data.compute_power, 0)),
        focus_hours: toNumber(data.focus_hours, 0),
        academic: toNumber(data.academic, 0),
        tech: toNumber(data.tech, 0),
        social: toNumber(data.social, 0),
      });
      setLoading(false);
    };

    void fetchProfile();

    const channel = supabase
      .channel(`profiles:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        () => {
          void fetchProfile();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return { profile, loading, error };
}
