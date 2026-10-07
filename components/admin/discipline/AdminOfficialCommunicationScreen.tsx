"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import type {
  CommunicationClubFine,
  CommunicationSanction,
  OfficialCommunication,
} from "@/src/types/OfficialCommunication";

import {
  DisciplinaryPublicationSyncService,
} from "@/src/services/discipline/DisciplinaryPublicationSyncService";

import { DisciplinaryCommunicationService } from "@/src/services/discipline/DisciplinaryCommunicationService";

import { FirebaseOfficialCommunicationRepository } from "@/src/services/discipline/FirebaseOfficialCommunicationRepository";


export type DisciplinaryPlayerOption = {
  playerId: string;
  playerName: string;

  teamId: string;
  teamName: string;
};

type AdminOfficialCommunicationScreenProps = {
  seasonId: string;

  matchweek: number;

  playerOptions:
    DisciplinaryPlayerOption[];
};

type EditableSanctionSection =
  | "judgeSanctions"
  | "directRedSanctions"
  | "accumulationSanctions";

const EMPTY_MANUAL_SANCTION: CommunicationSanction = {
  id: "",
  playerId: "",
  playerName: "",
  teamId: undefined,
  teamName: "",
  suspensionMatches: 1,
  reason: "",
};

const EMPTY_CLUB_FINE: CommunicationClubFine = {
  id: "",
  teamId: undefined,
  teamName: "",
  type: "other",
  amount: undefined,
  reason: "",
};

export default function AdminOfficialCommunicationScreen({
  seasonId,
  matchweek,
  playerOptions,
}: AdminOfficialCommunicationScreenProps) {
  const [communication, setCommunication] =
    useState<OfficialCommunication | null>(null);

  const [manualSanction, setManualSanction] =
    useState<CommunicationSanction>(
      EMPTY_MANUAL_SANCTION,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isPublishing, setIsPublishing] =
    useState(false);

  const [clubFine, setClubFine] =
  useState<CommunicationClubFine>(
    EMPTY_CLUB_FINE,
  );

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const communicationTitle = useMemo(
    () =>
      `Comunicato disciplinare — Matchweek ${matchweek}`,
    [matchweek],
  );

  useEffect(() => {
  let isCancelled = false;

  FirebaseOfficialCommunicationRepository
    .getBySeasonAndMatchweek({
      seasonId,
      matchweek,
    })
    .then((existingCommunication) => {
      if (isCancelled) {
        return;
      }

      setCommunication(
        existingCommunication,
      );

      setIsLoading(false);
    })
    .catch((loadError) => {
      console.error(loadError);

      if (isCancelled) {
        return;
      }

      setError(
        "Non è stato possibile caricare il comunicato.",
      );

      setIsLoading(false);
    });

  return () => {
    isCancelled = true;
  };
}, [seasonId, matchweek]);

  async function handleGenerateDraft() {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result =
        await DisciplinaryCommunicationService.generateDraft(
  {
    seasonId,
    matchweek,

            judgeSanctions:
              communication?.judgeSanctions ??
              [],
            clubFines:
              communication?.clubFines ??
              [],
          },
        );

      const generatedCommunication = {
        ...result.communication,

        title:
          communication?.title?.trim() ||
          result.communication.title,
      };

      const communicationId =
        await FirebaseOfficialCommunicationRepository.saveDraft(
          generatedCommunication,
        );

      setCommunication({
        ...generatedCommunication,
        id: communicationId,
      });

      setSuccessMessage(
        "Bozza del comunicato generata correttamente.",
      );
    } catch (generateError) {
      console.error(generateError);

      setError(
        generateError instanceof Error
          ? generateError.message
          : "Non è stato possibile generare il comunicato.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDraft() {
    if (!communication) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await FirebaseOfficialCommunicationRepository.updateDraft(
        {
          ...communication,
          status: "draft",
        },
      );

      setCommunication((current) =>
        current
          ? {
              ...current,
              status: "draft",
            }
          : current,
      );

      setSuccessMessage(
        "Bozza salvata correttamente.",
      );
    } catch (saveError) {
      console.error(saveError);

      setError(
        "Non è stato possibile salvare la bozza.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!communication) {
      return;
    }

    setIsPublishing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      /*
 * Prima sincronizziamo le vere
 * squalifiche disciplinari.
 *
 * Soltanto dopo rendiamo pubblico
 * il comunicato.
 */
await DisciplinaryPublicationSyncService
  .sync({
    communication,
  });
  
  await FirebaseOfficialCommunicationRepository.publish(
        communication,
      );

      setCommunication((current) =>
        current
          ? {
              ...current,
              status: "published",
              publishedAt:
                new Date().toISOString(),
            }
          : current,
      );

      setSuccessMessage(
        "Comunicato pubblicato correttamente.",
      );
    } catch (publishError) {
      console.error(publishError);

      setError(
        "Non è stato possibile pubblicare il comunicato.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!communication) {
      return;
    }

    setIsPublishing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await FirebaseOfficialCommunicationRepository.unpublish(
        communication.id,
      );

      setCommunication((current) =>
        current
          ? {
              ...current,
              status: "draft",
              publishedAt: undefined,
            }
          : current,
      );

      setSuccessMessage(
        "Il comunicato è tornato in bozza.",
      );
    } catch (unpublishError) {
      console.error(unpublishError);

      setError(
        "Non è stato possibile riportare il comunicato in bozza.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function handleAddManualSanction() {
    const playerName =
      manualSanction.playerName.trim();

    const teamName =
      manualSanction.teamName.trim();

    if (
  !manualSanction.playerId.trim() ||
  !manualSanction.teamId?.trim()
) {
  setError(
    "Seleziona un giocatore della rosa stagionale.",
  );

  return;
}

if (!playerName) {
      setError(
        "Inserisci il nome del giocatore.",
      );

      return;
    }

    if (!teamName) {
      setError(
        "Inserisci il nome della squadra.",
      );

      return;
    }

    const newSanction: CommunicationSanction =
      {
        ...manualSanction,

        id:
          manualSanction.id ||
          createLocalId(),

        playerId:
  manualSanction.playerId,

teamId:
  manualSanction.teamId,

        playerName,

        teamName,

        suspensionMatches:
          sanitizeSuspensionMatches(
            manualSanction.suspensionMatches,
          ),

        reason:
          manualSanction.reason?.trim() ||
          "Provvedimento del giudice sportivo",
      };

    setCommunication((current) => {
      const baseCommunication =
        current ??
        createEmptyCommunication({
          seasonId,
          matchweek,
          title:
            communicationTitle,
        });

      return {
        ...baseCommunication,

        judgeSanctions: [
          ...baseCommunication.judgeSanctions,
          newSanction,
        ],
      };
    });

    setManualSanction({
      ...EMPTY_MANUAL_SANCTION,
    });

    setError(null);
    setSuccessMessage(
      "Provvedimento aggiunto. Salva la bozza per confermare.",
    );
  }

  function handleSanctionMatchesChange({
    section,
    sanctionId,
    value,
  }: {
    section: EditableSanctionSection;
    sanctionId: string;
    value: number;
  }) {
    setCommunication((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        [section]: current[
          section
        ].map((sanction) =>
          sanction.id === sanctionId
            ? {
                ...sanction,

                suspensionMatches:
                  sanitizeSuspensionMatches(
                    value,
                  ),
              }
            : sanction,
        ),
      };
    });
  }

  function handleSanctionReasonChange({
    section,
    sanctionId,
    value,
  }: {
    section: EditableSanctionSection;
    sanctionId: string;
    value: string;
  }) {
    setCommunication((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        [section]: current[
          section
        ].map((sanction) =>
          sanction.id === sanctionId
            ? {
                ...sanction,
                reason: value,
              }
            : sanction,
        ),
      };
    });
  }

  function handleRemoveManualSanction(
    sanctionId: string,
  ) {
    setCommunication((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        judgeSanctions:
          current.judgeSanctions.filter(
            (sanction) =>
              sanction.id !==
              sanctionId,
          ),
      };
    });

    setSuccessMessage(
      "Provvedimento rimosso. Salva la bozza per confermare.",
    );
  }

  function handleAddClubFine() {
  const teamName =
    clubFine.teamName.trim();

  const reason =
    clubFine.reason.trim();

  if (!teamName) {
    setError(
      "Inserisci il nome della società.",
    );
    return;
  }

  if (!reason) {
    setError(
      "Inserisci la motivazione dell’ammenda.",
    );
    return;
  }

  const newFine: CommunicationClubFine = {
    ...clubFine,

    id:
      clubFine.id ||
      createLocalId(),

    teamName,

    amount:
      clubFine.amount !== undefined &&
      Number.isFinite(
        clubFine.amount,
      ) &&
      clubFine.amount >= 0
        ? clubFine.amount
        : undefined,

    reason,
  };

  setCommunication((current) => {
    const baseCommunication =
      current ??
      createEmptyCommunication({
        seasonId,
        matchweek,
        title:
          communicationTitle,
      });

    return {
      ...baseCommunication,

      clubFines: [
        ...baseCommunication.clubFines,
        newFine,
      ],
    };
  });

  setClubFine({
    ...EMPTY_CLUB_FINE,
  });

  setError(null);

  setSuccessMessage(
    "Ammenda aggiunta. Salva la bozza per confermare.",
  );
}

function handleRemoveClubFine(
  fineId: string,
) {
  setCommunication((current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,

      clubFines:
        current.clubFines.filter(
          (fine) =>
            fine.id !== fineId,
        ),
    };
  });

  setSuccessMessage(
    "Ammenda rimossa. Salva la bozza per confermare.",
  );
}

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell>
        {/* HEADER */}
      <header className="mt-6 mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Giudice sportivo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Comunicato disciplinare
          </h1>

          <p className="mt-1 max-w-2xl text-sm font-bold text-[#06142E]/50">
            Matchweek {matchweek}
          </p>

      </header>

      {error ? (
        <MessageBox
          type="error"
          message={error}
        />
      ) : null}

      {successMessage ? (
        <MessageBox
          type="success"
          message={successMessage}
        />
      ) : null}

      <section>
        <h2 className="text-base font-black text-[#06142E]">
          Generazione automatica
        </h2>

        <p className="mt-2 text-sm font-semibold leading-6 text-[#06142E]/55">
          Il sistema analizzerà i Match
          Report della giornata, i rossi
          diretti, la somma delle
          ammonizioni, le diffide e le
          squalifiche residue.
        </p>

        <button
          type="button"
          onClick={
            handleGenerateDraft
          }
          disabled={
            isGenerating ||
            isSaving ||
            isPublishing
          }
          className="mt-5 w-full rounded-[16px] bg-[#146BFF] px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating
            ? "Generazione in corso..."
            : communication
              ? "Rigenera comunicato"
              : "Genera comunicato"}
        </button>
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
        <SectionHeader
          title="Giocatori squalificati dal giudice sportivo"
          subtitle="Sezione compilata manualmente"
        />

        <div className="space-y-4 p-5">
          <ManualSanctionForm
            sanction={
              manualSanction
            }
            playerOptions={
  playerOptions
}
            onChange={
              setManualSanction
            }
            onAdd={
              handleAddManualSanction
            }
          />

          <SanctionsList
            sanctions={
              communication?.judgeSanctions ??
              []
            }
            emptyText="Nessun giocatore"
            editable
            removable
            onMatchesChange={(
              sanctionId,
              value,
            ) =>
              handleSanctionMatchesChange(
                {
                  section:
                    "judgeSanctions",
                  sanctionId,
                  value,
                },
              )
            }
            onReasonChange={(
              sanctionId,
              value,
            ) =>
              handleSanctionReasonChange(
                {
                  section:
                    "judgeSanctions",
                  sanctionId,
                  value,
                },
              )
            }
            onRemove={
              handleRemoveManualSanction
            }
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
        <SectionHeader
          title="Squalifica per rosso diretto"
          subtitle="1 giornata predefinita, modificabile"
        />

        <div className="p-5">
          <SanctionsList
            sanctions={
              communication?.directRedSanctions ??
              []
            }
            emptyText="Nessun giocatore"
            editable
            onMatchesChange={(
              sanctionId,
              value,
            ) =>
              handleSanctionMatchesChange(
                {
                  section:
                    "directRedSanctions",
                  sanctionId,
                  value,
                },
              )
            }
            onReasonChange={(
              sanctionId,
              value,
            ) =>
              handleSanctionReasonChange(
                {
                  section:
                    "directRedSanctions",
                  sanctionId,
                  value,
                },
              )
            }
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
        <SectionHeader
          title="Squalifica per somma di ammonizioni"
          subtitle="Raggiungimento di 5 cartellini gialli"
        />

        <div className="p-5">
          <SanctionsList
            sanctions={
              communication?.accumulationSanctions ??
              []
            }
            emptyText="Nessun giocatore"
            editable
            onMatchesChange={(
              sanctionId,
              value,
            ) =>
              handleSanctionMatchesChange(
                {
                  section:
                    "accumulationSanctions",
                  sanctionId,
                  value,
                },
              )
            }
            onReasonChange={(
              sanctionId,
              value,
            ) =>
              handleSanctionReasonChange(
                {
                  section:
                    "accumulationSanctions",
                  sanctionId,
                  value,
                },
              )
            }
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
        <SectionHeader
          title="Giocatori in diffida"
          subtitle="4 cartellini gialli nel ciclo disciplinare"
        />

        <div className="p-5">
          <WarningsList
            warnings={
              communication?.warnings ??
              []
            }
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
  <SectionHeader
    title="Ammende a carico delle società"
    subtitle="Provvedimenti economici e partite perse a tavolino"
  />

  <div className="space-y-4 p-5">
    <ClubFineForm
      fine={clubFine}
      onChange={setClubFine}
      onAdd={handleAddClubFine}
    />

    <ClubFinesList
      fines={
        communication?.clubFines ??
        []
      }
      onRemove={
        handleRemoveClubFine
      }
    />
  </div>
</section>

      {communication ? (
        <section className="rounded-[24px] bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/45">
              Titolo del comunicato
            </span>

            <input
              type="text"
              value={
                communication.title
              }
              onChange={(event) =>
                setCommunication(
                  (current) =>
                    current
                      ? {
                          ...current,
                          title:
                            event
                              .target
                              .value,
                        }
                      : current,
                )
              }
              className="mt-2 w-full rounded-[14px] border border-[#06142E]/10 bg-[#F4F7FB] px-4 py-3 text-sm font-bold text-[#06142E] outline-none focus:border-[#146BFF]"
            />
          </label>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={
                handleSaveDraft
              }
              disabled={
                isSaving ||
                isGenerating ||
                isPublishing
              }
              className="rounded-[16px] bg-[#E9EEF6] px-4 py-3 text-sm font-black text-[#06142E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Salvataggio..."
                : "Salva bozza"}
            </button>

            {communication.status ===
            "published" ? (
              <button
                type="button"
                onClick={
                  handleUnpublish
                }
                disabled={
                  isPublishing ||
                  isSaving ||
                  isGenerating
                }
                className="rounded-[16px] bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPublishing
                  ? "Aggiornamento..."
                  : "Torna in bozza"}
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  handlePublish
                }
                disabled={
                  isPublishing ||
                  isSaving ||
                  isGenerating
                }
                className="rounded-[16px] bg-[#146BFF] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPublishing
                  ? "Pubblicazione..."
                  : "Pubblica"}
              </button>
            )}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-[#06142E]/8 px-5 py-4">
      <h2 className="text-base font-black text-[#06142E]">
        {title}
      </h2>

      <p className="mt-1 text-xs font-bold text-[#06142E]/45">
        {subtitle}
      </p>
    </div>
  );
}

function ManualSanctionForm({
  sanction,
  playerOptions,
  onChange,
  onAdd,
}: {
  sanction: CommunicationSanction;

  playerOptions:
    DisciplinaryPlayerOption[];

  onChange: (
    value: CommunicationSanction,
  ) => void;

  onAdd: () => void;
}) {
  return (
    <div className="rounded-[18px] bg-[#F4F7FB] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
    Giocatore
  </span>

  <select
    value={
      sanction.playerId &&
      sanction.teamId
        ? `${sanction.playerId}::${sanction.teamId}`
        : ""
    }
    onChange={(event) => {
      const selected =
        playerOptions.find(
          (
            option,
          ) =>
            `${option.playerId}::${option.teamId}` ===
            event.target.value,
        );

      if (
        !selected
      ) {
        onChange({
          ...sanction,

          playerId:
            "",

          playerName:
            "",

          teamId:
            undefined,

          teamName:
            "",
        });

        return;
      }

      onChange({
        ...sanction,

        playerId:
          selected.playerId,

        playerName:
          selected.playerName,

        teamId:
          selected.teamId,

        teamName:
          selected.teamName,
      });
    }}
    className="mt-1 w-full rounded-[12px] border border-[#06142E]/10 bg-white px-3 py-2 text-sm font-black text-[#06142E] outline-none"
  >
    <option value="">
      Seleziona giocatore
    </option>

    {playerOptions.map(
      (
        option,
      ) => (
        <option
          key={`${option.playerId}::${option.teamId}`}
          value={`${option.playerId}::${option.teamId}`}
        >
          {option.playerName} — {option.teamName}
        </option>
      ),
    )}
  </select>
</label>

<label>
  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
    Squadra
  </span>

  <div className="mt-1 min-h-[38px] rounded-[12px] border border-[#06142E]/10 bg-[#E9EEF5] px-3 py-2 text-sm font-black text-[#06142E]">
    {sanction.teamName ||
      "Seleziona prima il giocatore"}
  </div>
</label>

        <AdminNumberInput
          label="Giornate"
          value={
            sanction.suspensionMatches
          }
          onChange={(value) =>
            onChange({
              ...sanction,
              suspensionMatches:
                value,
            })
          }
        />

        <AdminInput
          label="Motivazione"
          value={
            sanction.reason ?? ""
          }
          placeholder="Motivazione facoltativa"
          onChange={(value) =>
            onChange({
              ...sanction,
              reason: value,
            })
          }
        />
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 w-full rounded-[14px] bg-[#06142E] px-4 py-3 text-sm font-black text-white"
      >
        Aggiungi provvedimento
      </button>
    </div>
  );
}

function SanctionsList({
  sanctions,
  emptyText,
  editable = false,
  removable = false,
  onMatchesChange,
  onReasonChange,
  onRemove,
}: {
  sanctions: CommunicationSanction[];
  emptyText: string;
  editable?: boolean;
  removable?: boolean;
  onMatchesChange?: (
    sanctionId: string,
    value: number,
  ) => void;
  onReasonChange?: (
    sanctionId: string,
    value: string,
  ) => void;
  onRemove?: (
    sanctionId: string,
  ) => void;
}) {
  if (sanctions.length === 0) {
    return (
      <EmptyState
        text={emptyText}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sanctions.map(
        (sanction) => (
          <div
            key={sanction.id}
            className="rounded-[18px] border border-[#06142E]/8 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-black text-[#06142E]">
                  {
                    sanction.playerName
                  }
                </p>

                <p className="mt-1 break-words text-xs font-bold text-[#06142E]/45">
                  {sanction.teamName}
                </p>
              </div>

              {removable &&
              onRemove ? (
                <button
                  type="button"
                  onClick={() =>
                    onRemove(
                      sanction.id,
                    )
                  }
                  className="shrink-0 rounded-[10px] bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                >
                  Rimuovi
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
                  Giornate
                </span>

                <input
                  type="number"
                  min={1}
                  value={
                    sanction.suspensionMatches
                  }
                  disabled={!editable}
                  onChange={(event) =>
                    onMatchesChange?.(
                      sanction.id,
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-[12px] border border-[#06142E]/10 bg-[#F4F7FB] px-3 py-2 text-sm font-black text-[#06142E] outline-none disabled:opacity-70"
                />
              </label>

              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
                  Motivazione
                </span>

                <input
                  type="text"
                  value={
                    sanction.reason ??
                    ""
                  }
                  disabled={!editable}
                  onChange={(event) =>
                    onReasonChange?.(
                      sanction.id,
                      event.target
                        .value,
                    )
                  }
                  className="mt-1 w-full rounded-[12px] border border-[#06142E]/10 bg-[#F4F7FB] px-3 py-2 text-sm font-bold text-[#06142E] outline-none disabled:opacity-70"
                />
              </label>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function WarningsList({
  warnings,
}: {
  warnings:
    OfficialCommunication["warnings"];
}) {
  if (warnings.length === 0) {
    return (
      <EmptyState text="Nessun giocatore" />
    );
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className="flex items-center justify-between gap-4 rounded-[18px] bg-[#FFF8E6] p-4"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-black text-[#06142E]">
              {warning.playerName}
            </p>

            <p className="mt-1 break-words text-xs font-bold text-[#06142E]/45">
              {warning.teamName}
            </p>
          </div>

          <div className="shrink-0 text-center">
            <p className="text-xl font-black text-amber-600">
              {
                warning.yellowCards
              }
            </p>

            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-700/60">
              Gialli
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClubFineForm({
  fine,
  onChange,
  onAdd,
}: {
  fine: CommunicationClubFine;
  onChange: (
    value: CommunicationClubFine,
  ) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-[18px] bg-[#F4F7FB] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminInput
          label="Società"
          value={fine.teamName}
          placeholder="Nome squadra"
          onChange={(value) =>
            onChange({
              ...fine,
              teamName: value,
            })
          }
        />

        <label>
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
            Importo facoltativo
          </span>

          <input
            type="number"
            min={0}
            step="0.01"
            value={
              fine.amount ?? ""
            }
            onChange={(event) =>
              onChange({
                ...fine,
                amount:
                  event.target.value ===
                  ""
                    ? undefined
                    : Number(
                        event.target
                          .value,
                      ),
              })
            }
            className="mt-1 w-full rounded-[12px] border border-[#06142E]/10 bg-white px-3 py-2.5 text-sm font-black text-[#06142E] outline-none"
          />
        </label>

        <AdminInput
          label="Motivazione"
          value={fine.reason}
          placeholder="Descrizione del provvedimento"
          onChange={(value) =>
            onChange({
              ...fine,
              reason: value,
            })
          }
        />
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 w-full rounded-[14px] bg-[#06142E] px-4 py-3 text-sm font-black text-white"
      >
        Aggiungi ammenda
      </button>
    </div>
  );
}

function ClubFinesList({
  fines,
  onRemove,
}: {
  fines: CommunicationClubFine[];
  onRemove: (
    fineId: string,
  ) => void;
}) {
  if (fines.length === 0) {
    return (
      <EmptyState text="Nessuna ammenda" />
    );
  }

  return (
    <div className="space-y-3">
      {fines.map((fine) => (
        <article
          key={fine.id}
          className="rounded-[18px] border border-[#06142E]/8 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-black text-[#06142E]">
                {fine.teamName}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onRemove(fine.id)
              }
              className="shrink-0 rounded-[10px] bg-red-50 px-3 py-2 text-xs font-black text-red-600"
            >
              Rimuovi
            </button>
          </div>

          {fine.amount !== undefined ? (
            <p className="mt-3 text-sm font-black text-[#06142E]">
              Importo:{" "}
              {formatCurrency(
                fine.amount,
              )}
            </p>
          ) : null}

          <p className="mt-2 text-sm font-semibold leading-6 text-[#06142E]/60">
            {fine.reason}
          </p>
        </article>
      ))}
    </div>
  );
}

function AdminInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label>
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-1 w-full rounded-[12px] border border-[#06142E]/10 bg-white px-3 py-2.5 text-sm font-bold text-[#06142E] outline-none focus:border-[#146BFF]"
      />
    </label>
  );
}

function AdminNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number,
  ) => void;
}) {
  return (
    <label>
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
        {label}
      </span>

      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
        className="mt-1 w-full rounded-[12px] border border-[#06142E]/10 bg-white px-3 py-2.5 text-sm font-black text-[#06142E] outline-none focus:border-[#146BFF]"
      />
    </label>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-[18px] bg-[#F4F7FB] px-4 py-6 text-center">
      <p className="text-sm font-black text-[#06142E]/45">
        {text}
      </p>
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  return (
    <div
      className={
        type === "error"
          ? "rounded-[18px] bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
          : "rounded-[18px] bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
      }
    >
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-[24px] bg-white px-5 py-12 text-center shadow-sm">
      <p className="text-sm font-black text-[#06142E]/45">
        Caricamento comunicato...
      </p>
    </div>
  );
}

function createEmptyCommunication({
  seasonId,
  matchweek,
  title,
}: {
  seasonId: string;
  matchweek: number;
  title: string;
}): OfficialCommunication {
  return {
    id: `${seasonId}-mw${matchweek}`,

    seasonId,
    matchweek,
    title,

    judgeSanctions: [],
    directRedSanctions: [],
    accumulationSanctions: [],
    warnings: [],
    clubFines: [],
    status: "draft",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),
  };
}

function sanitizeSuspensionMatches(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value < 1
  ) {
    return 1;
  }

  return Math.floor(value);
}

function createLocalId(): string {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function formatCurrency(
  amount: number,
): string {
  return new Intl.NumberFormat(
    "it-IT",
    {
      style: "currency",
      currency: "EUR",
    },
  ).format(amount);
}