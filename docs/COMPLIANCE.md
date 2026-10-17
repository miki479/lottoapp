# LateBet — conformità: fonti dati, privacy, età, dominio

Stato al 16/10/2026. Il gioco è gratuito, senza denaro e senza pubblicità: questo lo rende "non commerciale" per quasi tutte le fonti. Se un giorno ci fossero pubblicità, abbonamenti o acquisti, **molte licenze gratuite cambiano** (vedi colonna "Se diventa commerciale").

## Fonti: cosa dicono i termini e cosa facciamo

| Fonte | Uso | Condizione | Stato | Se diventa commerciale |
|---|---|---|---|---|
| Open-Meteo (meteo, geocoding, aria) | ingestione ogni 6 h + ricerca città dal browser | gratis solo non commerciale, meno di 10.000 chiamate al giorno, attribuzione CC BY 4.0 | in regola (attribuzione nel footer) | piano a pagamento |
| ODPT (Giappone) | ritardi bus Yokohama | licenza ODPT, avviso e attribuzione obbligatori | in regola (testo ODPT nel footer, contatto via modulo) | verificare con ODPT |
| TVmaze | voti episodi | CC BY-SA, attribuzione | in regola | invariato |
| TheSportsDB | calendari/stemmi | la chiave gratuita è per sviluppo e test; per un servizio pubblico serve la chiave Patreon | **da sistemare**: sottoscrivere il piano a pagamento (circa 3 USD/mese) | invariato |
| API-Football | dettagli partite | piano gratuito 100 richieste al giorno | in regola, rispettare il tetto | piano a pagamento |
| Ticketmaster Discovery | eventi/concerti | mostrare attribuzione e link a Ticketmaster, 5.000 chiamate al giorno | attribuzione nel footer; **da fare**: link diretto all'evento dove si mostra un concerto | richiede accordo |
| Last.fm | ascoltatori artisti | uso non commerciale, link a Last.fm | in regola (voce aggiunta nel footer) | non consentito senza accordo |
| Steam Web API | giocatori online | termini Valve, nessuna rivendita dei dati | in regola | verificare |
| CoinGecko | prezzi cripto | piano gratuito: attribuzione "Powered by CoinGecko" | in regola | piano a pagamento |
| ESPN (punteggi in diretta) | live score ogni minuto | **nessuna API pubblica né licenza**: interfaccia non documentata | **rischio medio**: tenerla spenta se arriva una richiesta, oppure sostituire con API-Football | non consentito |
| ViaggiaTreno (RFI) | ritardi treni italiani | **nessuna licenza**: interfaccia non ufficiale | **rischio medio/alto**: lettura limitata a un minuto, mai sul percorso dell'utente; valutare un accordo con RFI/Trenitalia o i dati aperti GTFS-RT | non consentito |
| Allerta Meteo Emilia-Romagna | allerte | CC BY-NC-SA, solo non commerciale | in regola | **non consentito** |
| MIMIT, EIA, NOAA, NWS, USGS, Wikimedia | dati pubblici | pubblico dominio / IODL / CC0 | in regola | in regola |
| Feed GTFS-RT (busone, vbb, ovapi, ecc.) | ritardi bus/treni | licenze aperte per ciascun feed, attribuzione nel footer | in regola (solo feed con licenza verificata) | dipende dal feed |
| GBFS bike (Citi Bike, Divvy, ecc.) | occupazione bici | licenze dei gestori | in regola | verificare |
| Hugging Face | like dei modelli | pagine pubbliche | tenere la frequenza bassa | verificare |

**Cosa fare per essere tranquillo con i fornitori (in ordine di rischio):**
1. ViaggiaTreno ed ESPN: sono le due fonti senza licenza. Decidere se tenerle, sostituirle o chiedere il permesso.
2. TheSportsDB: passare alla chiave a pagamento.
3. Ticketmaster: aggiungere il link all'evento.
4. Registrarsi per una chiave propria (non condivisa) dove la usiamo già: Open-Meteo non ne richiede una per l'uso non commerciale.
5. Non rivendere né mostrare i dati grezzi: l'app li usa per calcolare quote e esiti, come richiesto da quasi tutti i termini.

## Età e gioco d'azzardo
- Il servizio dice "18+" nel footer e nei termini. Non è gioco d'azzardo: non c'è denaro, non si vince nulla di reale, nessun marchio di scommesse.
- Il testo "crediti finti / gioco satirico" resta nel footer e nelle pagine "Come funziona", "Termini" e "Privacy".

## Privacy (GDPR)
- Titolare: Michele Forte, persona fisica. Contatto: modulo "Scrivici" nel footer (nessun indirizzo email pubblico).
- Dati: account, profilo di gioco, messaggi del modulo, tracce anti-abuso (codici anonimi). Conservazione massima di 12 mesi per messaggi e tracce (cancellazione automatica notturna).
- Fornitori: Supabase, Firebase Hosting, OneSignal, Resend, Google (solo accesso con Google), Open-Meteo.
- Niente cookie di profilazione né pubblicità: servono solo memoria locale tecnica e notifiche con consenso, quindi non serve il banner cookie.
- Diritto alla cancellazione: Profilo → Elimina account.

## Dominio latebet.it
- Registrato da Michele Forte, presso Register.it. L'indirizzo del registrante risulta nel Whois solo se dai il consenso (sezione 5 del modulo): consigliato **non** darlo per un privato.
- Stato: latebet.it è collegato a Firebase Hosting con certificato HTTPS (www reindirizza). Supabase usa latebet.it come indirizzo del sito; latelotto.web.app resta attivo come riserva. Resta da fare: conferma email con Resend (record DNS già inseriti) e Site URL di OneSignal.
- Attenzione: le notifiche push sono legate all'indirizzo del sito. Passare a latebet.it significa che gli utenti dovranno riattivarle: si può fare con calma, tenendo latelotto.web.app come indirizzo secondario che reindirizza.
