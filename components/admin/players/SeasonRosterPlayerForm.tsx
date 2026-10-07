"use client";

import PlayerPhotoUploader from "@/components/admin/players/PlayerPhotoUploader";

import {
  SEASON_ROSTER_ROLES,
} from "@/src/hooks/useSeasonRosterData";

import type {
  PreferredFoot,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayerRole,
} from "@/src/types/SeasonPlayer";

type Props = {
  formMode:
    | "create"
    | "edit";

  playerFormMode:
    | "existing"
    | "new";

  setPlayerFormMode:
    (
      value:
        | "existing"
        | "new",
    ) => void;

  selectedPlayerId:
    string;

  setSelectedPlayerId:
    (
      value:
        string,
    ) => void;

  availablePlayers:
    Array<{
      id:
        string;

      firstName:
        string;

      lastName:
        string;

      birthYear?:
        number;
    }>;

  search:
    string;

  setSearch:
    (
      value:
        string,
    ) => void;

  newFirstName:
    string;

  setNewFirstName:
    (
      value:
        string,
    ) => void;

  newLastName:
    string;

  setNewLastName:
    (
      value:
        string,
    ) => void;

  newBirthYear:
    string;

  setNewBirthYear:
    (
      value:
        string,
    ) => void;

  newPhotoUrl:
    string;

  setNewPhotoUrl:
    (
      value:
        string,
    ) => void;

  newBaseRating:
    string;

  setNewBaseRating:
    (
      value:
        string,
    ) => void;

  newPreferredFoot:
    PreferredFoot | "";

  setNewPreferredFoot:
    (
      value:
        PreferredFoot | "",
    ) => void;

  role:
    SeasonPlayerRole;

  setRole:
    (
      value:
        SeasonPlayerRole,
    ) => void;

  shirtNumber:
    string;

  setShirtNumber:
    (
      value:
        string,
    ) => void;

  isSaving:
    boolean;

  formError:
    string | null;

  setFormError:
    (
      value:
        string | null,
    ) => void;

  closeAddForm:
    () => void;

  onSubmitCreate:
    (
      event:
        React.FormEvent<HTMLFormElement>,
    ) => void;

  onSubmitEdit:
    () => void;
};

export default function SeasonRosterPlayerForm({
  formMode,

  playerFormMode,
  setPlayerFormMode,

  selectedPlayerId,
  setSelectedPlayerId,

  availablePlayers,

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

  role,
  setRole,

  shirtNumber,
  setShirtNumber,

  isSaving,

  formError,
  setFormError,

  closeAddForm,

  onSubmitCreate,
  onSubmitEdit,
}: Props) {
  const duplicateNameCounts =
    new Map<
      string,
      number
    >();

  for (
    const player of
    availablePlayers
  ) {
    const key =
      createPlayerNameKey(
        player.firstName,
        player.lastName,
      );

    duplicateNameCounts.set(
      key,
      (
        duplicateNameCounts.get(
          key,
        ) ?? 0
      ) + 1,
    );
  }

  function getPlayerOptionLabel(
    player:
      Props["availablePlayers"][number],
  ) {
    const fullName =
      `${player.firstName} ${player.lastName}`;

    const key =
      createPlayerNameKey(
        player.firstName,
        player.lastName,
      );

    const isDuplicate =
      (
        duplicateNameCounts.get(
          key,
        ) ?? 0
      ) > 1;

    if (
      !isDuplicate
    ) {
      return fullName;
    }

    return `${fullName} (${
      player.birthYear ??
      "anno non disponibile"
    })`;
  }

  return (
    <form
      onSubmit={
        formMode ===
        "edit"
          ? (
              event,
            ) => {
              event.preventDefault();

              void onSubmitEdit();
            }
          : onSubmitCreate
      }
      className="ludi-card mb-5 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
            {formMode ===
            "edit"
              ? "Modifica giocatore"
              : "Gestione rosa"}
          </p>

          <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
            {formMode ===
            "edit"
              ? "Dati giocatore"
              : "Aggiungi giocatore"}
          </h2>
        </div>

        <button
          type="button"
          onClick={
            closeAddForm
          }
          className="rounded-[11px] bg-[#06142E]/5 px-4 py-2 text-[10px] font-black uppercase text-[#06142E]"
        >
          Chiudi
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {formMode !==
          "edit" &&
          playerFormMode ===
            "existing" && (
            <>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                  Cerca giocatore
                </span>

                <input
                  type="search"
                  value={
                    search
                  }
                  onChange={(
                    event,
                  ) => {
                    setSearch(
                      event.target.value,
                    );
                  }}
                  className="ludi-input"
                  placeholder="Nome o cognome..."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                  Giocatore
                </span>

                <select
                  value={
                    selectedPlayerId
                  }
                  onChange={(
                    event,
                  ) => {
                    setSelectedPlayerId(
                      event.target.value,
                    );
                  }}
                  className="ludi-input"
                  required
                >
                  <option value="">
                    Seleziona un giocatore
                  </option>

                  {availablePlayers.map(
                    (
                      player,
                    ) => (
                      <option
                        key={
                          player.id
                        }
                        value={
                          player.id
                        }
                      >
                        {
                          getPlayerOptionLabel(
                            player,
                          )
                        }
                      </option>
                    ),
                  )}
                </select>

                {availablePlayers.length ===
                  0 && (
                  <p className="mt-2 text-xs font-bold text-[#06142E]/45">
                    Nessun giocatore disponibile.
                  </p>
                )}
              </label>

              <button
                type="button"
                onClick={() => {
                  setPlayerFormMode(
                    "new",
                  );

                  setSelectedPlayerId(
                    "",
                  );

                  setFormError(
                    null,
                  );
                }}
                className="text-sm font-bold text-[#075BFF] hover:underline"
              >
                + Crea nuovo giocatore
              </button>
            </>
          )}

        {(playerFormMode ===
          "new" ||
          formMode ===
            "edit") && (
          <div className="space-y-4 rounded-[16px] border border-[#06142E]/10 bg-[#06142E]/[0.03] p-4 xl:col-span-2">
            <PlayerPhotoUploader
              value={
                newPhotoUrl ||
                undefined
              }
              playerName={`${newFirstName} ${newLastName}`.trim()}
              label="Foto giocatore"
              enableEditor
              defaultAspectRatio="1:1"
              onChange={(
                url,
              ) => {
                setNewPhotoUrl(
                  url,
                );

                setFormError(
                  null,
                );
              }}
              onRemove={() => {
                setNewPhotoUrl(
                  "",
                );

                setFormError(
                  null,
                );
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                  Nome
                </span>

                <input
                  type="text"
                  value={
                    newFirstName
                  }
                  onChange={(
                    event,
                  ) => {
                    setNewFirstName(
                      event.target.value,
                    );
                  }}
                  className="ludi-input"
                  placeholder="Nome"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                  Cognome
                </span>

                <input
                  type="text"
                  value={
                    newLastName
                  }
                  onChange={(
                    event,
                  ) => {
                    setNewLastName(
                      event.target.value,
                    );
                  }}
                  className="ludi-input"
                  placeholder="Cognome"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                  Anno di nascita
                </span>

                <input
                  type="number"
                  min={1940}
                  max={
                    new Date().getFullYear()
                  }
                  value={
                    newBirthYear
                  }
                  onChange={(
                    event,
                  ) => {
                    setNewBirthYear(
                      event.target.value,
                    );
                  }}
                  className="ludi-input"
                  placeholder="1998"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                  Rating
                </span>

                <input
                  type="number"
                  min={40}
                  max={99}
                  step={1}
                  value={
                    newBaseRating
                  }
                  onChange={(
                    event,
                  ) => {
                    setNewBaseRating(
                      event.target.value,
                    );
                  }}
                  className="ludi-input"
                  placeholder="NP"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Piede preferito
              </span>

              <select
                value={
                  newPreferredFoot
                }
                onChange={(
                  event,
                ) => {
                  setNewPreferredFoot(
                    event.target
                      .value as
                      PreferredFoot | "",
                  );
                }}
                className="ludi-input"
              >
                <option value="">
                  Non specificato
                </option>

                <option value="Destro">
                  Destro
                </option>

                <option value="Sinistro">
                  Sinistro
                </option>

                <option value="Ambidestro">
                  Ambidestro
                </option>
              </select>
            </label>

            {formMode !==
              "edit" && (
              <button
                type="button"
                onClick={() => {
                  setPlayerFormMode(
                    "existing",
                  );

                  setNewFirstName(
                    "",
                  );

                  setNewLastName(
                    "",
                  );

                  setNewBirthYear(
                    "",
                  );

                  setNewPhotoUrl(
                    "",
                  );

                  setNewBaseRating(
                    "",
                  );

                  setNewPreferredFoot(
                    "",
                  );

                  setFormError(
                    null,
                  );
                }}
                className="text-sm font-bold text-[#06142E]/55 hover:underline"
              >
                Annulla creazione
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Ruolo
            </span>

            <select
              value={
                role
              }
              onChange={(
                event,
              ) => {
                setRole(
                  event.target
                    .value as
                    SeasonPlayerRole,
                );
              }}
              className="ludi-input"
            >
              {SEASON_ROSTER_ROLES.map(
                (
                  currentRole,
                ) => (
                  <option
                    key={
                      currentRole
                    }
                    value={
                      currentRole
                    }
                  >
                    {
                      currentRole
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
              Numero
            </span>

            <input
              type="number"
              min={1}
              max={99}
              value={
                shirtNumber
              }
              onChange={(
                event,
              ) => {
                setShirtNumber(
                  event.target.value,
                );
              }}
              className="ludi-input"
              placeholder="10"
            />
          </label>
        </div>
      </div>

      {formError && (
        <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">
            {
              formError
            }
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={
          isSaving ||
          (
            formMode ===
            "edit"
              ? newFirstName
                    .trim()
                    .length <
                  2 ||
                newLastName
                  .trim()
                  .length <
                  2
              : playerFormMode ===
                  "existing"
                ? !selectedPlayerId
                : newFirstName
                      .trim()
                      .length <
                    2 ||
                  newLastName
                    .trim()
                    .length <
                    2
          )
        }
        className="ludi-button-primary mt-5 w-full sm:w-auto sm:min-w-[220px] disabled:opacity-40"
      >
        {isSaving
          ? "Salvataggio..."
          : formMode ===
              "edit"
            ? "Salva modifiche"
            : playerFormMode ===
                "new"
              ? "Crea e aggiungi alla rosa"
              : "Aggiungi alla rosa"}
      </button>
    </form>
  );
}

function createPlayerNameKey(
  firstName:
    string,
  lastName:
    string,
) {
  return `${firstName.trim().toLocaleLowerCase("it-IT")}::${lastName
    .trim()
    .toLocaleLowerCase("it-IT")}`;
}
