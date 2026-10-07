"use client";

import PlayerPhotoUploader from "@/components/admin/players/PlayerPhotoUploader";

import type {
  SeasonPlayerRole,
} from "@/src/types/SeasonPlayer";

import type {
  AdminPlayerFormMode,
} from "@/src/hooks/useAdminPlayersData";

import type {
  HistoricalImportSource,
} from "@/src/types/PlayerProfile";

type Props = {
  formRef:
    React.RefObject<HTMLFormElement | null>;

  formMode:
    AdminPlayerFormMode;

  firstName:
    string;

  setFirstName: (
    value:
      string,
  ) => void;

  lastName:
    string;

  setLastName: (
    value:
      string,
  ) => void;

  photoUrl:
    string;

  setPhotoUrl: (
    value:
      string,
  ) => void;

  birthYear:
    string;

  setBirthYear: (
    value:
      string,
  ) => void;

  coverImageUrl:
    string;

  setCoverImageUrl: (
    value:
      string,
  ) => void;

  baseRating:
    string;

  setBaseRating: (
    value:
      string,
  ) => void;

  historicalImportSources:
    HistoricalImportSource[];

  role:
    SeasonPlayerRole;

  setRole: (
    value:
      SeasonPlayerRole,
  ) => void;

  shirtNumber:
    string;

  setShirtNumber: (
    value:
      string,
  ) => void;

  editingSeasonPlayerId:
    string | null;

  isSaving:
    boolean;

  formError:
    string | null;

  onSubmit: (
    event:
      React.FormEvent<HTMLFormElement>,
  ) => void;
};

/*
 * ============================================================
 * FORM CREA / MODIFICA GIOCATORE
 * ============================================================
 */

export default function AdminPlayerForm({
  formRef,

  formMode,

  firstName,
  setFirstName,

  lastName,
  setLastName,

  photoUrl,
  setPhotoUrl,

  birthYear,
  setBirthYear,

  coverImageUrl,
  setCoverImageUrl,

  baseRating,
  setBaseRating,

  historicalImportSources,

  role,
  setRole,

  shirtNumber,
  setShirtNumber,

  editingSeasonPlayerId,

  isSaving,

  formError,

  onSubmit,
}: Props) {
  return (
    <form
      ref={
        formRef
      }
      onSubmit={
        onSubmit
      }
      className={`ludi-card p-5 ${
        formMode.type ===
        "create"
          ? "mb-5"
          : ""
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#06142E]/40">
        {formMode.type ===
        "create"
          ? "Nuova anagrafica"
          : "Modifica anagrafica"}
      </p>

      <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
        {formMode.type ===
        "create"
          ? "Nuovo giocatore"
          : "Modifica giocatore"}
      </h2>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Nome"
            value={
              firstName
            }
            onChange={
              setFirstName
            }
            placeholder="Mario"
            required
          />

          <TextField
            label="Cognome"
            value={
              lastName
            }
            onChange={
              setLastName
            }
            placeholder="Rossi"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Anno di nascita"
            value={
              birthYear
            }
            onChange={
              setBirthYear
            }
            placeholder="1998"
            min={
              1940
            }
            max={
              new Date()
                .getFullYear()
            }
          />

          <NumberField
            label="Rating"
            value={
              baseRating
            }
            onChange={
              setBaseRating
            }
            placeholder="NP"
            min={
              40
            }
            max={
              99
            }
          />
        </div>

        <PlayerPhotoUploader
          value={
            photoUrl
          }
          playerName={`${firstName} ${lastName}`}
          label="Foto giocatore"
          enableEditor
          defaultAspectRatio="1:1"
          onChange={(
            url,
          ) => {
            setPhotoUrl(
              url,
            );
          }}
          onRemove={() => {
            setPhotoUrl(
              "",
            );
          }}
        />

        <div>
          <TextField
            label="Immagine di copertina profilo"
            value={
              coverImageUrl
            }
            onChange={
              setCoverImageUrl
            }
            placeholder="URL immagine di copertina (opzionale)"
          />

          <p className="mt-2 text-[11px] font-bold leading-5 text-[#06142E]/40">
            Usata come sfondo dell’header del profilo giocatore e, dove previsto, nelle card in evidenza.
          </p>
        </div>

        {formMode.type ===
          "edit" &&
          historicalImportSources.length >
            0 && (
          <div className="rounded-[16px] border border-[#06142E]/10 bg-[#06142E]/[0.025] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
              Importazioni archivio storico
            </p>

            <div className="mt-3 space-y-2">
              {historicalImportSources.map(
                (source) => (
                  <div
                    key={`${source.seasonId}-${source.fileName}`}
                    className="rounded-[12px] border border-[#06142E]/8 bg-white px-3 py-3"
                  >
                    <p className="text-xs font-black text-[#06142E]">
                      {source.seasonName}
                    </p>

                    <p className="mt-1 break-all text-[11px] font-bold text-[#06142E]/50">
                      {source.fileName}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {formMode.type ===
          "edit" && (
          <div className="grid grid-cols-2 gap-3">
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
                disabled={
                  !editingSeasonPlayerId
                }
              >
                <option value="Portiere">
                  Portiere
                </option>

                <option value="Difensore">
                  Difensore
                </option>

                <option value="Attaccante">
                  Attaccante
                </option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Numero maglia
              </span>

              <input
                type="number"
                min={
                  1
                }
                max={
                  99
                }
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
                disabled={
                  !editingSeasonPlayerId
                }
              />
            </label>
          </div>
        )}
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
          firstName
            .trim()
            .length <
            2 ||
          lastName
            .trim()
            .length <
            2
        }
        className="ludi-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving
          ? "Salvataggio..."
          : formMode.type ===
              "create"
            ? "Crea giocatore"
            : "Salva modifiche"}
      </button>
    </form>
  );
}

/*
 * ============================================================
 * TEXT FIELD
 * ============================================================
 */

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label:
    string;

  value:
    string;

  onChange: (
    value:
      string,
  ) => void;

  placeholder:
    string;

  required?:
    boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
        {
          label
        }
      </span>

      <input
        type="text"
        value={
          value
        }
        required={
          required
        }
        onChange={(
          event,
        ) => {
          onChange(
            event.target.value,
          );
        }}
        className="ludi-input"
        placeholder={
          placeholder
        }
      />
    </label>
  );
}

/*
 * ============================================================
 * NUMBER FIELD
 * ============================================================
 */

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label:
    string;

  value:
    string;

  onChange: (
    value:
      string,
  ) => void;

  placeholder:
    string;

  min:
    number;

  max:
    number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
        {
          label
        }
      </span>

      <input
        type="number"
        value={
          value
        }
        min={
          min
        }
        max={
          max
        }
        step={
          1
        }
        onChange={(
          event,
        ) => {
          onChange(
            event.target.value,
          );
        }}
        className="ludi-input"
        placeholder={
          placeholder
        }
      />
    </label>
  );
}