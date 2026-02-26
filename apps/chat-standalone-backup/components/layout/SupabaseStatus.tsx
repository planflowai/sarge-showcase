"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function SupabaseStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2">
      {connected ? (
        <>
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] text-zinc-500">Supabase Connected</span>
        </>
      ) : (
        <>
          <XCircle className="h-3 w-3 text-red-500" />
          <span className="text-[10px] text-zinc-500">Supabase Disconnected</span>
        </>
      )}
    </div>
  );
}
