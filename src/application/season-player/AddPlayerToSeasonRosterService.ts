import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  FirebaseSeasonRepository,
} from "@/src/services/season/FirebaseSeasonRepository";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

export type AddPlayerToSeasonRosterCommand = {
  seasonId: string;
  teamId: string;

  firstName: string;
  lastName: string;
  birthYear?: number;

  role: SeasonPlayer["role"];
  shirtNumber?: number;
};

export type AddPlayerToSeasonRosterResult = {
  playerId: string;
  seasonPlayerId: string;
  playerCreated: boolean;
};

export class AddPlayerToSeasonRosterService {
  static async execute({
    seasonId,
    teamId,
    firstName,
    lastName,
    birthYear,
    role,
    shirtNumber,
  }: AddPlayerToSeasonRosterCommand): Promise<AddPlayerToSeasonRosterResult> {
    const normalizedFirstName =
      firstName.trim();

    const normalizedLastName =
      lastName.trim();

    if (!normalizedFirstName) {
      throw new Error(
        "Inserisci il nome del giocatore.",
      );
    }

    if (!normalizedLastName) {
      throw new Error(
        "Inserisci il cognome del giocatore.",
      );
    }

    if (
      birthYear !== undefined &&
      (!Number.isInteger(birthYear) ||
      birthYear < 1940 ||
      birthYear > new Date().getFullYear()
    ) ) {
      throw new Error(
        "Inserisci un anno di nascita valido.",
      );
    }

    const season =
      await FirebaseSeasonRepository.getById(
        seasonId,
      );

    if (
      !season?.competitionId
    ) {
      throw new Error(
        "La stagione non è associata a una competizione valida.",
      );
    }

    const {
      player,
      created,
    } =
      await FirebasePlayerRepository.findOrCreate({
        competitionId:
          season.competitionId,

        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        birthYear,
      });

    const alreadyRegistered =
      await FirebaseSeasonPlayerRepository.exists(
        seasonId,
        teamId,
        player.id,
      );

    if (alreadyRegistered) {
      throw new Error(
        "Il giocatore è già presente nella rosa di questa squadra.",
      );
    }

    const seasonPlayerId =
      await FirebaseSeasonPlayerRepository.create({
        seasonId,
        teamId,
        playerId: player.id,
        role,
        shirtNumber,
      });

    return {
      playerId: player.id,
      seasonPlayerId,
      playerCreated: created,
    };
  }
}
