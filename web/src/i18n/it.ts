import type { Messages } from "./types.ts";

const it: Messages = {
  tagline: "Scommetti crediti finti su ritardi veri.",
  tabs: { bus: "Bus", train: "Treni", weather: "Meteo", traffic: "Traffico", mine: "Le mie" },
  credits: "crediti",
  city: "Città",
  language: "Lingua",
  disclaimerShort: "Solo gioco: crediti finti, nessun valore reale.",
  disclaimerFull:
    "LateLotto è un gioco. I crediti sono fittizi, non hanno alcun valore economico, non si comprano, non si vendono e non si cambiano con premi. Nessun denaro vero, mai.",
  attributionTitle: "Fonti dei dati",
  loading: "Carico gli eventi…",
  retry: "Riprova",
  empty: {
    markets: "Niente da scommettere per ora. Anche i bus ogni tanto riposano: riprova tra poco.",
    mine: "Non hai ancora scommesso nulla. Il primo ritardo non si scommette da solo.",
    trafficSoon: "Il traffico arriva presto. Per ora c'è già abbastanza gente ferma.",
  },
  closesIn: (m) => (m < 1 ? "chiude tra un attimo" : m < 60 ? `chiude tra ${m} min` : `chiude tra ${Math.floor(m / 60)} h ${m % 60} min`),
  closedSoon: "sta per chiudere",
  question: {
    bus: (q) => `La linea ${q.route} per ${q.headsign} avrà più di ${q.min} min di ritardo a ${q.stop} alle ${q.time}?`,
    train: (q) => `Il ${q.route} per ${q.headsign} arriverà con più di ${q.min} min di ritardo a ${q.stop} alle ${q.time}?`,
    rain: (q) => `Pioverà a ${q.city} alle ${q.time}?`,
  },
  pick: { yes: "Sì", no: "No" },
  sheet: {
    stake: "Quanto punti?",
    potential: "Se vinci",
    place: "Scommetti",
    placing: "Un attimo…",
    cancel: "Annulla",
    odds: "quota",
    done: (w) => `Fatto! Se va come dici, incassi ${w} crediti.`,
  },
  mine: {
    open: "In corso",
    won: (n) => `Vinta: +${n}`,
    lost: "Persa",
    void: "Annullata, puntata restituita",
    voidReason: {
      feed_down: "Il feed dei dati era giù: non risolviamo mai a caso.",
      no_observation: "Nessun dato valido per questa corsa.",
      implausible_data: "Il dato non era credibile.",
    },
    yourPick: (y) => (y ? "Hai detto: Sì" : "Hai detto: No"),
  },
  errors: {
    generic: "Qualcosa è andato storto. Riprova.",
    market_closed: "Troppo tardi: le puntate su questo evento sono chiuse.",
    insufficient_credits: "Non hai abbastanza crediti.",
    bad_stake: "La puntata deve essere tra 10 e 500 crediti.",
    bad_pick: "Scelta non valida.",
    already_bet: "Hai già scommesso su questo evento.",
    not_authenticated: "Sessione non pronta, riprova tra un secondo.",
  },
  feedWarning: "Alcuni dati sono in ritardo. Le scommesse legate a un feed fermo vengono rimborsate.",
  save: {
    title: "Salva i tuoi progressi",
    body: "Inserisci la tua email: ti mandiamo un link per conservare crediti e classifica anche cambiando telefono.",
    email: "La tua email",
    send: "Mandami il link",
    sent: "Controlla la posta e clicca il link.",
    later: "Più tardi",
  },
  offline: "Sei offline: gli eventi si aggiorneranno al ritorno della rete.",
};
export default it;
