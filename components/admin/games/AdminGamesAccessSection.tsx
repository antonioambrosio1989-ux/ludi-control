"use client";

import type {
  useAdminGamesAccess,
} from "@/src/hooks/useAdminGamesAccess";

type AdminGamesAccessHook =
  ReturnType<
    typeof useAdminGamesAccess
  >;

type AccessCodeStatus =
  | "available"
  | "disabled";

type Props = {
  hasManagedGamesSeason:
    boolean;

  accessLoading:
    boolean;

  totalSubscribers:
    number;

  paidSubscribers:
    number;

  presidentSubscribers:
    number;

  availableCodes:
    number;

  redeemedCodes:
    number;

  accessCodes:
    AdminGamesAccessHook["accessCodes"];

  accessCodeLabel:
    string;

  generatedAccessCode:
    string | null;

  isGeneratingAccessCode:
    boolean;

  updatingAccessCodeId:
    string | null;

  onAccessCodeLabelChange:
    (
      value:
        string,
    ) => void;

  onGenerateAccessCode:
    () => void | Promise<void>;

  onAccessCodeStatusChange:
    (
      codeId:
        string,

      status:
        AccessCodeStatus,
    ) => void | Promise<void>;
};

export default function AdminGamesAccessSection({
  hasManagedGamesSeason,
  accessLoading,
  totalSubscribers,
  paidSubscribers,
  presidentSubscribers,
  availableCodes,
  redeemedCodes,
  accessCodes,
  accessCodeLabel,
  generatedAccessCode,
  isGeneratingAccessCode,
  updatingAccessCodeId,
  onAccessCodeLabelChange,
  onGenerateAccessCode,
  onAccessCodeStatusChange,
}: Props) {
  return (
    <>
      <section>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
          Panoramica
        </p>

        <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
          Iscritti Games
        </h2>

        {!hasManagedGamesSeason ? (
          <EmptyCard>
            Nessuna Games Season configurata.
          </EmptyCard>
        ) : accessLoading ? (
          <EmptyCard>
            Caricamento iscritti...
          </EmptyCard>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Totali"
              value={
                totalSubscribers
              }
              dark
            />

            <StatCard
              label="Paganti"
              value={
                paidSubscribers
              }
            />

            <StatCard
              label="Presidenti"
              value={
                presidentSubscribers
              }
            />
          </div>
        )}
      </section>

      <section className="rounded-[24px] bg-white p-6 shadow-[0_12px_30px_rgba(6,20,46,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Accessi gratuiti
            </p>

            <h2 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
              Pass Presidenti
            </h2>
          </div>

          <div className="text-right">
            <p className="text-xs font-black text-emerald-700">
              {availableCodes} disponibili
            </p>

            <p className="mt-1 text-[10px] font-bold text-[#06142E]/35">
              {redeemedCodes} utilizzati
            </p>
          </div>
        </div>

        {!hasManagedGamesSeason ? (
          <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
            <p className="text-sm font-bold text-[#06142E]/45">
              Crea prima una Games Season.
            </p>
          </div>
        ) : (
          <>
            <label className="mt-6 block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/50">
                Assegnato a
              </span>

              <input
                type="text"
                value={
                  accessCodeLabel
                }
                onChange={(
                  event,
                ) =>
                  onAccessCodeLabelChange(
                    event.target.value,
                  )
                }
                placeholder="Es. Presidente Nottingham Forest"
                className="mt-2 min-h-12 w-full rounded-[13px] border border-[#06142E]/10 bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none"
              />
            </label>

            <button
              type="button"
              disabled={
                !accessCodeLabel.trim() ||
                isGeneratingAccessCode
              }
              onClick={() => {
                void onGenerateAccessCode();
              }}
              className="mt-4 min-h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGeneratingAccessCode
                ? "Generazione..."
                : "Genera pass Presidente"}
            </button>

            {generatedAccessCode && (
              <div className="mt-5 rounded-[18px] bg-emerald-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  Codice generato
                </p>

                <p className="mt-2 break-all text-lg font-black tracking-[0.08em] text-[#06142E]">
                  {generatedAccessCode}
                </p>

                <p className="mt-3 text-xs font-bold leading-5 text-[#06142E]/45">
                  Copia e consegna ora questo codice. Per sicurezza non viene salvato in chiaro nel database.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      generatedAccessCode,
                    );
                  }}
                  className="mt-4 min-h-11 w-full rounded-[12px] bg-white px-4 text-xs font-black uppercase text-[#06142E]"
                >
                  Copia codice
                </button>
              </div>
            )}
          </>
        )}

        {accessCodes.length >
          0 && (
          <div className="mt-6 border-t border-[#06142E]/10 pt-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
              Pass generati
            </p>

            <div className="mt-3 space-y-3">
              {accessCodes.map(
                (
                  code,
                ) => (
                  <div
                    key={
                      code.id
                    }
                    className="flex flex-col gap-3 rounded-[14px] bg-[#F5F5F2] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#06142E]">
                        {code.label}
                      </p>

                      <p className="mt-1 text-[9px] font-bold uppercase text-[#06142E]/35">
                        Pass Presidente
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
                          code.status ===
                            "available"
                            ? "bg-emerald-100 text-emerald-800"
                            : code.status ===
                                "redeemed"
                              ? "bg-[#06142E]/[0.08] text-[#06142E]/50"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {code.status ===
                          "available"
                          ? "Disponibile"
                          : code.status ===
                              "redeemed"
                            ? "Utilizzato"
                            : "Disattivato"}
                      </span>

                      {code.status ===
                        "available" && (
                        <button
                          type="button"
                          disabled={
                            updatingAccessCodeId ===
                            code.id
                          }
                          onClick={() => {
                            void onAccessCodeStatusChange(
                              code.id,
                              "disabled",
                            );
                          }}
                          className="rounded-[10px] bg-red-100 px-3 py-2 text-[9px] font-black uppercase text-red-700 disabled:opacity-40"
                        >
                          Disattiva
                        </button>
                      )}

                      {code.status ===
                        "disabled" && (
                        <button
                          type="button"
                          disabled={
                            updatingAccessCodeId ===
                            code.id
                          }
                          onClick={() => {
                            void onAccessCodeStatusChange(
                              code.id,
                              "available",
                            );
                          }}
                          className="rounded-[10px] bg-[#06142E] px-3 py-2 text-[9px] font-black uppercase text-white disabled:opacity-40"
                        >
                          Riattiva
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  dark = false,
}: {
  label:
    string;

  value:
    number;

  dark?:
    boolean;
}) {
  return (
    <div
      className={`rounded-[18px] p-4 shadow-[0_10px_24px_rgba(6,20,46,0.06)] ${
        dark
          ? "bg-[#06142E] text-white"
          : "bg-white text-[#06142E]"
      }`}
    >
      <p
        className={`text-[9px] font-black uppercase tracking-[0.12em] ${
          dark
            ? "text-white/40"
            : "text-[#06142E]/35"
        }`}
      >
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function EmptyCard({
  children,
}: {
  children:
    string;
}) {
  return (
    <div className="mt-4 rounded-[20px] bg-white p-5">
      <p className="text-sm font-bold text-[#06142E]/45">
        {children}
      </p>
    </div>
  );
}
