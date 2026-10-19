import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";

interface Stats { t: string; days: number; total: number; late_pct: number; rows: { kind: string; mins: number; n: number; pct: number }[]; hours: { hour: number; n: number; pct: number }[] }

const KIND: Record<string, string> = { REG: "Regionale", RV: "Regionale Veloce", FR: "Frecciarossa", FA: "Frecciargento", FB: "Frecciabianca", IC: "Intercity", ICN: "Intercity Notte", EC: "EuroCity" };
const nf = new Intl.NumberFormat("it-IT");

/**
 * The public page of delay numbers: what the last seven days of checks on Italian trains say, with the limits of the sample written next to them.
 * It is the thing to point at when somebody asks where the numbers come from: the way into the game is one button at the bottom.
 */
export function Ritardi() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    document.title = "Treni in ritardo: i numeri della settimana · LateBet";
    const d = document.querySelector('meta[name="description"]');
    d?.setAttribute("content", "Quanti treni italiani arrivano davvero in ritardo? I dati in tempo reale di ViaggiaTreno degli ultimi 7 giorni, per tipo di treno e per fascia oraria.");
    let live = true;
    sb.rpc("delay_stats").then(({ data, error }) => { if (!live) return; if (error || !data || !(data as Stats).total) setErr(true); else setS(data as Stats); });
    return () => { live = false; };
  }, []);
  const when = s ? new Date(s.t).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  const worst = s ? [...s.hours].sort((a, b) => b.pct - a.pct)[0] : undefined, best = s ? [...s.hours].sort((a, b) => a.pct - b.pct)[0] : undefined;
  return (
    <main class="rit">
      <a class="rit-back" href="/">← LateBet</a>
      <h1>Quanti treni sono davvero in ritardo?</h1>
      <p class="rit-sub">Ultimi 7 giorni, dati in tempo reale di ViaggiaTreno{s ? ` · aggiornato il ${when}` : ""}.</p>
      {err && <p class="rit-note">I numeri non sono disponibili in questo momento. Riprova tra qualche minuto.</p>}
      {!s && !err && <p class="rit-note">Carico i dati…</p>}
      {s && (
        <>
          <div class="rit-hero">
            <div><b>{nf.format(s.total)}</b><span>verifiche in {s.days} giorni</span></div>
            <div><b>{s.late_pct}%</b><span>ha superato la soglia di ritardo</span></div>
          </div>
          <h2>Per tipo di treno</h2>
          <p class="rit-note">Quota di verifiche in cui il ritardo ha superato la soglia indicata. Sono mostrate solo le combinazioni con almeno 100 verifiche.</p>
          <ul class="rit-bars">
            {s.rows.map((r) => (
              <li key={r.kind + r.mins}>
                <span class="rit-lab">{KIND[r.kind] ?? r.kind} · oltre {r.mins} min</span>
                <span class="rit-track"><i style={{ width: `${Math.max(2, r.pct)}%` }} /></span>
                <span class="rit-val">{r.pct}% <small>({nf.format(r.n)})</small></span>
              </li>
            ))}
          </ul>
          <h2>Per fascia oraria</h2>
          <p class="rit-note">Quota di verifiche con più di 5 minuti di ritardo, per ora del giorno (ora italiana).{worst && best ? ` Nel nostro campione l'ora peggiore è quella delle ${worst.hour}:00 (${worst.pct}%), la migliore quella delle ${best.hour}:00 (${best.pct}%).` : ""}</p>
          <ul class="rit-bars rit-hours">
            {s.hours.map((h) => (
              <li key={h.hour}>
                <span class="rit-lab">{String(h.hour).padStart(2, "0")}:00</span>
                <span class="rit-track"><i style={{ width: `${Math.max(2, h.pct * 2)}%` }} /></span>
                <span class="rit-val">{h.pct}%</span>
              </li>
            ))}
          </ul>
          <h2>Come sono stati raccolti</h2>
          <ul class="rit-method">
            <li>Fonte: i dati in tempo reale di ViaggiaTreno, la stessa fonte dei tabelloni delle stazioni.</li>
            <li>Per ogni treno e fermata controllata, il sistema verifica a posteriori se il ritardo ha superato una soglia (5, 10, 15 minuti e così via).</li>
            <li><strong>Non è una statistica ufficiale e il campione non è casuale</strong>: sono i treni e le fermate per cui è stata creata una domanda, non tutti i treni d'Italia.</li>
            <li>Le soglie sono diverse da quelle usate dai dati ufficiali di puntualità, quindi i numeri non sono direttamente confrontabili.</li>
          </ul>
        </>
      )}
      <div class="rit-cta">
        <h2>Aspetti un treno?</h2>
        <p>LateBet è un gioco gratuito: prevedi se un treno arriverà in ritardo, con crediti finti. Niente soldi veri, niente pubblicità, solo 18+.</p>
        <a class="btn primary" href="/?open=train&utm_source=ritardi&utm_medium=page">Prova a prevedere un ritardo</a>
      </div>
    </main>
  );
}
