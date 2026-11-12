export type MarketConfig = {format?: unknown; firstReturnMatchweek?: unknown; marketWindow?: unknown; status?: unknown; regularSeasonClosed?: unknown; competitionId?: unknown};
export function isDate(value: unknown): value is string {
  if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(value+"T12:00:00Z");return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export function romeToday(): string {return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function assertMarketOpen(s:MarketConfig, date:unknown, today:string):void {
 if(s.status!=="active" || s.regularSeasonClosed===true) throw new Error("Stagione non attiva o regular season chiusa.");
 if(s.format!=="double_round_robin" || !Number.isSafeInteger(s.firstReturnMatchweek) || (s.firstReturnMatchweek as number)<2 || (s.firstReturnMatchweek as number)>100) throw new Error("Mercato non previsto per questa stagione.");
 const w=s.marketWindow as Record<string,unknown>|undefined;
 if(!w || !isDate(w.startDate) || !isDate(w.endDate) || w.startDate>w.endDate) throw new Error("Finestra di mercato non configurata.");
 if(!isDate(date) || !isDate(today) || date!==today || today<w.startDate || today>w.endDate) throw new Error("Trasferimento non consentito nella data richiesta.");
 if(typeof s.competitionId!=="string" || !s.competitionId.trim()) throw new Error("Competizione assente.");
}
