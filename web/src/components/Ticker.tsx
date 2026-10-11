/** Endless marquee. Content is duplicated so the loop is seamless. */
export interface TickItem { text: string; tone?: "good" | "bad" | "warn" | "plain" }

export function Ticker({ items }: { items: TickItem[] }) {
  const row = items.map((it, i) => <span class={`tk ${it.tone ?? "plain"}`} key={i}>{it.text}</span>);
  return (
    <div class="ticker" aria-label="live results">
      <div class="ticker-track">
        <div class="ticker-row">{row}</div>
        <div class="ticker-row" aria-hidden="true">{row}</div>
      </div>
    </div>
  );
}
