# LateBet: conformità e protezione (stato al 17 ottobre 2026)

> Non sono un avvocato e questo non è un parere legale. È l'elenco onesto di cosa è già fatto nel codice, cosa serve da te e cosa è meglio far vedere a un professionista. **Nessuno può garantire una protezione "perfetta" su tutti i fronti**: si riduce il rischio e si documenta.

## 1. Già fatto (nel codice o nel database)
**Dati personali (GDPR)**
- Informativa privacy completa (IT/EN): titolare, dati raccolti, base giuridica, fornitori, trasferimenti extra UE, cookie/archiviazione, minori, violazioni (72 h), reclamo al Garante.
- Cancellazione dell'account e di tutti i dati (Profilo → Elimina account).
- **Copia dei propri dati** in JSON (Profilo → Scarica i miei dati): portabilità, art. 20.
- Conferma di età (18+) e accettazione di Termini e Privacy **alla registrazione**, salvata sull'account con versione e data (`profiles.terms_version`, `terms_accepted_at`).
- Nessun cookie di profilazione né pubblicità; posizione e notifiche solo con consenso; le coordinate non vengono salvate.
- Il filtro nomi e le segnalazioni passano da moduli interni; dati di contatto conservati al massimo 12 mesi.

**Sicurezza**
- Sicurezza a livello di riga (RLS) su tutte le tabelle; le funzioni sensibili sono riservate (`revoke` agli anonimi) e le operazioni sui crediti avvengono solo lato server.
- Intestazioni: CSP restrittiva, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP.
- `/.well-known/security.txt` per le segnalazioni di vulnerabilità.
- Limiti anti-abuso: puntate al minuto, creazione sfide, account multipli (codici anonimi), filtro nomi.
- Segreti solo in Supabase (mai nel codice); le chiavi del client sono pubbliche per progetto (anon).

**Dalle API (fonti dati)**
- Tetto giornaliero nostro e freno automatico (24 h) per API-Football; cache e limiti di frequenza per le altre; fonti primarie e di riserva (football-data.org → TheSportsDB).
- Elenco fonti e licenze in app (Profilo → Fonti) e nei Termini; nota su marchi, stemmi e loghi.
- Se una fonte non risponde la puntata viene annullata e rimborsata.

## 2. Cosa NON posso aggiungere
- **Loghi di "certificazioni"** (GDPR compliant, SSL secure, ISO, "approvato da…"): non esistono per questo tipo di app e metterli sarebbe un'affermazione falsa o ingannevole (pratica commerciale scorretta). Posso mostrare solo marchi veri che hai davvero ottenuto. Il badge Stripe Climate è nel footer perché mi hai dato i tuoi identificativi.
- Garantire che nessun dato vada mai perso o che nessun utente possa abusare: si limita, non si azzera.

## 3. Da fare tu (non si possono fare dal codice)
1. **Backup**: in Supabase attiva i backup giornalieri/PITR (piano Pro) e prova almeno una volta un ripristino. Il database è l'unica copia dei crediti e dei profili.
2. **Ruotare le chiavi** che sono comparse in chat o in screenshot: Resend, football-data.org (`FOOTBDATA_KEY`), TheSportsDB se personale, API-Football, NASA. Metti le nuove solo nei segreti Supabase.
3. **Account API-Football**: un solo account gratuito (due account sospendono tutto); se si risospende il problema è l'IP condiviso delle funzioni cloud.
4. **Accordi sul trattamento dati (DPA)**: accetta il DPA di Supabase, Google/Firebase, OneSignal, Resend e (se usato) Stripe; verifica la **regione** di Supabase (meglio UE) e scrivila nell'informativa.
5. **Provider di accesso**: Facebook va abilitato in Supabase (Authentication → Providers → Facebook) con ID e segreto dell'app Meta; l'indirizzo di ritorno da inserire in Meta è quello di Supabase (`https://<progetto>.supabase.co/auth/v1/callback`), **non** quello di Firebase. Per Meta serve la policy privacy pubblica e l'eliminazione dati (`https://latebet.it/privacy.html`).
6. **Account amministratore**: attiva l'autenticazione a due fattori su Supabase, Firebase, GitHub, Google, OneSignal, Resend.
7. **Registro dei trattamenti (art. 30)** e procedura di violazione: tienili in un documento; per un progetto piccolo bastano una pagina ciascuno.
8. **Revisione legale** (consigliata prima di una promozione seria): gioco con quote e puntate simulate, fascia d'età, premi/boost, eventuali sponsor o donazioni. Vedi i punti sotto.

## 4. Punti che richiedono un parere professionale
- **18+ e "gioco d'azzardo simulato"**: oggi è dichiarato 18+ e si conferma alla registrazione. Aprire ai minori richiede una riprogettazione (linguaggio, consenso dei genitori sotto i 14 anni) e di nuovo un parere. Negli store app il "gioco d'azzardo simulato" alza la fascia d'età.
- **Donazioni, sponsor, pubblicità o vendita di crediti**: cambierebbero la natura del servizio (fisco, e-commerce, norme sul gioco). Oggi i crediti non si comprano e non valgono nulla, e va mantenuto così.
- **Premi o concorsi** (anche simbolici): norme sui concorsi a premio.
- **Marchi e stemmi**: usarli solo per identificare squadre e giochi, senza far pensare a un rapporto ufficiale.
- **Dati dei minori**: se un minore si iscrive, l'account va eliminato appena lo si scopre.

## 5. Fonti dati: termini da tenere d'occhio
| Fonte | Chiave | Punti d'attenzione (da verificare ogni tanto sul sito) |
|---|---|---|
| football-data.org | sì (piano gratuito) | limite 10 richieste/minuto, dati con ritardo, attribuzione; il piano gratuito può escludere usi commerciali |
| TheSportsDB | sì (gratuita `123`) | chiave condivisa e limitata; per uso intensivo serve il piano a pagamento |
| API-Football | sì | account unico gratuito, 100 richieste/giorno, IP condivisi rischiosi |
| NASA (NeoWs, EONET) | sì (NASA_KEY) / no | dati pubblici; non usare il marchio NASA per far credere a un'approvazione |
| Chess.com PubAPI | no (User-Agent) | richiesta di cortesia: User-Agent riconoscibile, nessun abuso |
| Jolpica / OpenF1 | no | uso non commerciale e cortese |
| Launch Library 2 | no | 15 chiamate/ora gratuite |
| Hacker News (Algolia) | no | uso ragionevole |
| Steam Web API | sì | termini Valve: attribuzione, niente rivendita |
| Open-Meteo | no | gratuito per uso non commerciale (attribuzione CC BY) |

## 6. In caso di incidente (traccia da tenere pronta)
1. Isola: ruota le chiavi coinvolte (Supabase, Resend, OneSignal), disattiva le funzioni sospette.
2. Valuta cosa è uscito e di chi (il database tiene i log; `export_my_data` mostra cosa esiste per utente).
3. Se c'è rischio per le persone: notifica al Garante **entro 72 ore** (garanteprivacy.it) e avvisa gli interessati.
4. Annota tutto (data, cosa, azioni) nel registro delle violazioni, anche se non notifichi.
5. Ripristina da backup se serve e pubblica un avviso nell'app.

## 7. Prossimi passi che posso fare io
- Pagina "Fonti e crediti" dedicata e link dal footer.
- Controllo automatico mensile delle chiavi e dei limiti (avviso quando l'ultima chiamata riuscita è vecchia).
- Verifica di dipendenze (`npm audit`) e aggiornamenti di sicurezza.
- Riduzione dei dati personali dei log (indirizzi IP già hashati) e pulizia periodica.

## 8. Richieste delle autorità pubbliche sui dati degli utenti (procedura adottata)
Vale per qualsiasi richiesta di autorità (giudiziarie, di polizia, amministrative) di dati personali dei giocatori, compresi quelli ricevuti da Meta o Google al momento dell'accesso.
1. **Verifica di legalità:** una richiesta si accetta solo se è scritta, indica l'autorità, la base giuridica e i dati richiesti, e arriva da un canale verificabile. Si controlla con un professionista se i dubbi sono seri.
2. **Rifiuto se illegittima:** una richiesta illegittima, generica o eccessiva si rifiuta o si contesta per iscritto.
3. **Minimizzazione:** si comunica solo il minimo indispensabile (di norma l'identificativo dell'account, l'email e le date), mai più di quanto richiesto.
4. **Registro:** ogni richiesta viene annotata (data, autorità, base giuridica, dati richiesti, risposta data o rifiutata, chi ha deciso) e il registro viene conservato.
5. **Avviso all'utente:** si informa il giocatore interessato, salvo che la legge lo vieti.
6. Non si condividono dati con terzi per altri scopi e non si vendono.
