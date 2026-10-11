import type { Messages } from "./types.ts";

const enGB: Messages = {
  tagline: "Wager pretend credits on real delays.",
  tabs: { bus: "Buses", train: "Trains", weather: "Weather", traffic: "Traffic", mine: "My bets" },
  credits: "credits",
  city: "City",
  language: "Language",
  disclaimerShort: "Only a game: pretend credits, no real value whatsoever.",
  disclaimerFull:
    "LateLotto is a game. Credits are fictional, worth nothing, and cannot be bought, sold or swapped for prizes. No real money, now or ever.",
  attributionTitle: "Data sources",
  loading: "Fetching events…",
  retry: "Try again",
  empty: {
    markets: "Nothing to bet on at the moment. Even buses are entitled to a tea break. Do pop back shortly.",
    mine: "No bets yet. Rather like the 8:15, nothing is happening.",
    trafficSoon: "Traffic is coming soon. You may, of course, simply look at the M25.",
  },
  closesIn: (m) => (m < 1 ? "closing momentarily" : m < 60 ? `closes in ${m} min` : `closes in ${Math.floor(m / 60)}h ${m % 60}m`),
  closedSoon: "closing shortly",
  question: {
    bus: (q) => `Will the ${q.route} towards ${q.headsign} be more than ${q.min} minutes late at ${q.stop} at ${q.time}?`,
    train: (q) => `Will the ${q.route} to ${q.headsign} reach ${q.stop} more than ${q.min} minutes late at ${q.time}?`,
    rain: (q) => `Will it rain in ${q.city} at ${q.time}? (Reasonable odds that it will.)`,
  },
  pick: { yes: "Yes", no: "No" },
  sheet: {
    stake: "How much?",
    potential: "You'd win",
    place: "Place bet",
    placing: "One moment…",
    cancel: "Cancel",
    odds: "odds",
    done: (w) => `Done. Should you be right, that's ${w} credits.`,
  },
  mine: {
    open: "Pending",
    won: (n) => `Won: +${n}`,
    lost: "Lost",
    void: "Void, stake returned",
    voidReason: {
      feed_down: "The data feed was down. We never settle on a hunch.",
      no_observation: "No valid reading for this service.",
      implausible_data: "The reading looked dubious.",
    },
    yourPick: (y) => (y ? "You said: Yes" : "You said: No"),
  },
  errors: {
    generic: "Something has gone wrong. Please try again.",
    market_closed: "Too late, I'm afraid. Betting on this one has closed.",
    insufficient_credits: "You haven't enough credits.",
    bad_stake: "Stakes run from 10 to 500 credits.",
    bad_pick: "That pick isn't valid.",
    already_bet: "You've already had a go at this one.",
    not_authenticated: "Still setting up. Try again in a moment.",
  },
  feedWarning: "Some data is running late. Bets tied to a stalled feed are refunded.",
  save: {
    title: "Save your progress",
    body: "Pop in your email and we'll send a link, so your credits and ranking follow you to a new phone.",
    email: "Your email address",
    send: "Send me the link",
    sent: "Check your inbox and follow the link.",
    later: "Not now",
  },
  offline: "You're offline. Events will refresh once you're back.",
};
export default enGB;
