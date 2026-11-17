"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

type Suggestion = { id: string; teamName: string; name: string };

export default function LineupRosterSuggestionsCard({ seasonId }: { seasonId?: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const currentSeasonId = seasonId?.trim() ?? "";

  useEffect(() => {
    if (!currentSeasonId) return;
    return onSnapshot(query(collection(db, "lineupRosterSuggestions"),
      where("seasonId", "==", currentSeasonId)), snapshot => {
      const pending = snapshot.docs.flatMap(doc => {
        const data = doc.data();
        if (data.status !== "pending" || typeof data.name !== "string" ||
            !data.name.trim() || typeof data.teamName !== "string" || !data.teamName.trim()) return [];
        return [{ id: doc.id, name: data.name.trim(), teamName: data.teamName.trim() }];
      });
      pending.sort((a,b) => a.teamName.localeCompare(b.teamName, "it") || a.name.localeCompare(b.name,"it"));
      setSuggestions(pending);
      setError("");
    }, () => setError("Impossibile caricare i nuovi giocatori da verificare."));
  }, [currentSeasonId]);

  if (!currentSeasonId || (!suggestions.length && !error)) return null;
  return (
    <section className="mb-5" aria-label="Nuovi giocatori da verificare">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">Formazioni WhatsApp</p>
          <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">Nuovi giocatori da verificare</h2>
        </div>
        {!!suggestions.length && <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-800">{suggestions.length}</span>}
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      <div className="space-y-2">
        {suggestions.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[13px] border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm font-black text-[#06142E]">{item.name}</span>
          <span className="text-xs font-bold text-[#06142E]/65">{item.teamName}</span>
        </article>)}
      </div>
      {!!suggestions.length && <p className="mt-3 text-xs font-semibold text-[#06142E]/55">Per correggere o approvare un nominativo usa esclusivamente Gestione manuale formazioni.</p>}
    </section>
  );
}
