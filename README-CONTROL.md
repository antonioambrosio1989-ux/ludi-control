# Ludi Control

Web-app separata dedicata esclusivamente al Centro di Controllo della Ludis League.

## Stato della migrazione

Questa è la **Fase 1** della separazione da `ludi-os`.

Sono già stati separati:

- tutte le route `app/admin/**`;
- tutte le API necessarie presenti in `app/api/**`;
- componenti, hook, servizi e tipi condivisi;
- autenticazione Firebase e controllo ruolo admin;
- stesso `CompetitionProvider` / stessa configurazione Firestore;
- layout Control Center desktop-first con sidebar;
- navigazione mobile dedicata;
- rimozione della BottomNavigation pubblica dall'area amministrativa;
- root `/` che reindirizza a `/admin`;
- metadata `noindex` per il pannello di controllo.

La web-app pubblica originale non viene modificata da questo progetto.

## Backend

`ludi-control` deve utilizzare **lo stesso progetto Firebase** di Ludi OS.

Copia nel nuovo progetto Vercel le variabili d'ambiente già utilizzate da Ludi OS.
Vedi `.env.example` per l'elenco rilevato dal codice.

## Avvio locale

```powershell
npm ci
npm run dev
```

Apri:

```text
http://localhost:3000/admin
```

La pagina `/` reindirizza automaticamente al Centro di Controllo.

## Deployment suggerito

Progetto Vercel separato:

```text
ludisleague.it            -> Ludi OS pubblico
control.ludisleague.it    -> Ludi Control
```

Imposta nel progetto Ludi Control:

```text
NEXT_PUBLIC_SITE_URL=https://control.ludisleague.it
```

## Nota sulla prima fase

Le route amministrative mantengono per ora il prefisso `/admin`.
Questo permette di separare subito le due web-app senza riscrivere decine di link,
redirect e chiamate interne nello stesso passaggio.

Una fase successiva potrà trasformare, ad esempio:

```text
/admin/partite     -> /partite
/admin/squadre     -> /squadre
/admin/games       -> /games
```

senza impattare l'app pubblica.
