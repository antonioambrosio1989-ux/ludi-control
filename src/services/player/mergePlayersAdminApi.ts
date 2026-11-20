"use client";
import { auth } from "@/src/lib/firebase";

export type ManualMergeInput = {
  targetPlayerId: string;
  sourcePlayerId: string;
  currentSeasonId?: string;
};
export type ManualMergeResult = {
  targetPlayerId: string;
  sourcePlayerId: string;
  targetPlayerName: string;
  sourcePlayerName: string;
};
async function call(action: "preview" | "apply", input: ManualMergeInput) {
  const user=auth.currentUser;
  if(!user) throw new Error("Sessione scaduta: accedi nuovamente.");
  const token=await user.getIdToken();
  const response=await fetch("/api/admin/player-merge",{
    method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
    body:JSON.stringify({action,targetPlayerId:input.targetPlayerId,sourcePlayerId:input.sourcePlayerId}),
    cache:"no-store",
  });
  const result=await response.json() as ManualMergeResult & {error?:string};
  if(!response.ok) throw new Error(result.error || "Unione non riuscita.");
  return result;
}
export async function mergePlayersAdminApi(input: ManualMergeInput):Promise<ManualMergeResult> {
  // In mancanza di un controllo esplicito nel server, non invertiamo gli ID
  // scelti dall'utente. Il preflight blocca i conflitti senza scritture.
  await call("preview",input);
  return call("apply",input);
}
