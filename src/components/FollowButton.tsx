"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import WelcomeGateModal from "@/components/WelcomeGateModal";

// Follow/unfollow a business ("vendor") or person ("user"). The follower count
// updates live via Supabase Realtime, so it ticks up/down on the public page as
// others follow. Guests are prompted to create a free profile first.
export default function FollowButton({
  targetType, targetId, size = "md",
}: {
  targetType: "vendor" | "user";
  targetId: string;
  size?: "sm" | "md";
}) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);

  const refetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    setCount(c ?? 0);
  }, [supabase, targetType, targetId]);

  useEffect(() => {
    let cancelled = false;
    refetchCount();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("follows").select("id")
        .eq("follower_id", user.id).eq("target_type", targetType).eq("target_id", targetId)
        .maybeSingle();
      if (!cancelled) setFollowing(!!data);
    });

    // Live count: any insert/delete for this target refreshes the tally
    const channel = supabase
      .channel(`follows:${targetType}:${targetId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `target_id=eq.${targetId}` },
        () => refetchCount())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supabase, targetType, targetId, refetchCount]);

  async function toggle() {
    if (!userId) { setGate(true); return; }
    if (busy) return;
    setBusy(true);
    if (following) {
      setFollowing(false); setCount((c) => Math.max(0, c - 1));
      await supabase.from("follows").delete()
        .eq("follower_id", userId).eq("target_type", targetType).eq("target_id", targetId);
    } else {
      setFollowing(true); setCount((c) => c + 1);
      await supabase.from("follows").insert({ follower_id: userId, target_type: targetType, target_id: targetId });
    }
    setBusy(false);
  }

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className={`font-bold rounded-full transition-colors ${pad} ${
          following
            ? "bg-green-600 text-white hover:bg-green-700"
            : "border-2 border-green-600 text-green-700 hover:bg-green-50"
        }`}
      >
        {following ? "♥ Following" : "♡ Follow"}
      </button>
      <span className={`text-gray-500 ${size === "sm" ? "text-xs" : "text-sm"}`}>
        <span className="font-bold text-gray-900">{count.toLocaleString()}</span> {count === 1 ? "follower" : "followers"}
      </span>
      <WelcomeGateModal open={gate} next={typeof window !== "undefined" ? window.location.pathname : undefined} onClose={() => setGate(false)} />
    </div>
  );
}
