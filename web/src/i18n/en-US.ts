import type { Messages } from "./types.ts";

const enUS: Messages = {
  tagline: "Bet fake credits on real delays.",
  tabs: { bus: "Bus", train: "Trains", weather: "Weather", traffic: "Traffic", mine: "My bets" },
  credits: "credits",
  city: "City",
  language: "Language",
  disclaimerShort: "Just a game: fake credits, zero real value.",
  disclaimerFull:
    "LateLotto is a game. Credits are fictional, have no cash value, can't be bought, sold, or traded for prizes. No real money, ever. Seriously.",
  attributionTitle: "Data sources",
  loading: "Loading events…",
  retry: "Try again",
  empty: {
    markets: "Nothing to bet on right now. Even buses take a break. Check back soon.",
    mine: "No bets yet. That delay won't bet on itself.",
    trafficSoon: "Traffic is coming soon. Honestly, you can probably see it from your window.",
  },
  closesIn: (m) => (m < 1 ? "closing any second" : m < 60 ? `closes in ${m} min` : `closes in ${Math.floor(m / 60)}h ${m % 60}m`),
  closedSoon: "closing soon",
  question: {
    bus: (q) => `Will the ${q.route} to ${q.headsign} run more than ${q.min} min late at ${q.stop} at ${q.time}?`,
    train: (q) => `Will the ${q.route} to ${q.headsign} roll into ${q.stop} more than ${q.min} min late at ${q.time}?`,
    rain: (q) => `Rain in ${q.city} at ${q.time}?`,
  },
  pick: { yes: "Yes", no: "No" },
  sheet: {
    stake: "How much?",
    potential: "You win",
    place: "Place bet",
    placing: "One sec…",
    cancel: "Cancel",
    odds: "odds",
    done: (w) => `Locked in! If you're right, that's ${w} credits.`,
  },
  mine: {
    open: "Live",
    won: (n) => `Won: +${n}`,
    lost: "Lost",
    void: "Voided, stake refunded",
    voidReason: {
      feed_down: "The data feed was down. We never settle on a guess.",
      no_observation: "No valid reading for this trip.",
      implausible_data: "The reading looked wrong.",
    },
    yourPick: (y) => (y ? "You said: Yes" : "You said: No"),
  },
  errors: {
    generic: "Something broke. Give it another shot.",
    market_closed: "Too late, betting on this one is closed.",
    insufficient_credits: "Not enough credits.",
    bad_stake: "Stakes run from 10 to 500 credits.",
    bad_pick: "Invalid pick.",
    already_bet: "You already bet on this one.",
    not_authenticated: "Still getting set up. Try again in a second.",
  },
  feedWarning: "Some data is running late. Bets tied to a stalled feed get refunded.",
  save: {
    title: "Save your progress",
    body: "Add your email and we'll send a link so your credits and rank follow you to a new phone.",
    email: "Your email",
    send: "Email me the link",
    sent: "Check your inbox and tap the link.",
    later: "Maybe later",
  },
  offline: "You're offline. Events will refresh when you're back.",
};
export default enUS;
