export type Locale = "it" | "en-US" | "en-GB";
export const LOCALES: { id: Locale; label: string }[] = [
  { id: "it", label: "Italiano" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
];

export interface BusQ { route: string; headsign: string; stop: string; time: string; min: number }
export interface RainQ { city: string; time: string }

/** Every locale implements this: add `ja` by creating ja.ts and registering it in index.ts. */
export interface Messages {
  tagline: string;
  tabs: { bus: string; train: string; weather: string; traffic: string; mine: string };
  credits: string;
  city: string;
  language: string;
  disclaimerShort: string;
  disclaimerFull: string;
  attributionTitle: string;
  loading: string;
  retry: string;
  empty: { markets: string; mine: string; trafficSoon: string };
  closesIn: (min: number) => string;
  closedSoon: string;
  question: { bus: (q: BusQ) => string; train: (q: BusQ) => string; rain: (q: RainQ) => string };
  pick: { yes: string; no: string };
  sheet: { stake: string; potential: string; place: string; placing: string; cancel: string; odds: string; done: (win: number) => string };
  mine: { open: string; won: (n: number) => string; lost: string; void: string; voidReason: Record<string, string>; yourPick: (yes: boolean) => string };
  errors: Record<string, string>;
  feedWarning: string;
  save: { title: string; body: string; email: string; send: string; sent: string; later: string };
  offline: string;
}
