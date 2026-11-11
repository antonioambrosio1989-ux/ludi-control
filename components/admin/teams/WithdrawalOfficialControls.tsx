'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/src/lib/firebase';

type Status={state:string|null;effectsApplied:boolean;policy:string|null;effectiveMatchweek:number|null;
  plannedWeeks:number[];closures:{week:number;matchId:string}[];awardedMatchIds:string[]};
export default function WithdrawalOfficialControls({seasonId,teamId,teamName,effectiveMatchweek,onChanged}:{
  seasonId:string;teamId:string;teamName:string;effectiveMatchweek:number;onChanged:()=>Promise<void>}){
  const [status,setStatus]=useState<Status|null>(null);
  const [confirm,setConfirm]=useState('');const [week,setWeek]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  async function authorized(url:string,init?:RequestInit){
    const user=auth.currentUser;if(!user)throw new Error('Accesso amministratore richiesto.');
    const token=await user.getIdToken();const res=await fetch(url,{...init,cache:'no-store',headers:{
      'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});
    const response=await res.json() as Record<string,unknown>;
    if(!res.ok)throw new Error(typeof response.error==='string'?response.error:'Operazione non riuscita.');
    return response;
  }
  async function reload(){
    const r=await authorized(`/api/admin/withdrawals/official?seasonId=${encodeURIComponent(seasonId)}&teamId=${encodeURIComponent(teamId)}`);
    setStatus(r as unknown as Status);
  }
  useEffect(()=>{
    let active=true;
    const stop=auth.onAuthStateChanged(u=>{if(u&&active)void reload().catch(e=>{if(active)setError(String(e));});});
    return()=>{active=false;stop();};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[seasonId,teamId]);
  const active=status?.state==='active'&&status.effectsApplied;
  const nextWeek=status?.plannedWeeks.find(w=>!status.closures.some(c=>c.week===w))??null;
  const pending=week??nextWeek;
  async function operate(action:'activate'|'close_and_award'){
    if(busy)return;
    const text=action==='activate'?`RITIRA ${teamId}`:`CHIUDI ${pending}`;
    if(confirm!==text)return;
    if(!window.confirm(action==='activate'?
      `ATTIVAZIONE UFFICIALE del ritiro di ${teamName} dalla giornata ${effectiveMatchweek}? Operazione con effetti sulla classifica.`:
      `Chiudere ufficialmente la giornata ${pending} e attribuire il tavolino 6-0?`))return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await authorized('/api/admin/withdrawals/official',{method:'POST',body:JSON.stringify({
        action,seasonId,teamId,expectedMatchweek:effectiveMatchweek,matchweek:pending,confirmation:text,
      })});
      setMessage(`Operazione completata: ${String(result.status)}.`);setConfirm('');setWeek(null);
      await reload();await onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Operazione non riuscita.');}
    finally{setBusy(false);}
  }
  return <div className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
    <h4 className="font-black text-slate-900">Operazioni ufficiali — {teamName}</h4>
    <p className="text-xs text-amber-950">Consentite soltanto nel girone di ritorno con calendario stagionale completo e senza anomalie. Ogni azione è verificata nuovamente sul server.</p>
    {!active&&status?.state==='draft_pending_activation'&&<>
      <p>Per attivare digita: <strong>RITIRA {teamId}</strong></p>
      <input aria-label="Conferma ufficiale" className="w-full rounded-lg border p-2" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
      <button type="button" className="rounded-lg bg-red-800 px-3 py-2 font-black text-white disabled:opacity-40"
        disabled={busy||confirm!==`RITIRA ${teamId}`} onClick={()=>void operate('activate')}>Attiva ritiro ufficiale</button>
    </>}
    {active&&<>
      <p className="font-black text-green-800">Ritiro ufficiale attivo.</p>
      {status?.plannedWeeks.map(w=><p key={w} className="text-xs">Giornata {w}: {status.closures.some(c=>c.week===w)?'CHIUSA':'da chiudere dopo tutti i tabellini della giornata'}</p>)}
      {nextWeek!==null&&<>
        <label className="block">Giornata da chiudere
          <select className="ml-2 rounded-lg border p-2" value={pending??''} onChange={e=>{setWeek(Number(e.target.value));setConfirm('');}}>
            {status?.plannedWeeks.filter(w=>!status.closures.some(c=>c.week===w)).map(w=><option value={w} key={w}>{w}</option>)}
          </select>
        </label>
        <p>Per confermare digita: <strong>CHIUDI {pending}</strong></p>
        <input aria-label="Conferma giornata" className="w-full rounded-lg border p-2" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
        <button type="button" disabled={busy||confirm!==`CHIUDI ${pending}`}
          className="rounded-lg bg-slate-900 px-3 py-2 font-black text-white disabled:opacity-40"
          onClick={()=>void operate('close_and_award')}>Chiudi giornata e registra 6–0</button>
      </>}
    </>}
    {error&&<p role="alert" className="text-red-800">{error}</p>}
    {message&&<p role="status" className="text-green-800">{message}</p>}
  </div>;
}
