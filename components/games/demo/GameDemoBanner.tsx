"use client";

import { FlaskConical } from "lucide-react";

export default function GameDemoBanner() {
  return (
    <div className="mb-5 rounded-[20px] border border-violet-200 bg-violet-50 p-4">
      <div className="flex items-start gap-3">
        <FlaskConical
          size={22}
          className="shrink-0 text-violet-700"
        />

        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-700/60">
            Modalità Demo
          </p>

          <p className="mt-1 text-sm font-bold leading-5 text-[#06142E]">
            I dati mostrati sono inventati. Nessuna scelta viene salvata e Firebase non viene modificato.
          </p>
        </div>
      </div>
    </div>
  );
}
