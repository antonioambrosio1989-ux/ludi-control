"use client";

import {
  useMemo,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";

import TeamLogoUploader from "@/components/admin/teams/TeamLogoUploader";
import TeamPhotoUploader from "@/components/admin/teams/TeamPhotoUploader";
import AppShell from "@/components/ui/AppShell";

import { FirebaseSeasonTeamRepository } from "@/src/services/team/FirebaseSeasonTeamRepository";
import {
  FirebaseSeasonTeamContactRepository,
} from "@/src/services/team/FirebaseSeasonTeamContactRepository";
import { FirebaseTeamRepository } from "@/src/services/team/FirebaseTeamRepository";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import { useSeasonTeams } from "@/src/hooks/useSeasonTeams";
import {
  useSeasonTeamContacts,
} from "@/src/hooks/useSeasonTeamContacts";
import { useTeams } from "@/src/hooks/useTeams";

import type { SeasonTeam } from "@/src/types/SeasonTeam";
import type { Team } from "@/src/types/Team";

type FormMode =
  | "create"
  | "existing"
  | "edit";

const DEFAULT_PRIMARY_COLOR =
  "#06142E";

const DEFAULT_SECONDARY_COLOR =
  "#F4C400";

export default function AdminTeamsScreen() {
  const {
    teams,
    isLoading: teamsLoading,
    error: teamsError,
  } = useTeams();

  const {
  selectedCompetition,

  currentSeason,

  isLoading:
    competitionLoading,

  error:
    competitionError,
} =
  useCompetition();

  const {
    entries: seasonEntries,
    isLoading: seasonEntriesLoading,
    error: seasonEntriesError,
  } = useSeasonTeams(
    currentSeason?.id,
  );

  const {
    contacts:
      seasonTeamContacts,
    isLoading:
      seasonTeamContactsLoading,
    error:
      seasonTeamContactsError,
  } = useSeasonTeamContacts(
    currentSeason?.id,
  );

  const [search, setSearch] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [formMode, setFormMode] =
    useState<FormMode>("create");

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] = useState("");

  const [
    editingTeamId,
    setEditingTeamId,
  ] = useState<string | null>(null);

  const [name, setName] =
    useState("");

  const [shortName, setShortName] =
    useState("");

  const [aliasName, setAliasName] =
    useState("");

  const [nickname, setNickname] =
  useState("");


const [
  teamPhotoUrl,
  setTeamPhotoUrl,
] = useState("");



  const [president, setPresident] =
    useState("");

  const [
    presidentPhone,
    setPresidentPhone,
  ] = useState("");

  const [
    whatsappOptIn,
    setWhatsappOptIn,
  ] = useState(false);

  const [logoUrl, setLogoUrl] =
    useState("");

  const [
    primaryColor,
    setPrimaryColor,
  ] = useState(
    DEFAULT_PRIMARY_COLOR,
  );

  const [
    secondaryColor,
    setSecondaryColor,
  ] = useState(
    DEFAULT_SECONDARY_COLOR,
  );

  const [isSaving, setIsSaving] =
    useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  const [
    actionError,
    setActionError,
  ] = useState<string | null>(
    null,
  );

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );

  const teamRows = useMemo(() => {
  return teams.map(
    (team) => {
      const entry =
        currentSeason
          ? seasonEntries.find(
              (
                currentEntry,
              ) =>
                String(
                  currentEntry.teamId,
                ) ===
                String(
                  team.id,
                ),
            )
          : undefined;

      return {
        team,
        entry,
      };
    },
  );
}, [
  currentSeason,
  seasonEntries,
  teams,
]);

  const filteredTeams =
  useMemo(() => {
    const normalizedSearch =
      search
        .trim()
        .toLowerCase();

    if (!normalizedSearch) {
      return teamRows;
    }

    return teamRows.filter(
      ({ team, entry }) => {
        return [
          team.name,
          team.shortName,
          team.aliasName,
          team.nickname,
          entry?.president,
        ].some(
          (value) =>
            value
              ?.toLowerCase()
              .includes(
                normalizedSearch,
              ),
        );
      },
    );
  }, [
    search,
    teamRows,
  ]);

  const availableExistingTeams =
    useMemo(() => {
      const registeredTeamIds =
        new Set(
          seasonEntries.map(
            (entry) =>
              String(entry.teamId),
          ),
        );

      return teams.filter(
        (team) =>
          !registeredTeamIds.has(
            String(team.id),
          ),
      );
    }, [
      seasonEntries,
      teams,
    ]);

  const isLoading =
  teamsLoading ||
  competitionLoading ||
  seasonEntriesLoading ||
  seasonTeamContactsLoading;

const loadingError =
  teamsError ||
  competitionError ||
  seasonEntriesError ||
  seasonTeamContactsError;

  function clearMessages() {
    setFormError(null);
    setActionError(null);
    setSuccessMessage(null);
  }

  function resetForm() {
    setName("");
    setShortName("");
    setAliasName("");
    setNickname("");
    setTeamPhotoUrl("");
    setPresident("");
    setPresidentPhone("");
    setWhatsappOptIn(false);
    setLogoUrl("");

    setPrimaryColor(
      DEFAULT_PRIMARY_COLOR,
    );

    setSecondaryColor(
      DEFAULT_SECONDARY_COLOR,
    );

    setSelectedTeamId("");
    setEditingTeamId(null);
    setFormMode("create");
    setFormError(null);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function openCreateForm() {
    resetForm();
    clearMessages();

    setFormMode("create");
    setShowForm(true);
  }

  function openExistingForm() {
    resetForm();
    clearMessages();

    setFormMode("existing");
    setShowForm(true);
  }

  function startEditing(
    team: Team,
    entry?: SeasonTeam,
  ) {
    clearMessages();

    setFormMode("edit");
    setEditingTeamId(
      String(team.id),
    );

    setName(team.name);

    setShortName(
      team.shortName ?? "",
    );

    setAliasName(
      team.aliasName ?? "",
    );
    
    setNickname(
  team.nickname ?? "",
);


setTeamPhotoUrl(
  team.teamPhotoUrl ?? "",
);


    
    setPresident(
      entry?.president ?? "",
    );

    const contact =
      seasonTeamContacts.find(
        (currentContact) =>
          String(
            currentContact.teamId,
          ) === String(team.id),
      );

    setPresidentPhone(
      contact?.presidentPhoneE164 ??
        "",
    );

    setWhatsappOptIn(
      contact?.whatsappOptIn ??
        false,
    );

    setLogoUrl(
      team.logoUrl ?? "",
    );

    setPrimaryColor(
      team.primaryColor ||
        DEFAULT_PRIMARY_COLOR,
    );

    setSecondaryColor(
      team.secondaryColor ||
        DEFAULT_SECONDARY_COLOR,
    );

    setShowForm(true);

  }

  function normalizeShortName(
    value: string,
  ) {
    return value
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        "",
      )
      .slice(0, 3);
  }

  function validateTeamForm() {
    if (name.trim().length < 2) {
      setFormError(
        "Inserisci un nome squadra valido.",
      );

      return false;
    }

    if (
      shortName.trim().length < 2
    ) {
      setFormError(
        "Inserisci una sigla di almeno 2 caratteri.",
      );

      return false;
    }

    return true;
  }

  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (isSaving) {
    return;
  }

  clearMessages();

  /*
   * --------------------------------------------------------
   * MODIFICA SQUADRA
   *
   * Non richiede una stagione attiva.
   * --------------------------------------------------------
   */

  if (
    formMode === "edit"
  ) {
    if (
      !validateTeamForm()
    ) {
      return;
    }

    await updateExistingTeam();
    return;
  }

  /*
   * --------------------------------------------------------
   * ISCRIZIONE DI UNA SQUADRA ESISTENTE
   *
   * Richiede necessariamente una stagione.
   * --------------------------------------------------------
   */

  if (
    formMode === "existing"
  ) {
    if (
      !currentSeason
    ) {
      setFormError(
        "Prima devi attivare una stagione.",
      );

      return;
    }

    await registerExistingTeam();
    return;
  }

  /*
   * --------------------------------------------------------
   * CREAZIONE NUOVA SQUADRA
   *
   * Può avvenire anche senza stagione attiva.
   * --------------------------------------------------------
   */

  if (
    !validateTeamForm()
  ) {
    return;
  }

  await createNewTeam();
}

  async function saveWhatsappSettings(
    seasonId: string,
    teamId: string,
  ) {
    await FirebaseSeasonTeamContactRepository.save(
      {
        seasonId,
        teamId,

        presidentPhone:
          presidentPhone.trim() ||
          undefined,

        whatsappOptIn,
      },
    );
  }

  async function registerExistingTeam() {
    if (
      !currentSeason ||
      !selectedTeamId
    ) {
      setFormError(
        "Seleziona una squadra da iscrivere.",
      );

      return;
    }

    setIsSaving(true);

    let teamRegistered =
      false;

    try {
      await FirebaseSeasonTeamRepository.create(
        {
          teamId: selectedTeamId,
          seasonId:
            currentSeason.id,

          president:
            president.trim() ||
            undefined,
        },
      );

      teamRegistered = true;

      await saveWhatsappSettings(
        currentSeason.id,
        selectedTeamId,
      );

      closeForm();

      setSuccessMessage(
        "Squadra iscritta correttamente alla stagione.",
      );
    } catch (currentError) {
      if (teamRegistered) {
        await FirebaseSeasonTeamRepository.remove(
          currentSeason.id,
          selectedTeamId,
        ).catch(
          (rollbackError) => {
            console.error(
              "Errore rollback iscrizione squadra:",
              rollbackError,
            );
          },
        );
      }

      console.error(
        "Errore iscrizione squadra:",
        currentError,
      );

      setFormError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile iscrivere la squadra.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createNewTeam() {
  setIsSaving(true);

  let createdTeam:
    | Team
    | null = null;

  try {
    /*
     * --------------------------------------------------------
     * 1. CREAZIONE SQUADRA GLOBALE
     *
     * Questa operazione non dipende dalla stagione.
     * --------------------------------------------------------
     */

    createdTeam =
      await FirebaseTeamRepository.create(
        {
          name:
            name.trim(),

          shortName:
            normalizeShortName(
              shortName,
            ),

          aliasName:
            aliasName.trim() ||
            undefined,

          nickname:
            nickname.trim() ||
            undefined,

          logoUrl:
            logoUrl.trim() ||
            undefined,

          teamPhotoUrl:
            teamPhotoUrl.trim() ||
            undefined,


          primaryColor,
          secondaryColor,
        },
      );

    /*
     * --------------------------------------------------------
     * 2. ISCRIZIONE ALLA STAGIONE
     *
     * Avviene automaticamente soltanto quando
     * esiste una stagione attiva.
     * --------------------------------------------------------
     */

    if (
      currentSeason
    ) {
      try {
        await FirebaseSeasonTeamRepository.create(
          {
            teamId:
              createdTeam.id,

            seasonId:
              currentSeason.id,

            president:
              president.trim() ||
              undefined,
          },
        );

        await saveWhatsappSettings(
          currentSeason.id,
          createdTeam.id,
        );
      } catch (
        registrationError
      ) {
        /*
         * Se l'utente sta creando una squadra
         * durante una stagione attiva, consideriamo
         * creazione + iscrizione una sola operazione.
         *
         * Se l'iscrizione fallisce, rimuoviamo
         * la squadra appena creata per non lasciare
         * dati incompleti.
         */
        await FirebaseSeasonTeamRepository
          .remove(
            currentSeason.id,
            createdTeam.id,
          )
          .catch(
            (rollbackError) => {
              console.error(
                "Errore rollback iscrizione stagionale:",
                rollbackError,
              );
            },
          );

        await FirebaseTeamRepository
          .remove(
            createdTeam.id,
          )
          .catch(
            (rollbackError) => {
              console.error(
                "Errore rollback squadra:",
                rollbackError,
              );
            },
          );

        throw registrationError;
      }
    }

    closeForm();

    setSuccessMessage(
      currentSeason
        ? "Squadra creata e iscritta correttamente alla stagione."
        : "Squadra creata correttamente nell'archivio.",
    );
  } catch (
    currentError
  ) {
    console.error(
      "Errore creazione squadra:",
      currentError,
    );

    setFormError(
      currentError instanceof Error
        ? currentError.message
        : "Impossibile creare la squadra.",
    );
  } finally {
    setIsSaving(false);
  }
}

  async function updateExistingTeam() {
  if (
    !editingTeamId
  ) {
    setFormError(
      "Squadra da modificare non valida.",
    );

    return;
  }

  setIsSaving(true);

  try {
    /*
     * --------------------------------------------------------
     * DATI GLOBALI SQUADRA
     *
     * Questi possono essere modificati anche
     * senza una stagione attiva.
     * --------------------------------------------------------
     */

    await FirebaseTeamRepository.update(
      editingTeamId,
      {
        name:
          name.trim(),

        shortName:
          normalizeShortName(
            shortName,
          ),

        aliasName:
          aliasName.trim(),

        nickname:
          nickname.trim(),

        logoUrl:
          logoUrl.trim(),

        teamPhotoUrl:
          teamPhotoUrl.trim(),

        primaryColor,
        secondaryColor,
      },
    );

    /*
     * --------------------------------------------------------
     * DATI STAGIONALI
     *
     * Il presidente appartiene alla partecipazione
     * della squadra alla stagione.
     *
     * Lo aggiorniamo soltanto se esiste
     * una stagione attiva.
     * --------------------------------------------------------
     */

    if (
      currentSeason
    ) {
      await FirebaseSeasonTeamRepository.updateDetails(
        {
          seasonId:
            currentSeason.id,

          teamId:
            editingTeamId,

          president:
            president.trim() ||
            undefined,
        },
      );

      await saveWhatsappSettings(
        currentSeason.id,
        editingTeamId,
      );
    }

    closeForm();

    setSuccessMessage(
      currentSeason
        ? "Squadra modificata correttamente."
        : "Dati della squadra modificati correttamente.",
    );
  } catch (
    currentError
  ) {
    console.error(
      "Errore modifica squadra:",
      currentError,
    );

    setFormError(
      currentError instanceof Error
        ? currentError.message
        : "Impossibile modificare la squadra.",
    );
  } finally {
    setIsSaving(false);
  }
}

  async function handleRemoveFromSeason(
    team: Team,
  ) {
    if (!currentSeason) {
      setActionError(
        "Nessuna stagione attiva.",
      );

      return;
    }

    const confirmed =
  window.confirm(
    `Vuoi rimuovere ${team.name} dalla stagione ${currentSeason.name}${
      selectedCompetition
        ? ` di ${selectedCompetition.name}`
        : ""
    }? La squadra resterà nell'archivio storico.`,
  );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      await FirebaseSeasonTeamRepository.remove(
        currentSeason.id,
        team.id,
      );

      await FirebaseSeasonTeamContactRepository.remove(
        currentSeason.id,
        team.id,
      );

      setSuccessMessage(
        "Squadra rimossa dalla stagione.",
      );
    } catch (currentError) {
      console.error(
        "Errore rimozione squadra:",
        currentError,
      );

      setActionError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile rimuovere la squadra dalla stagione.",
      );
    }
  }

  function renderTeamForm(
    className: string,
  ) {
    return (
              <form
                onSubmit={handleSubmit}
                className={className}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="ludi-section-title">
                    {formTitle}
                  </h2>

                  {formMode === "edit" && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={closeForm}
                      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E]"
                    >
                      Annulla
                    </button>
                  )}
                </div>

                {formMode !== "edit" && (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={openExistingForm}
                      className={`min-h-12 rounded-[13px] border px-3 text-xs font-black uppercase ${
                        formMode ===
                        "existing"
                          ? "border-[#06142E] bg-[#06142E] text-white"
                          : "border-[#06142E]/15 bg-white text-[#06142E]"
                      }`}
                    >
                      Esistente
                    </button>

                    <button
                      type="button"
                      onClick={openCreateForm}
                      className={`min-h-12 rounded-[13px] border px-3 text-xs font-black uppercase ${
                        formMode ===
                        "create"
                          ? "border-[#06142E] bg-[#06142E] text-white"
                          : "border-[#06142E]/15 bg-white text-[#06142E]"
                      }`}
                    >
                      Nuova
                    </button>
                  </div>
                )}

                {formMode === "existing" ? (
                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                        Squadra da iscrivere
                      </span>

                      <select
                        value={
                          selectedTeamId
                        }
                        onChange={(event) => {
                          setSelectedTeamId(
                            event.target.value,
                          );

                          setFormError(null);
                        }}
                        className="ludi-input"
                        required
                      >
                        <option value="">
                          Seleziona una squadra
                        </option>

                        {availableExistingTeams.map(
                          (team) => (
                            <option
                              key={team.id}
                              value={team.id}
                            >
                              {team.name}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    {currentSeason ? (
        <>
          <TextField
            label="Presidente"
            value={president}
            onChange={setPresident}
            placeholder="Nome presidente"
          />

          <WhatsAppContactFields
            phone={presidentPhone}
            onPhoneChange={setPresidentPhone}
            optIn={whatsappOptIn}
            onOptInChange={setWhatsappOptIn}
          />
        </>
      ) : (
        <div className="rounded-[13px] bg-[#06142E]/[0.04] p-4">
          <p className="text-xs font-black uppercase text-[#06142E]/40">
            Presidente
          </p>

          <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
            Il presidente viene associato alla partecipazione stagionale.
            Potrai inserirlo quando la squadra verrà iscritta a una stagione.
          </p>
        </div>
      )}

                    {availableExistingTeams.length ===
                      0 && (
                      <p className="rounded-[13px] bg-[#06142E]/[0.05] p-4 text-sm font-bold text-[#06142E]/55">
                        Tutte le squadre dell’archivio sono già iscritte alla stagione.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <TextField
                      label="Nome squadra"
                      value={name}
                      onChange={setName}
                      placeholder="Real Five"
                      required
                    />

                    <TextField
                      label="Sigla squadra"
                      value={shortName}
                      onChange={(value) =>
                        setShortName(
                          normalizeShortName(
                            value,
                          ),
                        )
                      }
                      placeholder="Es. NEW"
                      required
                      maxLength={3}
                    />

                    <TextField
                      label="Alias"
                      value={aliasName}
                      onChange={setAliasName}
                      placeholder="Real Five"
                      required
                    />

                    <TextField
        label="Soprannome"
        value={nickname}
        onChange={setNickname}
        placeholder="I Leoni"
        maxLength={40}
      />


                    <TextField
                      label="Presidente"
                      value={president}
                      onChange={setPresident}
                      placeholder="Nome presidente"
                    />

                    {currentSeason && (
                      <WhatsAppContactFields
                        phone={presidentPhone}
                        onPhoneChange={setPresidentPhone}
                        optIn={whatsappOptIn}
                        onOptInChange={setWhatsappOptIn}
                      />
                    )}

                    <div>
                      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                        Logo squadra
                      </span>

                      <TeamLogoUploader
                        value={logoUrl}
                        onChange={setLogoUrl}
                        onRemove={() =>
                          setLogoUrl("")
                        }
                      />
                    </div>

                    <TeamPhotoUploader
                      value={teamPhotoUrl}
                      onChange={setTeamPhotoUrl}
                      onRemove={() =>
                        setTeamPhotoUrl("")
                      }
                    />



                    <div className="grid grid-cols-2 gap-3">
                      <ColorField
                        label="Colore principale"
                        value={primaryColor}
                        onChange={
                          setPrimaryColor
                        }
                      />

                      <ColorField
                        label="Colore secondario"
                        value={secondaryColor}
                        onChange={
                          setSecondaryColor
                        }
                      />
                    </div>
                  </div>
                )}

                {formError && (
                  <ErrorMessage
                    message={formError}
                  />
                )}

                <button
                  type="submit"
                  disabled={
        isSaving ||
        (
          formMode ===
            "existing" &&
          (
            !currentSeason ||
            !selectedTeamId
          )
        ) ||
        (
          formMode !==
            "existing" &&
          (
            name.trim()
              .length < 2 ||
            shortName.trim()
              .length < 2
          )
        )
      }
                  className="ludi-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSaving
                    ? "Salvataggio..."
                    : formMode ===
                        "existing"
                      ? "Iscrivi alla stagione"
                      : formMode ===
                          "edit"
                        ? "Salva modifiche"
                        : "Crea squadra"}
                </button>
              </form>
    );
  }

  const formTitle =
    formMode === "edit"
      ? "Modifica squadra"
      : formMode === "existing"
        ? "Iscrivi squadra esistente"
        : "Nuova squadra";

  return (
    <AppShell>
      <header className="mt-2 mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Squadre
          </h1>

          <p className="mt-1 text-sm font-bold text-[#06142E]/50">
  Crea, iscrivi e modifica le squadre
  {selectedCompetition
    ? ` di ${selectedCompetition.name}.`
    : "."}
</p>
        </div>

        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={
            showForm
              ? closeForm
              : openCreateForm
          }
          className="ludi-button-primary w-full shrink-0 sm:w-auto"
        >
          {showForm
            ? "Chiudi"
            : "+ Nuova"}
        </button>
        </div>
      </header>

      {currentSeason ? (
        <section className="mb-5 rounded-[18px] bg-[#06142E] p-4 text-white shadow-[0_12px_30px_rgba(6,20,46,0.16)]">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
  Stagione selezionata
  {selectedCompetition
    ? ` · ${selectedCompetition.name}`
    : ""}
</p>

<p className="mt-1 text-xl font-black">
  {currentSeason.name}
</p>

          <p className="mt-1 text-xs font-bold text-white/50">
            {seasonEntries.length}{" "}
            {seasonEntries.length === 1
              ? "squadra iscritta"
              : "squadre iscritte"}
          </p>
        </section>
      ) : (
        <section className="mb-5 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-800">
  Nessuna stagione attiva
  {selectedCompetition
    ? ` per ${selectedCompetition.name}`
    : ""}
</p>

<p className="mt-1 text-xs font-bold leading-5 text-amber-700/75">
  Attiva una stagione della competizione selezionata prima di aggiungere o modificare le partecipazioni.
</p>
        </section>
      )}

      {successMessage && (
        <SuccessMessage
          message={successMessage}
        />
      )}

      {showForm &&
        formMode !== "edit" &&
        renderTeamForm(
          "ludi-card mb-5 p-5",
        )}

      <section className="mb-5">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          className="ludi-input"
          placeholder="Cerca squadra, sigla o presidente..."
        />
      </section>

      {loadingError && (
        <ErrorMessage
          message={loadingError}
        />
      )}

      {actionError && (
        <ErrorMessage
          message={actionError}
        />
      )}

      {isLoading ? (
  <div className="ludi-card p-6 text-center">
    <p className="font-black text-[#06142E]">
      Caricamento squadre...
    </p>
  </div>
) : filteredTeams.length >
        0 ? (
        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          {filteredTeams.map(
            ({ team, entry }) => (
              <article
                key={team.id}
                className="ludi-card flex h-full min-w-0 flex-col p-4"
              >
                <div className="flex items-center gap-4">
                  <TeamAvatar
                    team={team}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-black uppercase text-[#06142E]">
                        {team.name}
                      </h2>

                      {team.shortName && (
                        <span className="shrink-0 rounded-full bg-[#06142E]/[0.07] px-2 py-1 text-[9px] font-black uppercase text-[#06142E]/60">
                          {
                            team.shortName
                          }
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs font-bold text-[#06142E]/45">
                      Presidente:{" "}
                      {entry?.president ||
                        "Da definire"}
                    </p>

                    {currentSeason && (
  <p
    className={`mt-1 text-[10px] font-black uppercase tracking-[0.08em] ${
      entry
        ? "text-green-600"
        : "text-[#06142E]/35"
    }`}
  >
    {entry
      ? `Iscritta a ${currentSeason.name}`
      : "Non iscritta alla stagione"}
  </p>
)}

                   {team.nickname && (
  <p className="mt-2 text-xs font-black text-[#06142E]/65">
    {team.nickname}
  </p>
)}

<div className="mt-3 flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{
                          backgroundColor:
                            team.primaryColor,
                        }}
                        title="Colore principale"
                      />

                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{
                          backgroundColor:
                            team.secondaryColor,
                        }}
                        title="Colore secondario"
                      />
                    </div>
                  </div>
                </div>

                {showForm &&
                  formMode ===
                    "edit" &&
                  editingTeamId ===
                    String(
                      team.id,
                    ) &&
                  renderTeamForm(
                    "mt-4 border-t border-[#06142E]/10 pt-4",
                  )}

                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[#06142E]/10 pt-4">
  <button
    type="button"
    onClick={() =>
      startEditing(
        team,
        entry,
      )
    }
    className="rounded-[12px] bg-[#06142E] px-3 py-3 text-[10px] font-black uppercase text-white"
  >
    Modifica
  </button>

  {currentSeason &&
  entry ? (
    <button
      type="button"
      onClick={() => {
        void handleRemoveFromSeason(
          team,
        );
      }}
      className="rounded-[12px] bg-red-50 px-3 py-3 text-[10px] font-black uppercase text-red-600"
    >
      Rimuovi
    </button>
  ) : currentSeason ? (
    <button
      type="button"
      onClick={() => {
        resetForm();
        clearMessages();

        setFormMode(
          "existing",
        );

        setSelectedTeamId(
          String(
            team.id,
          ),
        );

        setShowForm(
          true,
        );

        window.scrollTo({
          top: 0,
          behavior:
            "smooth",
        });
      }}
      className="rounded-[12px] bg-green-50 px-3 py-3 text-[10px] font-black uppercase text-green-700"
    >
      Iscrivi
    </button>
  ) : (
    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-[12px] bg-[#06142E]/5 px-3 py-3 text-[10px] font-black uppercase text-[#06142E]/25"
    >
      Nessuna stagione
    </button>
  )}
</div>
              </article>
            ),
          )}
        </section>
      ) : (
        <EmptyState
          icon="🛡️"
          title={
            search.trim()
              ? "Nessun risultato"
              : "Nessuna squadra"
          }
          description={
            search.trim()
              ? "Nessuna squadra corrisponde alla ricerca."
              : "Aggiungi la prima squadra all'archivio."
          }
        />
      )}
    </AppShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
        {label}
      </span>

      <input
        type="text"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        required={required}
        maxLength={maxLength}
        className="ludi-input"
        placeholder={placeholder}
      />
    </label>
  );
}

function WhatsAppContactFields({
  phone,
  onPhoneChange,
  optIn,
  onOptInChange,
}: {
  phone: string;
  onPhoneChange: (
    value: string,
  ) => void;
  optIn: boolean;
  onOptInChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <div className="rounded-[16px] border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-emerald-800">
        Richiesta formazione WhatsApp
      </p>

      <label className="mt-4 block">
        <span className="mb-2 block text-[10px] font-black uppercase text-emerald-900/55">
          Numero del presidente
        </span>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) =>
            onPhoneChange(
              event.target.value,
            )
          }
          className="ludi-input"
          placeholder="+393331234567"
        />
      </label>

      <label className="mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(event) =>
            onOptInChange(
              event.target.checked,
            )
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700"
        />

        <span className="text-xs font-bold leading-5 text-emerald-950/65">
          Il presidente ha autorizzato la ricezione delle richieste automatiche su WhatsApp.
        </span>
      </label>

      <p className="mt-3 text-[10px] font-bold leading-4 text-emerald-900/45">
        Il messaggio verrà inviato sei ore prima della partita. Il numero resta visibile soltanto agli amministratori.
      </p>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase text-[#06142E]/50">
        {label}
      </span>

      <div className="flex h-12 items-center gap-3 rounded-[13px] border border-[#06142E]/15 bg-white px-2">
        <input
          type="color"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="h-9 w-12 cursor-pointer rounded-[9px] border-0 bg-transparent p-0"
        />

        <span className="text-xs font-black uppercase text-[#06142E]/55">
          {value}
        </span>
      </div>
    </label>
  );
}

function TeamAvatar({
  team,
}: {
  team: Team;
}) {
  return (
    <div
      className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] text-lg font-black shadow-sm"
      style={{
        backgroundColor:
          team.primaryColor,

        color:
          team.secondaryColor,
      }}
    >
      {team.logoUrl?.trim() ? (
        <Image
          src={team.logoUrl}
          alt={`Logo ${team.name}`}
          fill
          unoptimized
          sizes="64px"
          className="object-contain p-1.5"
        />
      ) : (
        getInitials(team.name)
      )}
    </div>
  );
}

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mb-4 rounded-[13px] border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-700">
        {message}
      </p>
    </div>
  );
}

function SuccessMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mb-4 rounded-[13px] border border-green-200 bg-green-50 p-4">
      <p className="text-sm font-bold text-green-700">
        {message}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="ludi-card p-7 text-center">
      <p className="text-3xl">
        {icon}
      </p>

      <h2 className="mt-3 text-lg font-black text-[#06142E]">
        {title}
      </h2>

      <p className="mt-1 text-sm font-bold leading-6 text-[#06142E]/45">
        {description}
      </p>
    </div>
  );
}

function getInitials(
  value: string,
) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (word) =>
        word[0] ?? "",
    )
    .join("")
    .toUpperCase();
}
