import { LocateFixed, Users } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { question, type MarketRow } from "../lib/format.ts";
import { Flag } from "./Flag.tsx";

export interface NearState { id: string; name: string; country: string }

/** "Near you": what people in your area are betting on most. Your position never leaves the phone: only the city name is used. */
export function NearYou(p: { msg: Messages; locale: Locale; now: number; near: NearState | null; items: { m: MarketRow; bets: number }[]; fallback: boolean; busy: boolean; onLocate: () => void; onOpen: (m: MarketRow) => void }) {
  const m = p.msg.near;
  return (
    <section class="card near stack" aria-label={m.title}>
      <div class="sectionhead" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <h2 style="display:flex;align-items:center;gap:8px"><LocateFixed size={22} style="color:var(--c-train)" />{m.title}</h2>
        {p.near && <button class="link" onClick={p.onLocate} disabled={p.busy}>{m.refresh}</button>}
      </div>
      {!p.near
        ? <><p class="hint">{m.ask}</p><button class="btn primary wide" onClick={p.onLocate} disabled={p.busy}><LocateFixed size={18} />{p.busy ? "…" : m.locate}</button><p class="hint">{m.privacy}</p></>
        : <>
            <span class="detail"><Flag cc={p.near.country} size={12} /> {m.zone(p.near.name)}</span>
            {p.fallback && p.items.length > 0 && <p class="hint">{m.first}</p>}
            {p.items.length === 0 && <p class="hint">{m.nothing}</p>}
            <ul class="nearlist">
              {p.items.map(({ m: mk, bets }) => {
                const c = cityOf(mk.city_id);
                return (
                  <li key={mk.id}>
                    <button class="nearrow" onClick={() => p.onOpen(mk)}>
                      <span class="nq">{question(mk, p.msg, p.locale, cityName(c, p.locale), c.timezone, new Date(p.now))}</span>
                      {!p.fallback && <span class="nb"><Users size={14} />{m.bets(bets)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>}
    </section>
  );
}
