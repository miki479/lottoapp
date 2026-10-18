# Cron di LateBet sul tuo PC (opzionale)

Fa girare sul tuo computer le cinque chiamate che Supabase fa ogni minuto: `ingest`, `ingest-heavy`, `resolve`, `live`, `snapshot`.
Il sito e il database restano su Firebase e Supabase: si sposta solo il lavoro di fondo (leggere i feed, creare e chiudere le puntate, aggiornare gli snapshot).

## Come funziona
- Ogni funzione parte in locale con Deno e viene chiamata alla stessa frequenza di prima.
- Dopo ogni esecuzione riuscita il PC lo scrive nel database (`home_cron_beat`).
- Il cron di Supabase, prima di partire, guarda quel segnale: se il PC ha riferito negli ultimi 150 secondi resta fermo, altrimenti parte come sempre.
  Se spegni il PC o cade internet, dopo meno di tre minuti riprende Supabase. Non devi fare niente.
- Il database resta su Supabase: si alleggeriscono le chiamate alle Edge Functions, non le scritture. Come bonus, i feed che bloccano gli IP dei cloud (per esempio OpenSky) rispondono da casa.

## Cosa serve
1. Node 20 o più recente e Deno 2 (https://deno.com: un comando di installazione).
2. Questo repository sul PC (`git clone`, poi `npm install` non serve).
3. Copia `scripts/home-cron/.env.example` in `scripts/home-cron/.env` e compila:
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase, Project settings, API). È una chiave segreta: non condividerla e non committarla.
   - le chiavi dei servizi che usi (stessi valori che hai nei Secrets delle Edge Functions).
4. Una sola volta: `node scripts/build-functions.mjs` (copia le cartelle condivise accanto alle funzioni). Rifallo dopo ogni `git pull` che cambia `shared/` o `cities/`.

## Avvio
```
node scripts/home-cron/home-cron.mjs
```
Per provare solo alcuni job: `node scripts/home-cron/home-cron.mjs snapshot,live`.
La prima esecuzione parte dopo circa 20 secondi (Deno scarica le dipendenze la prima volta).
Se Deno non è nel PATH: `DENO_BIN=/percorso/deno`.

Per tenerlo sempre acceso: con `pm2` (`pm2 start scripts/home-cron/home-cron.mjs --name latebet-cron`) o come servizio (systemd su Linux, Utilità di pianificazione su Windows con avvio all'accesso).

## Controlli
- Nel terminale compare una riga per ogni esecuzione (`ingest: 200 in 1800 ms`).
- Nel database: `select * from app_settings where key like 'home_cron:%'` mostra l'ultimo segnale (secondi Unix) di ogni job.
- Per tornare solo a Supabase basta fermare lo script.

## Cose da sapere
- Il PC deve poter raggiungere Supabase (uscita HTTPS) e i feed esterni: nessuna porta va aperta e il PC non è esposto a Internet.
- Se ti serve più sicurezza, usa un PC dedicato e tieni la chiave di servizio solo lì.
