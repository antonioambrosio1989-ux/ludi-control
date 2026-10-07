"use client";

import dynamic from "next/dynamic";
import DeferredSection from "@/components/ui/DeferredSection";
import SectionSkeleton from "@/components/ui/SectionSkeleton";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import AppShell from "@/components/ui/AppShell";
const AdminGamesAccessSection = dynamic(() => import("./AdminGamesAccessSection"), {
  loading: () => <SectionSkeleton label="Caricamento Accessi Games" rows={3} />,
});
const AdminGamesPricingSection = dynamic(() => import("./AdminGamesPricingSection"), {
  loading: () => <SectionSkeleton label="Caricamento Prezzi Games" rows={3} />,
});
const AdminGamesCatalogSection = dynamic(() => import("./AdminGamesCatalogSection"), {
  loading: () => <SectionSkeleton label="Caricamento Catalogo Games" rows={3} />,
});
import AdminGamesSeasonSection from "./AdminGamesSeasonSection";

import {
  useAdminGamesSeasons,
} from "@/src/hooks/useAdminGamesSeasons";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  useAdminGamesAccess,
} from "@/src/hooks/useAdminGamesAccess";

import {
  useAdminGamesGames,
} from "@/src/hooks/useAdminGamesGames";

import {
  useAdminGamesCatalogController,
} from "@/src/hooks/useAdminGamesCatalogController";

import {
  FirebaseGamesSeasonRepository,
} from "@/src/services/games/FirebaseGamesSeasonRepository";

import {
  toGamesDate,
} from "@/src/services/games/GamesSeasonStatusService";

import {
  buildGamesSeasonIdentity,
  type GamesPassPricePeriodInput,
} from "@/src/types/GamesSeason";

import type {
  GamesGame,
} from "@/src/types/GamesGame";

/*
 * ============================================================
 * ADMIN GAMES
 * ============================================================
 *
 * Nuova architettura:
 *
 * - una sola Games Season per stagione sportiva;
 * - nome generato automaticamente dalle date;
 * - tutte le competizioni sempre incluse;
 * - catalogo giochi permanente;
 * - Games Pass stagionale;
 * - giochi singoli con prezzo proprio;
 * - prezzo 0 = gioco gratuito;
 * - nessun archivio Games Season in UI.
 * ============================================================
 */

export default function AdminGamesScreen() {
  const router =
    useRouter();

  const {
    user,
  } =
    useAuth();

  const {
    gamesSeasons,
    activeGamesSeason,
    managedGamesSeason,
    isLoading:
      seasonsLoading,
    error:
      seasonsError,
  } =
    useAdminGamesSeasons();

  const {
    games,
    isLoading:
      gamesLoading,
    error:
      gamesError,
  } =
    useAdminGamesGames();

  const {
    accessCodes,
    totalSubscribers,
    paidSubscribers,
    presidentSubscribers,
    availableCodes,
    redeemedCodes,
    isLoading:
      accessLoading,
    error:
      accessError,
  } =
    useAdminGamesAccess(
      managedGamesSeason?.id,
    );

  /*
   * ==========================================================
   * CREATE GAMES SEASON
   * ==========================================================
   */

  const [
    seasonStartsAt,
    setSeasonStartsAt,
  ] =
    useState("");

  const [
    seasonEndsAt,
    setSeasonEndsAt,
  ] =
    useState("");

  const generatedSeasonIdentity =
    useMemo(
      () => {
        const startsAt =
          parseDateInputOptional(
            seasonStartsAt,
          );

        const endsAt =
          parseDateInputOptional(
            seasonEndsAt,
          );

        if (
          !startsAt ||
          !endsAt ||
          endsAt.getTime() <=
            startsAt.getTime()
        ) {
          return null;
        }

        return buildGamesSeasonIdentity(
          startsAt,
          endsAt,
        );
      },
      [
        seasonStartsAt,
        seasonEndsAt,
      ],
    );

  const duplicateGamesSeason =
    generatedSeasonIdentity
      ? gamesSeasons.find(
          (
            currentGamesSeason,
          ) =>
            currentGamesSeason.id ===
            generatedSeasonIdentity.id,
        ) ??
        null
      : null;

  /*
   * ==========================================================
   * GENERAL ACTION STATE
   * ==========================================================
   */

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  const [
    actionError,
    setActionError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  /*
   * ==========================================================
   * ACCESS CODES
   * ==========================================================
   */

  const [
    accessCodeLabel,
    setAccessCodeLabel,
  ] =
    useState("");

  const [
    generatedAccessCode,
    setGeneratedAccessCode,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    isGeneratingAccessCode,
    setIsGeneratingAccessCode,
  ] =
    useState(
      false,
    );

  const [
    updatingAccessCodeId,
    setUpdatingAccessCodeId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  /*
   * ==========================================================
   * GAME PASS PRICING
   * ==========================================================
   */

  const [
    isEditingPricing,
    setIsEditingPricing,
  ] =
    useState(
      false,
    );

  const [
    pricingDrafts,
    setPricingDrafts,
  ] =
    useState<
      GamesPassPricePeriodInput[]
    >([]);

  /*
   * ==========================================================
   * CREATE GAMES SEASON
   * ==========================================================
   */

  async function handleDeleteGamesSeason({
    gamesSeasonId,
    gamesSeasonName,
  }: {
    gamesSeasonId:
      string;

    gamesSeasonName:
      string;
  }) {
    if (
      isSaving
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          `Eliminare definitivamente la Games Season "${gamesSeasonName}"?`,
          "",
          "Verrà eliminato soltanto il documento della Games Season.",
          "Il catalogo permanente dei giochi NON verrà cancellato.",
          "Gli eventuali dati storici o accessi collegati non verranno eliminati automaticamente.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    clearMessages();

    try {
      await FirebaseGamesSeasonRepository
        .deleteArchived(
          gamesSeasonId,
        );

      setSuccessMessage(
        "Games Season eliminata. Ora puoi crearne una nuova.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione Games Season:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile eliminare la Games Season.",
        ),
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  async function handleCreateGamesSeason() {
    if (
      isSaving ||
      managedGamesSeason
    ) {
      return;
    }

    const startsAt =
      parseDateInputOptional(
        seasonStartsAt,
      );

    const endsAt =
      parseDateInputOptional(
        seasonEndsAt,
      );

    if (
      !startsAt ||
      !endsAt
    ) {
      setActionError(
        "Inserisci data di inizio e data di fine della Games Season.",
      );

      return;
    }

    if (
      endsAt.getTime() <=
      startsAt.getTime()
    ) {
      setActionError(
        "La data di fine deve essere successiva alla data di inizio.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    clearMessages();

    try {
      await FirebaseGamesSeasonRepository
        .createAndActivate({
          startsAt,
          endsAt,
        });

      setSeasonStartsAt(
        "",
      );

      setSeasonEndsAt(
        "",
      );

      setSuccessMessage(
        "Games Season creata e attivata correttamente.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore creazione Games Season:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile creare la Games Season.",
        ),
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * GAME PASS PRICING
   * ==========================================================
   */

  function handleOpenPricingEditor() {
    if (
      !managedGamesSeason
    ) {
      return;
    }

    const drafts:
      GamesPassPricePeriodInput[] = [];

    managedGamesSeason.passPricing.forEach(
      (
        period,
      ) => {
        const startsAt =
          toGamesDate(
            period.startsAt,
          );

        if (
          !startsAt
        ) {
          return;
        }

        const endsAt =
          toGamesDate(
            period.endsAt,
          );

        drafts.push({
          id:
            period.id,

          name:
            period.name,

          priceCents:
            period.priceCents,

          startsAt,

          endsAt,
        });
      },
    );

    setPricingDrafts(
      drafts,
    );

    clearMessages();

    setIsEditingPricing(
      true,
    );
  }

  function handleAddPricePeriod() {
    const nextIndex =
      pricingDrafts.length +
      1;

    const defaultStart =
      toGamesDate(
        managedGamesSeason
          ?.startsAt,
      ) ??
      new Date();

    setPricingDrafts(
      (
        current,
      ) => [
        ...current,
        {
          id:
            `price-${nextIndex}`,

          name:
            "",

          priceCents:
            0,

          startsAt:
            defaultStart,
        },
      ],
    );
  }

  function handleRemovePricePeriod(
    index:
      number,
  ) {
    setPricingDrafts(
      (
        current,
      ) =>
        current.filter(
          (
            _,
            currentIndex,
          ) =>
            currentIndex !==
            index,
        ),
    );
  }

  function handleUpdatePricePeriod(
    index:
      number,

    changes:
      Partial<
        GamesPassPricePeriodInput
      >,
  ) {
    setPricingDrafts(
      (
        current,
      ) =>
        current.map(
          (
            period,
            currentIndex,
          ) =>
            currentIndex ===
            index
              ? {
                  ...period,
                  ...changes,
                }
              : period,
        ),
    );
  }

  async function handleSavePricing() {
    if (
      !managedGamesSeason ||
      isSaving
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    clearMessages();

    try {
      await FirebaseGamesSeasonRepository
        .update({
          gamesSeasonId:
            managedGamesSeason.id,

          passPricing:
            pricingDrafts,
        });

      setIsEditingPricing(
        false,
      );

      setSuccessMessage(
        "Prezzi Games Pass aggiornati.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore aggiornamento prezzi Games Pass:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile aggiornare i prezzi Games Pass.",
        ),
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * ACCESS CODES
   * ==========================================================
   */

  async function handleGenerateAccessCode() {
    if (
      !user ||
      !managedGamesSeason ||
      !accessCodeLabel.trim() ||
      isGeneratingAccessCode
    ) {
      return;
    }

    setIsGeneratingAccessCode(
      true,
    );

    clearMessages();

    setGeneratedAccessCode(
      null,
    );

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/games/access-codes",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                gamesSeasonId:
                  managedGamesSeason.id,

                label:
                  accessCodeLabel.trim(),
              }),
          },
        );

      const data =
        (
          await response.json()
        ) as {
          code?:
            string;

          error?:
            string;
        };

      if (
        !response.ok ||
        !data.code
      ) {
        throw new Error(
          data.error ||
            "Impossibile generare il pass Presidente.",
        );
      }

      setGeneratedAccessCode(
        data.code,
      );

      setAccessCodeLabel(
        "",
      );

      setSuccessMessage(
        "Pass Presidente generato correttamente.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore generazione pass Presidente:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile generare il pass Presidente.",
        ),
      );
    } finally {
      setIsGeneratingAccessCode(
        false,
      );
    }
  }

  async function handleAccessCodeStatusChange(
    codeId:
      string,

    status:
      | "available"
      | "disabled",
  ) {
    if (
      !user ||
      updatingAccessCodeId
    ) {
      return;
    }

    setUpdatingAccessCodeId(
      codeId,
    );

    clearMessages();

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/games/access-codes/status",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                codeId,
                status,
              }),
          },
        );

      const data =
        (
          await response.json()
        ) as {
          success?:
            boolean;

          error?:
            string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Impossibile modificare il pass Presidente.",
        );
      }

      setSuccessMessage(
        status ===
          "disabled"
          ? "Pass Presidente disattivato."
          : "Pass Presidente riattivato.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore modifica pass Presidente:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile modificare il pass Presidente.",
        ),
      );
    } finally {
      setUpdatingAccessCodeId(
        null,
      );
    }
  }

  const {
    orderedGames,
    isSavingGame,
    resettingGameId,
    isGameOrderDirty,
    isSavingGameOrder,
    editingGameId,
    editingGameName,
    editingGameDescription,
    editingGamePrice,
    editingGameStatus,
    editingGameActivatesAt,
    setEditingGameName,
    setEditingGameDescription,
    setEditingGamePrice,
    setEditingGameStatus,
    setEditingGameActivatesAt,
    handleStartEditGame,
    handleCancelEditGame,
    handleSaveGameEdit,
    handleResetGame,
    handleMoveGame,
    handleCancelGameOrder,
    handleSaveGameOrder,
  } =
    useAdminGamesCatalogController({
      games,
      user,
      clearMessages,
      setActionError,
      setSuccessMessage,
    });

  /*
   * ==========================================================
   * DEVELOP GAME
   * ==========================================================
   */

  function handleDevelopGame(
    game:
      GamesGame,
  ) {
    /*
     * Manteniamo operativo il builder Fantacalcio già esistente.
     * Gli altri giochi entrano nel nuovo builder generico.
     */
    if (
      game.gameType ===
        "fantacalcio" &&
      managedGamesSeason
    ) {
      router.push(
        `/admin/games/fantacalcio/${game.id}?gamesSeasonId=${encodeURIComponent(
          managedGamesSeason.id,
        )}`,
      );

      return;
    }

    router.push(
      `/admin/games/giochi/${game.id}`,
    );
  }

  function handleDemoGame(
    game:
      GamesGame,
  ) {
    router.push(
      `/admin/games/demo/${game.id}`,
    );
  }

  /*
   * ==========================================================
   * HELPERS STATE
   * ==========================================================
   */

  function clearMessages() {
    setActionError(
      null,
    );

    setSuccessMessage(
      null,
    );

    setGeneratedAccessCode(
      null,
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
              Centro di controllo
            </p>

            <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
              Games
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#06142E]/45">
              Gestisci Games Season, accessi, Games Pass e catalogo permanente dei giochi.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-4 py-2 text-[10px] font-black uppercase ${managedGamesSeason ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {managedGamesSeason ? "Games Season attiva" : "Games Season da configurare"}
            </span>

            <span className="rounded-full border border-[#06142E]/10 bg-white px-4 py-2 text-[10px] font-black uppercase text-[#06142E]/45">
              {games.length} giochi
            </span>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Iscritti
            </p>
            <p className="mt-2 text-3xl font-black text-[#06142E]">
              {totalSubscribers}
            </p>
          </article>

          <article className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Paganti
            </p>
            <p className="mt-2 text-3xl font-black text-[#06142E]">
              {paidSubscribers}
            </p>
          </article>

          <article className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Codici disponibili
            </p>
            <p className="mt-2 text-3xl font-black text-[#06142E]">
              {availableCodes}
            </p>
          </article>

          <article className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Catalogo
            </p>
            <p className="mt-2 text-3xl font-black text-[#06142E]">
              {games.length}
            </p>
          </article>
        </section>

        {seasonsError && (
          <Alert
            error
          >
            {seasonsError}
          </Alert>
        )}

        {actionError && (
          <Alert
            error
          >
            {actionError}
          </Alert>
        )}

        {successMessage && (
          <Alert>
            {successMessage}
          </Alert>
        )}

        {accessError && (
          <Alert
            error
          >
            {accessError}
          </Alert>
        )}

        <AdminGamesSeasonSection
          managedGamesSeason={
            managedGamesSeason
          }
          activeGamesSeasonId={
            activeGamesSeason?.id ??
            null
          }
          seasonsLoading={
            seasonsLoading
          }
          isSaving={
            isSaving
          }
          duplicateGamesSeason={
            duplicateGamesSeason
          }
          generatedSeasonIdentity={
            generatedSeasonIdentity
          }
          seasonStartsAt={
            seasonStartsAt
          }
          seasonEndsAt={
            seasonEndsAt
          }
          onSeasonStartsAtChange={
            setSeasonStartsAt
          }
          onSeasonEndsAtChange={
            setSeasonEndsAt
          }
          onCreateGamesSeason={
            handleCreateGamesSeason
          }
          onDeleteGamesSeason={
            handleDeleteGamesSeason
          }
        />

        <section className="grid min-w-0 items-start gap-6 2xl:grid-cols-2">
          <DeferredSection label="Accessi Games">
          <AdminGamesAccessSection
          hasManagedGamesSeason={
            Boolean(
              managedGamesSeason,
            )
          }
          accessLoading={
            accessLoading
          }
          totalSubscribers={
            totalSubscribers
          }
          paidSubscribers={
            paidSubscribers
          }
          presidentSubscribers={
            presidentSubscribers
          }
          availableCodes={
            availableCodes
          }
          redeemedCodes={
            redeemedCodes
          }
          accessCodes={
            accessCodes
          }
          accessCodeLabel={
            accessCodeLabel
          }
          generatedAccessCode={
            generatedAccessCode
          }
          isGeneratingAccessCode={
            isGeneratingAccessCode
          }
          updatingAccessCodeId={
            updatingAccessCodeId
          }
          onAccessCodeLabelChange={
            setAccessCodeLabel
          }
          onGenerateAccessCode={
            handleGenerateAccessCode
          }
          onAccessCodeStatusChange={
            handleAccessCodeStatusChange
          }
        />
          </DeferredSection>

          <DeferredSection label="Prezzi Games">
          <AdminGamesPricingSection
          managedGamesSeason={
            managedGamesSeason
          }
          isEditingPricing={
            isEditingPricing
          }
          pricingDrafts={
            pricingDrafts
          }
          isSaving={
            isSaving
          }
          onOpenPricingEditor={
            handleOpenPricingEditor
          }
          onAddPricePeriod={
            handleAddPricePeriod
          }
          onRemovePricePeriod={
            handleRemovePricePeriod
          }
          onUpdatePricePeriod={
            handleUpdatePricePeriod
          }
          onCancelPricingEditor={() => {
            setIsEditingPricing(
              false,
            );
          }}
          onSavePricing={
            handleSavePricing
          }
        />
          </DeferredSection>
        </section>

        <DeferredSection label="Catalogo Games">
          <AdminGamesCatalogSection
          games={
            games
          }
          orderedGames={
            orderedGames
          }
          gamesError={
            gamesError
          }
          gamesLoading={
            gamesLoading
          }
          isGameOrderDirty={
            isGameOrderDirty
          }
          isSavingGameOrder={
            isSavingGameOrder
          }
          isSavingGame={
            isSavingGame
          }
          resettingGameId={
            resettingGameId
          }
          editingGameId={
            editingGameId
          }
          editingGameName={
            editingGameName
          }
          editingGameDescription={
            editingGameDescription
          }
          editingGamePrice={
            editingGamePrice
          }
          editingGameStatus={
            editingGameStatus
          }
          editingGameActivatesAt={
            editingGameActivatesAt
          }
          onCancelGameOrder={
            handleCancelGameOrder
          }
          onSaveGameOrder={
            handleSaveGameOrder
          }
          onMoveGame={
            handleMoveGame
          }
          onOpenVoting={(game) => {
            router.push(
              `/admin/games/giochi/${encodeURIComponent(
                game.id,
              )}/votazioni`,
            );
          }}
          onDevelopGame={
            handleDevelopGame
          }
          onDemoGame={
            handleDemoGame
          }
          onStartEditGame={
            handleStartEditGame
          }
          onResetGame={
            handleResetGame
          }
          onEditingGameNameChange={
            setEditingGameName
          }
          onEditingGameDescriptionChange={
            setEditingGameDescription
          }
          onEditingGamePriceChange={
            setEditingGamePrice
          }
          onEditingGameStatusChange={
            setEditingGameStatus
          }
          onEditingGameActivatesAtChange={
            setEditingGameActivatesAt
          }
          onCancelEditGame={
            handleCancelEditGame
          }
          onSaveGameEdit={
            handleSaveGameEdit
          }
        />
        </DeferredSection>

        {/*
         * Nessun archivio Games Season.
         *
         * I documenti scaduti restano nel database come storico
         * tecnico, ma non vengono mostrati né riattivati.
         */}
        <p className="pb-2 text-center text-[9px] font-bold text-[#06142E]/20">
          {gamesSeasons.length > 0
            ? "Le Games Season scadute non vengono mostrate nell'area amministrativa."
            : ""}
        </p>
      </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * SUBCOMPONENTS
 * ============================================================
 */

function Alert({
  children,
  error = false,
}: {
  children:
    string;

  error?:
    boolean;
}) {
  return (
    <div
      className={`rounded-[16px] p-4 ${
        error
          ? "bg-red-100"
          : "bg-emerald-100"
      }`}
    >
      <p
        className={`text-sm font-bold ${
          error
            ? "text-red-700"
            : "text-emerald-800"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

/*
 * ============================================================
 * FORMATTERS
 * ============================================================
 */

function parseDateInputOptional(
  value:
    string,
): Date | undefined {
  if (
    !value
  ) {
    return undefined;
  }

  return parseDateInput(
    value,
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

function getErrorMessage(
  error:
    unknown,

  fallback:
    string,
): string {
  return error instanceof
    Error
    ? error.message
    : fallback;
}
