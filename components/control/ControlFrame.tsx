"use client";

import {
  usePathname,
} from "next/navigation";

import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import ControlSidebar from "./ControlSidebar";

type Props = {
  children:
    React.ReactNode;
};

export default function ControlFrame({
  children,
}: Props) {
  const pathname =
    usePathname();

  const {
    selectedCompetition,
    currentSeason,
  } =
    useCompetition();

  if (
    pathname ===
    "/admin/login"
  ) {
    return children;
  }

  const isLiveCenter = pathname === "/admin/live-center";

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F4F6F8] text-[#06142E] lg:flex-row">
      <ControlSidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-40 shrink-0 border-b border-[#06142E]/10 bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 w-full max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[#06142E]/35">
                Centro di Controllo
              </p>

              <p className="truncate text-sm font-black text-[#06142E]">
                {isLiveCenter ? "Tutte le competizioni" : selectedCompetition?.name ??
                  "Ludis League"}
                {!isLiveCenter && currentSeason?.name
                  ? ` · ${currentSeason.name}`
                  : ""}
              </p>
            </div>

            <AdminLogoutButton />
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <main className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
