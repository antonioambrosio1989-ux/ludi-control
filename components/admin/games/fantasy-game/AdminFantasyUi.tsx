"use client";

import type {
  CreateFantasyPlayerInput,
} from "@/src/types/FantasyPlayer";

export function StatCard({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-[18px] bg-[#06142E] p-4 text-white">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>

      <p className="mt-2 truncate text-lg font-black uppercase">
        {value}
      </p>
    </div>
  );
}

export function MiniStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-[14px] bg-[#F5F5F2] p-3">
      <p className="text-[9px] font-black uppercase text-[#06142E]/35">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-[#06142E]">
        {value}
      </p>
    </div>
  );
}

export function getFantasySeasonStatusLabel(
  status:
    string,
): string {
  switch (
    status
  ) {
    case "prelaunch":
      return "Pre-lancio";

    case "player_list_draft":
      return "Listone";

    case "rosters_open":
      return "Rose aperte";

    case "rosters_locked":
      return "Rose chiuse";

    case "active":
      return "Attivo";

    case "completed":
      return "Concluso";

    default:
      return status;
  }
}

export function getFantasyRoleLabel(
  role:
    CreateFantasyPlayerInput["role"],
): string {
  switch (
    role
  ) {
    case "goalkeeper":
      return "Portiere";

    case "defender":
      return "Difensore";

    case "forward":
      return "Attaccante";

    default:
      return role;
  }
}

export function getFantasyAvailabilityStyle(
  status:
    string,
): string {
  switch (
    status
  ) {
    case "eligible":
      return "bg-emerald-100 text-emerald-800";

    case "left_tournament":
      return "bg-amber-100 text-amber-800";

    case "team_withdrawn":
      return "bg-red-100 text-red-700";

    default:
      return "bg-[#06142E]/[0.06] text-[#06142E]/55";
  }
}
