import { collection, getDocs } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";
import { FirebaseMatchReportRepository } from "@/src/services/match/FirebaseMatchReportRepository";
import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";
import { FirebaseSeasonPlayerRepository } from "@/src/services/player/FirebaseSeasonPlayerRepository";
import { FirebaseTeamRepository } from "@/src/services/team/FirebaseTeamRepository";
import { FirebaseHallOfChampionsRepository } from "@/src/services/awards/FirebaseHallOfChampionsRepository";
import { WeeklyQuizKnowledgeBuilder } from "./WeeklyQuizKnowledgeBuilder";

export class FirebaseWeeklyQuizKnowledgeSource extends WeeklyQuizKnowledgeBuilder {
  constructor() {
    super({
      getDocuments: (name) => getDocs(collection(db, name)),
      players: FirebasePlayerRepository,
      teams: FirebaseTeamRepository,
      champions: FirebaseHallOfChampionsRepository,
      matches: FirebaseMatchRepository,
      seasonPlayers: FirebaseSeasonPlayerRepository,
      reports: FirebaseMatchReportRepository,
    });
  }
}
