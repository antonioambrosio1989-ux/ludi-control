"use client";

import Image from "next/image";
import Link from "next/link";

import AppShell from "@/components/ui/AppShell";

import SeasonRosterPlayerForm from "../players/SeasonRosterPlayerForm";

import SeasonRosterList from "../players/SeasonRosterList";

import {
  SEASON_ROSTER_ROLES,
  useSeasonRosterData,
} from "@/src/hooks/useSeasonRosterData";

export default function SeasonRosterScreen() {
  const {
    currentSeason,

    players,

    participatingTeams,

    setSelectedTeamId,

    effectiveSelectedTeamId,
    effectiveSelectedTeam,

    selectedTeamRoster,
    availablePlayers,
    rosterByRole,

    showAddForm,

    playerFormMode,
    setPlayerFormMode,

    formMode,

    editingEntry,

    selectedPlayerId,
    setSelectedPlayerId,

    role,
    setRole,

    shirtNumber,
    setShirtNumber,

    search,
    setSearch,

    newFirstName,
    setNewFirstName,

    newLastName,
    setNewLastName,

    newBirthYear,
    setNewBirthYear,

    newPhotoUrl,
    setNewPhotoUrl,

    newBaseRating,
    setNewBaseRating,

    newPreferredFoot,
    setNewPreferredFoot,

    isSaving,
    removingEntryId,

    formError,
    setFormError,

    isLoading,
    loadingError,

    closeAddForm,
    openCreateForm,
    openEditForm,

    handleAddPlayer,
    handleEditPlayer,
    handleRemovePlayer,
  } =
    useSeasonRosterData();

  const rosterPlayerForm = (
    <SeasonRosterPlayerForm
      formMode={
        formMode
      }

      playerFormMode={
        playerFormMode
      }
      setPlayerFormMode={
        setPlayerFormMode
      }

      selectedPlayerId={
        selectedPlayerId
      }
      setSelectedPlayerId={
        setSelectedPlayerId
      }

      availablePlayers={
        availablePlayers
      }

      search={
        search
      }
      setSearch={
        setSearch
      }

      newFirstName={
        newFirstName
      }
      setNewFirstName={
        setNewFirstName
      }

      newLastName={
        newLastName
      }
      setNewLastName={
        setNewLastName
      }

      newBirthYear={
        newBirthYear
      }
      setNewBirthYear={
        setNewBirthYear
      }

      newPhotoUrl={
        newPhotoUrl
      }
      setNewPhotoUrl={
        setNewPhotoUrl
      }

      newBaseRating={
        newBaseRating
      }
      setNewBaseRating={
        setNewBaseRating
      }

      newPreferredFoot={
        newPreferredFoot
      }
      setNewPreferredFoot={
        setNewPreferredFoot
      }

      role={
        role
      }
      setRole={
        setRole
      }

      shirtNumber={
        shirtNumber
      }
      setShirtNumber={
        setShirtNumber
      }

      isSaving={
        isSaving
      }

      formError={
        formError
      }
      setFormError={
        setFormError
      }

      closeAddForm={
        closeAddForm
      }

      onSubmitCreate={
        handleAddPlayer
      }

      onSubmitEdit={
        handleEditPlayer
      }
    />
  );

  return (
    <AppShell>
      <header className="mt-2 mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
            Rose
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/45">
            Gestisci i giocatori iscritti alle squadre della stagione corrente.
          </p>
        </div>

        {currentSeason ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#06142E]/10 bg-white px-4 py-2 text-[10px] font-black uppercase text-[#06142E]/45">
              {participatingTeams.length} squadre
            </span>

            <span className="rounded-full bg-[#06142E] px-4 py-2 text-[10px] font-black uppercase text-white">
              {currentSeason.name}
            </span>
          </div>
        ) : null}
      </header>

      {!currentSeason ? (
        <EmptyState
          icon="📅"
          title="Nessuna stagione in corso"
          description="Attiva una stagione prima di gestire le rose."
        />
      ) : (
        <>
          <section className="mb-5 rounded-[20px] bg-[#06142E] p-5 text-white shadow-[0_14px_34px_rgba(6,20,46,0.14)] sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
              Stagione corrente
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {
                currentSeason.name
              }
            </h2>

            <label className="mt-5 block max-w-2xl">
              <span className="mb-2 block text-xs font-black uppercase text-white/50">
                Squadra
              </span>

              <select
                value={
                  effectiveSelectedTeamId
                }
                onChange={(
                  event,
                ) => {
                  setSelectedTeamId(
                    event.target.value,
                  );

                  closeAddForm();
                }}
                className="ludi-input"
              >
                {participatingTeams.map(
                  (
                    team,
                  ) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                    >
                      {
                        team.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            {participatingTeams.length ===
              0 && (
              <div className="mt-3">
                <Link
                  href="/admin/squadre"
                  className="ludi-button-primary inline-flex w-full items-center justify-center"
                >
                  + Aggiungi squadra
                </Link>
              </div>
            )}
          </section>

          {loadingError && (
            <ErrorMessage
              message={
                loadingError
              }
            />
          )}

          {isLoading ? (
            <RosterLoading />
          ) : participatingTeams.length ===
            0 ? (
            <EmptyState
              icon="🛡️"
              title="Nessuna squadra iscritta"
              description="Iscrivi almeno una squadra alla stagione corrente."
            />
          ) : (
            <>
              <section className="mb-5 flex flex-col gap-4 rounded-[20px] border border-[#06142E]/8 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
                <TeamAvatar
                  name={
                    effectiveSelectedTeam
                      ?.aliasName ??
                    effectiveSelectedTeam
                      ?.name ??
                    "Squadra"
                  }
                  logoUrl={
                    effectiveSelectedTeam
                      ?.logoUrl
                  }
                  primaryColor={
                    effectiveSelectedTeam
                      ?.primaryColor ??
                    "#06142E"
                  }
                  secondaryColor={
                    effectiveSelectedTeam
                      ?.secondaryColor ??
                    "#F4C400"
                  }
                />

                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black uppercase text-[#06142E]">
                    {effectiveSelectedTeam
                      ?.aliasName ??
                      effectiveSelectedTeam
                        ?.name}
                  </h2>

                  <p className="mt-1 text-xs font-bold text-[#06142E]/45">
                    {
                      selectedTeamRoster.length
                    }{" "}
                    {selectedTeamRoster.length ===
                    1
                      ? "giocatore"
                      : "giocatori"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      showAddForm &&
                      formMode ===
                        "create"
                    ) {
                      closeAddForm();

                      return;
                    }

                    openCreateForm();
                  }}
                  className="ludi-button-primary w-full shrink-0 sm:w-auto"
                >
                  {showAddForm &&
                  formMode ===
                    "create"
                    ? "Chiudi"
                    : "+ Aggiungi"}
                </button>
              </section>

              {showAddForm &&
                formMode ===
                  "create" &&
                rosterPlayerForm}


              <SeasonRosterList
  roles={
    SEASON_ROSTER_ROLES
  }

  rosterByRole={
    rosterByRole
  }

  players={
    players
  }

  removingEntryId={
    removingEntryId
  }

  editingEntryId={
    showAddForm &&
    formMode ===
      "edit"
      ? editingEntry?.id ??
        null
      : null
  }

  editForm={
    showAddForm &&
    formMode ===
      "edit"
      ? rosterPlayerForm
      : null
  }

  onRemove={
    handleRemovePlayer
  }

  onEdit={(
    entry,
    player,
  ) => {
    openEditForm(
      entry,
      player,
    );
  }}
/>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

/*
 * ============================================================
 * AVATAR SQUADRA
 * ============================================================
 */

function TeamAvatar({
  name,
  logoUrl,
  primaryColor,
  secondaryColor,
}: {
  name:
    string;

  logoUrl?:
    string;

  primaryColor:
    string;

  secondaryColor:
    string;
}) {
  return (
    <div
      className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[17px] text-lg font-black"
      style={{
        backgroundColor:
          primaryColor,

        color:
          secondaryColor,
      }}
    >
      {logoUrl ? (
        <Image
          src={
            logoUrl
          }
          alt={`Logo ${name}`}
          fill
          unoptimized
          sizes="64px"
          className="object-contain p-1.5"
        />
      ) : (
        name
          .split(
            /\s+/,
          )
          .slice(
            0,
            2,
          )
          .map(
            (
              word,
            ) =>
              word[0],
          )
          .join(
            "",
          )
          .toUpperCase()
      )}
    </div>
  );
}

/*
 * ============================================================
 * ERRORE
 * ============================================================
 */

function ErrorMessage({
  message,
}: {
  message:
    string;
}) {
  return (
    <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-700">
        {
          message
        }
      </p>
    </div>
  );
}

/*
 * ============================================================
 * EMPTY STATE
 * ============================================================
 */

function EmptyState({
  icon,
  title,
  description,
}: {
  icon:
    string;

  title:
    string;

  description:
    string;
}) {
  return (
    <section className="ludi-card p-8 text-center">
      <p className="text-4xl">
        {
          icon
        }
      </p>

      <h2 className="mt-3 text-xl font-black text-[#06142E]">
        {
          title
        }
      </h2>

      <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
        {
          description
        }
      </p>
    </section>
  );
}

/*
 * ============================================================
 * LOADING
 * ============================================================
 */

function RosterLoading() {
  return (
    <section className="space-y-3">
      {[1, 2, 3].map(
        (
          item,
        ) => (
          <div
            key={
              item
            }
            className="ludi-card flex items-center gap-4 p-4"
          >
            <div className="h-14 w-14 animate-pulse rounded-full bg-[#06142E]/8" />

            <div className="flex-1">
              <div className="h-4 w-36 animate-pulse rounded-full bg-[#06142E]/8" />

              <div className="mt-3 h-3 w-24 animate-pulse rounded-full bg-[#06142E]/5" />
            </div>
          </div>
        ),
      )}
    </section>
  );
}