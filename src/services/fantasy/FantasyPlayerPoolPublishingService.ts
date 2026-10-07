import {
  FirebaseFantasyPlayerRepository,
} from "@/src/repositories/firebase/FirebaseFantasyPlayerRepository";

import {
  FirebaseFantasySeasonRepository,
} from "@/src/repositories/firebase/FirebaseFantasySeasonRepository";

export type PublishFantasyPlayerPoolInput = {
  fantasySeasonId:
    string;

  publishedBy?:
    string;
};

export class FantasyPlayerPoolPublishingService {
  static async publish(
    input:
      PublishFantasyPlayerPoolInput,
  ): Promise<void> {
    const fantasySeason =
      await FirebaseFantasySeasonRepository
        .getById(
          input.fantasySeasonId,
        );

    if (
      !fantasySeason
    ) {
      throw new Error(
        "Stagione Fantacalcio non trovata.",
      );
    }

    if (
      fantasySeason.status ===
        "completed"
    ) {
      throw new Error(
        "La stagione Fantacalcio è già conclusa.",
      );
    }

    if (
      fantasySeason
        .playerListPublishedAt
    ) {
      throw new Error(
        "Il listone del Fantacalcio è già stato pubblicato.",
      );
    }

    const pool =
      await FirebaseFantasyPlayerRepository
        .getPoolBySeasonId(
          input.fantasySeasonId,
        );

    if (
      !pool
    ) {
      throw new Error(
        "Nessun listone disponibile per questa stagione.",
      );
    }

    if (
      pool.status ===
      "published"
    ) {
      throw new Error(
        "Il listone risulta già pubblicato.",
      );
    }

    const players =
      await FirebaseFantasyPlayerRepository
        .getPlayersBySeasonId(
          input.fantasySeasonId,
        );

    if (
      players.length ===
      0
    ) {
      throw new Error(
        "Non è possibile pubblicare un listone vuoto.",
      );
    }

    if (
      pool.playerCount !==
      players.length
    ) {
      throw new Error(
        "Il numero di giocatori del listone non coincide con quello registrato nel pool.",
      );
    }

    const invalidPlayers =
      players.filter(
        (player) =>
          !player.playerSeasonCode ||
          !player.teamCode ||
          !player.firstName ||
          !player.lastName ||
          player.cost <= 0 ||
          ![
            "goalkeeper",
            "defender",
            "forward",
          ].includes(
            player.role,
          ),
      );

    if (
      invalidPlayers.length >
      0
    ) {
      throw new Error(
        `Il listone contiene ${invalidPlayers.length} giocatori con dati non validi.`,
      );
    }

    const duplicatedPlayerSeasonCodes =
      this.findDuplicates(
        players.map(
          (player) =>
            player.playerSeasonCode,
        ),
      );

    if (
      duplicatedPlayerSeasonCodes.length >
      0
    ) {
      throw new Error(
        "Il listone contiene uno o più giocatori duplicati.",
      );
    }

    await FirebaseFantasyPlayerRepository
      .publishPool(
        input.fantasySeasonId,
        input.publishedBy,
      );

    try {
      await FirebaseFantasySeasonRepository
        .publishPlayerList(
          input.fantasySeasonId,
          input.publishedBy,
        );
    } catch (
      error
    ) {
      throw new Error(
        error instanceof
        Error
          ? `Il listone è stato pubblicato, ma non è stato possibile aprire le rose: ${error.message}`
          : "Il listone è stato pubblicato, ma non è stato possibile aprire le rose.",
      );
    }
  }

  private static findDuplicates(
    values:
      string[],
  ): string[] {
    const seen =
      new Set<string>();

    const duplicates =
      new Set<string>();

    for (
      const value
      of values
    ) {
      if (
        seen.has(
          value,
        )
      ) {
        duplicates.add(
          value,
        );

        continue;
      }

      seen.add(
        value,
      );
    }

    return [
      ...duplicates,
    ];
  }
}