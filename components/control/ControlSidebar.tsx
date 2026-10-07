"use client";

import Link from "next/link";

import {
  useState,
} from "react";

import {
  Menu,
  X,
} from "lucide-react";

import {
  usePathname,
} from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups:
  NavGroup[] = [
    {
      label: "Dashboard",
      items: [
        { label: "Centro di controllo", href: "/admin", icon: "⌂" },
        { label: "Operativo", href: "/admin/operativo", icon: "⚡" },
      ],
    },
    {
      label: "Competizione",
      items: [
        { label: "Partite", href: "/admin/partite", icon: "⚽" },
        { label: "Calendario", href: "/admin/calendario", icon: "◫" },
        { label: "Squadre", href: "/admin/squadre", icon: "◆" },
        { label: "Rose", href: "/admin/rose", icon: "♟" },
        { label: "Giocatori", href: "/admin/giocatori", icon: "●" },
        { label: "Ludi Week", href: "/admin/ludi-week", icon: "✦" },
      ],
    },
    {
      label: "Fasi finali",
      items: [
        { label: "Calendario", href: "/admin/fasi-finali/calendario", icon: "🏆" },
        { label: "Rose fasi finali", href: "/admin/fasi-finali/rose", icon: "♜" },
      ],
    },
    {
      label: "Contenuti",
      items: [
        { label: "Comunicati", href: "/admin/comunicati", icon: "▤" },
        { label: "News", href: "/admin/news", icon: "▦" },
        { label: "Ludi Studio", href: "/admin/ludi-studio", icon: "▣" },
        { label: "FUT Card Editor", href: "/admin/fut-card-editor", icon: "◈" },
        { label: "Ludi TV", href: "/admin/ludi-tv", icon: "▶" },
        { label: "Video", href: "/admin/video", icon: "▷" },
        { label: "Sponsor", href: "/admin/sponsor", icon: "★" },
      ],
    },
    {
      label: "Games",
      items: [
        { label: "Gestione Games", href: "/admin/games", icon: "🎮" },
      ],
    },
    {
      label: "Archivio",
      items: [
        { label: "Hall of Fame", href: "/admin/hall-of-fame", icon: "♛" },
        { label: "Albo d'oro", href: "/admin/albo-doro", icon: "🏅" },
        { label: "All Times Goalscorers", href: "/admin/all-times-goalscorers", icon: "◎" },
        { label: "Best of the Month", href: "/admin/best-of-the-month", icon: "✦" },
      ],
    },
    {
      label: "Sistema",
      items: [
        { label: "Stagioni", href: "/admin/stagioni", icon: "◉" },
        { label: "Chiusura stagione", href: "/admin/stagioni/chiusura", icon: "✓" },
        { label: "Regolamento", href: "/admin/regolamento", icon: "≡" },
        { label: "Utenti", href: "/admin/utenti", icon: "♙" },
        { label: "Elaborazioni", href: "/admin/elaborazioni", icon: "⚙" },
        { label: "Impostazioni", href: "/admin/impostazioni", icon: "◌" },
      ],
    },
  ];

function isActive(
  pathname: string,
  href: string,
) {
  if (
    href ===
    "/admin"
  ) {
    return pathname ===
      "/admin";
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}

export default function ControlSidebar() {
  const pathname =
    usePathname();

  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false);

  return (
    <>
      <aside className="hidden min-h-[100dvh] w-[280px] shrink-0 border-r border-white/10 bg-[#06142E] text-white lg:block">
        <div className="sticky top-0 max-h-[100dvh] overflow-y-auto px-5 py-6">
          <Link
            href="/admin"
            className="block rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
              Ludis League
            </p>

            <p className="mt-1 text-xl font-black uppercase tracking-[-0.02em]">
              Ludi Control
            </p>

            <p className="mt-1 text-xs font-bold text-white/45">
              Centro di Controllo
            </p>
          </Link>

          <ControlNavigation
            pathname={pathname}
          />
        </div>
      </aside>

      <div className="border-b border-white/10 bg-[#06142E] px-4 py-3 text-white lg:hidden">
        <div className="mx-auto flex w-full items-center justify-between gap-3">
          <Link
            href="/admin"
            className="min-w-0"
          >
            <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
              Ludis League
            </p>

            <p className="truncate text-sm font-black uppercase">
              Ludi Control
            </p>
          </Link>

          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                true,
              )
            }
            aria-label="Apri menu Control"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-white/15 bg-white/10"
          >
            <Menu
              size={21}
            />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            aria-label="Chiudi menu"
            onClick={() =>
              setMobileOpen(
                false,
              )
            }
            className="absolute inset-0 bg-black/45"
          />

          <aside className="absolute inset-y-0 left-0 w-[min(88vw,340px)] overflow-y-auto bg-[#06142E] px-5 py-5 text-white shadow-[20px_0_60px_rgba(0,0,0,0.25)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <Link
                href="/admin"
                onClick={() =>
                  setMobileOpen(
                    false,
                  )
                }
                className="min-w-0"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                  Ludis League
                </p>

                <p className="mt-1 text-lg font-black uppercase">
                  Ludi Control
                </p>
              </Link>

              <button
                type="button"
                onClick={() =>
                  setMobileOpen(
                    false,
                  )
                }
                aria-label="Chiudi menu Control"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-white/15 bg-white/10"
              >
                <X
                  size={20}
                />
              </button>
            </div>

            <ControlNavigation
              pathname={pathname}
              onNavigate={() =>
                setMobileOpen(
                  false,
                )
              }
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}


function ControlNavigation({
  pathname,
  onNavigate,
}: {
  pathname:
    string;

  onNavigate?:
    () => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      {groups.map(
        (group) => (
          <section
            key={
              group.label
            }
          >
            <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
              {
                group.label
              }
            </p>

            <nav className="space-y-1">
              {group.items.map(
                (
                  item,
                ) => {
                  const active =
                    isActive(
                      pathname,
                      item.href,
                    );

                  return (
                    <Link
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      onClick={
                        onNavigate
                      }
                      className={[
                        "flex min-h-11 items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-black transition",
                        active
                          ? "bg-white text-[#06142E]"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      ].join(
                        " ",
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-current/10 text-base"
                      >
                        {
                          item.icon
                        }
                      </span>

                      <span className="min-w-0 truncate">
                        {
                          item.label
                        }
                      </span>
                    </Link>
                  );
                },
              )}
            </nav>
          </section>
        ),
      )}
    </div>
  );
}
