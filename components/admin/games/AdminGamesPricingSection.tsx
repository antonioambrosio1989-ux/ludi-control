"use client";

import type {
  GamesPassPricePeriodInput,
} from "@/src/types/GamesSeason";

import type {
  useAdminGamesSeasons,
} from "@/src/hooks/useAdminGamesSeasons";

import {
  toGamesDate,
} from "@/src/services/games/GamesSeasonStatusService";

type ManagedGamesSeason =
  ReturnType<
    typeof useAdminGamesSeasons
  >["managedGamesSeason"];

type Props = {
  managedGamesSeason:
    ManagedGamesSeason;

  isEditingPricing:
    boolean;

  pricingDrafts:
    GamesPassPricePeriodInput[];

  isSaving:
    boolean;

  onOpenPricingEditor:
    () => void;

  onAddPricePeriod:
    () => void;

  onRemovePricePeriod:
    (
      index:
        number,
    ) => void;

  onUpdatePricePeriod:
    (
      index:
        number,

      changes:
        Partial<
          GamesPassPricePeriodInput
        >,
    ) => void;

  onCancelPricingEditor:
    () => void;

  onSavePricing:
    () => void | Promise<void>;
};

export default function AdminGamesPricingSection({
  managedGamesSeason,
  isEditingPricing,
  pricingDrafts,
  isSaving,
  onOpenPricingEditor,
  onAddPricePeriod,
  onRemovePricePeriod,
  onUpdatePricePeriod,
  onCancelPricingEditor,
  onSavePricing,
}: Props) {
  const handleOpenPricingEditor =
    onOpenPricingEditor;

  const handleAddPricePeriod =
    onAddPricePeriod;

  const handleRemovePricePeriod =
    onRemovePricePeriod;

  const handleUpdatePricePeriod =
    onUpdatePricePeriod;

  const setIsEditingPricing =
    (
      next:
        boolean,
    ) => {
      if (
        !next
      ) {
        onCancelPricingEditor();
      }
    };

  const handleSavePricing =
    onSavePricing;

  return (
        <section className="rounded-[24px] bg-white p-6 shadow-[0_12px_30px_rgba(6,20,46,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                Accesso Games
              </p>

              <h2 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
                Games Pass
              </h2>

              <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
                Il Games Pass stagionale abilita la partecipazione a tutti i giochi della Games Season.
              </p>
            </div>

            {managedGamesSeason && (
              <button
                type="button"
                onClick={
                  handleOpenPricingEditor
                }
                className="shrink-0 rounded-[12px] bg-[#06142E] px-4 py-3 text-[10px] font-black uppercase text-white"
              >
                Modifica prezzi
              </button>
            )}
          </div>

          {!managedGamesSeason ? (
            <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
              <p className="text-sm font-bold text-[#06142E]/45">
                Nessuna Games Season configurata.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <p className="text-xs font-black uppercase text-[#06142E]">
                  {managedGamesSeason.name}
                </p>

                {managedGamesSeason.passPricing.length ===
                  0 ? (
                  <div className="mt-3 rounded-[16px] bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-800">
                      Nessuna fascia prezzo configurata.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {managedGamesSeason.passPricing.map(
                      (
                        period,
                      ) => (
                        <div
                          key={
                            period.id
                          }
                          className="rounded-[16px] bg-[#F5F5F2] p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-black uppercase text-[#06142E]">
                                {period.name}
                              </p>

                              <p className="mt-1 text-xs font-bold text-[#06142E]/40">
                                {formatPricingPeriod(
                                  period.startsAt,
                                  period.endsAt,
                                )}
                              </p>
                            </div>

                            <p className="text-xl font-black text-[#06142E]">
                              {formatEuro(
                                period.priceCents,
                              )}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {isEditingPricing && (
                <div className="mt-6 border-t border-[#06142E]/10 pt-6">
                  <div className="space-y-5">
                    {pricingDrafts.map(
                      (
                        period,
                        index,
                      ) => (
                        <div
                          key={`${period.id}-${index}`}
                          className="rounded-[18px] border border-[#06142E]/10 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase text-[#06142E]">
                              Fascia {index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemovePricePeriod(
                                  index,
                                )
                              }
                              className="text-[10px] font-black uppercase text-red-600"
                            >
                              Rimuovi
                            </button>
                          </div>

                          <label className="mt-4 block">
                            <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                              Nome fascia
                            </span>

                            <input
                              type="text"
                              value={
                                period.name
                              }
                              onChange={(
                                event,
                              ) =>
                                handleUpdatePricePeriod(
                                  index,
                                  {
                                    name:
                                      event.target.value,

                                    id:
                                      createSlug(
                                        event.target.value,
                                      ) ||
                                      period.id,
                                  },
                                )
                              }
                              placeholder="Es. Early Pass"
                              className="mt-2 min-h-11 w-full rounded-[12px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none"
                            />
                          </label>

                          <label className="mt-4 block">
                            <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                              Prezzo €
                            </span>

                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={
                                period.priceCents /
                                100
                              }
                              onChange={(
                                event,
                              ) =>
                                handleUpdatePricePeriod(
                                  index,
                                  {
                                    priceCents:
                                      Math.round(
                                        Number(
                                          event.target.value,
                                        ) *
                                        100,
                                      ),
                                  },
                                )
                              }
                              className="mt-2 min-h-11 w-full rounded-[12px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none"
                            />
                          </label>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <DateField
                              label="Dal"
                              value={
                                formatDateInput(
                                  period.startsAt,
                                )
                              }
                              onChange={(
                                value,
                              ) =>
                                handleUpdatePricePeriod(
                                  index,
                                  {
                                    startsAt:
                                      parseDateInput(
                                        value,
                                      ),
                                  },
                                )
                              }
                            />

                            <DateField
                              label="Fino al"
                              value={
                                period.endsAt
                                  ? formatDateInput(
                                      period.endsAt,
                                    )
                                  : ""
                              }
                              onChange={(
                                value,
                              ) =>
                                handleUpdatePricePeriod(
                                  index,
                                  {
                                    endsAt:
                                      value
                                        ? parseDateInput(
                                            value,
                                          )
                                        : undefined,
                                  },
                                )
                              }
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleAddPricePeriod
                    }
                    className="mt-4 min-h-11 w-full rounded-[12px] border border-dashed border-[#06142E]/20 text-xs font-black uppercase text-[#06142E]"
                  >
                    + Aggiungi fascia
                  </button>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      disabled={
                        isSaving
                      }
                      onClick={() =>
                        setIsEditingPricing(
                          false,
                        )
                      }
                      className="min-h-12 flex-1 rounded-[13px] bg-[#06142E]/[0.06] px-4 text-xs font-black uppercase text-[#06142E]"
                    >
                      Annulla
                    </button>

                    <button
                      type="button"
                      disabled={
                        isSaving
                      }
                      onClick={() => {
                        void handleSavePricing();
                      }}
                      className="min-h-12 flex-1 rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:opacity-50"
                    >
                      {isSaving
                        ? "Salvataggio..."
                        : "Salva prezzi"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      value:
        string,
    ) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/50">
        {label}
      </span>

      <input
        type="date"
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-2 min-h-12 w-full rounded-[13px] border border-[#06142E]/10 bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none"
      />
    </label>
  );
}

function createSlug(
  value:
    string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function formatEuro(
  priceCents:
    number,
): string {
  return new Intl.NumberFormat(
    "it-IT",
    {
      style:
        "currency",

      currency:
        "EUR",
    },
  ).format(
    priceCents /
    100,
  );
}

function parseDateInput(
  value:
    string,
): Date {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(
        Number,
      );

  return new Date(
    year,
    month -
      1,
    day,
  );
}

function formatDateInput(
  date:
    Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function formatPricingPeriod(
  startsAt:
    unknown,

  endsAt:
    unknown,
): string {
  const start =
    toGamesDate(
      startsAt,
    );

  const end =
    toGamesDate(
      endsAt,
    );

  if (
    !start
  ) {
    return "Periodo non definito";
  }

  const formatter =
    new Intl.DateTimeFormat(
      "it-IT",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",
      },
    );

  if (
    !end
  ) {
    return `Dal ${formatter.format(
      start,
    )}`;
  }

  return `${formatter.format(
    start,
  )} – ${formatter.format(
    end,
  )}`;
}
