import { Search, Star, X } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { sb } from "../lib/api.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import { episodesWindow, followedShows, searchShows, setFollowed, type EpisodeHit, type FollowedShow, type ShowHit } from "../lib/series.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { Sheet } from "./Sheet.tsx";
import { fmtDec } from "../lib/num.ts";

interface Preview { reference: number; chance: number; odds_yes: number; odds_no: number }
const code = async (error: unknown) => { try { return (await (error as { context?: Response })?.context?.json())?.error ?? "generic"; } catch { return "generic"; } };

/** Pick a series (or one you follow), an episode and a rating: the server checks the episode at the source and prices the bet. */
export function SeriesMaker(p: { msg: Messages; locale: Locale; initial?: FollowedShow | null; onClose: () => void; onCreated: (m: MarketRow) => void }) {
  const m = p.msg.series;
  const [follow, setFollow] = useState<FollowedShow[]>(followedShows);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ShowHit[] | null>(null);
  const [show, setShow] = useState<FollowedShow | null>(p.initial ?? null);
  const [eps, setEps] = useState<EpisodeHit[] | null>(null);
  const [ep, setEp] = useState<EpisodeHit | null>(null);
  const [thr, setThr] = useState<number | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [busy, run] = useBusy(), [err, setErr] = useState<string | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (q.trim().length < 2 || show) { setHits(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => searchShows(q.trim(), ctl.signal).then(setHits).catch(() => {}), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, show]);
  useEffect(() => {
    setEps(null); setEp(null); setPrev(null); setThr(null);
    if (!show) return;
    const ctl = new AbortController();
    episodesWindow(show.id, ctl.signal).then(setEps).catch(() => setEps([]));
    return () => ctl.abort();
  }, [show?.id]);
  // price it: the first call finds the reference rating, later ones follow the stepper
  useEffect(() => {
    if (!ep) return;
    const ctl = { dead: false };
    const t = setTimeout(async () => {
      const { data, error } = await sb.functions.invoke("market-offer", { body: { type: "episode", episodeId: ep.id, threshold: thr ?? 7.5, preview: true } });
      if (ctl.dead) return;
      if (error) { const c = await code(error); const info = c === "too_certain" ? await (error as { context?: Response }).context?.clone().json().catch(() => null) : null; setErr(c === "too_certain" ? m.certain : c === "registration_required" ? m.register : c === "source_unavailable" ? m.noRatings : c === "bad_time" ? m.time : p.msg.errors.generic!); if (info?.reference && thr === null) setThr(Math.round(info.reference * 10) / 10); setPrev(null); return; }
      setErr(null);
      const pv = (data as { preview: Preview }).preview; setPrev(pv);
      if (thr === null) setThr(Math.round(pv.reference * 10) / 10);
    }, first.current ? 0 : 350);
    first.current = false;
    return () => { ctl.dead = true; clearTimeout(t); };
  }, [ep?.id, thr]);
  const toggleFollow = () => { if (!show) return; const on = follow.some((f) => f.id === show.id); const n = on ? follow.filter((f) => f.id !== show.id) : [...follow, show]; setFollow(n); setFollowed(n); };
  const create = () => run(async () => {
    if (!ep || thr === null) return;
    setErr(null);
    const { data, error } = await sb.functions.invoke("market-offer", { body: { type: "episode", episodeId: ep.id, threshold: thr } });
    if (error || !data?.market) { const c = await code(error); setErr(c === "limit" ? m.limit : c === "too_many_open" ? m.limit : c === "registration_required" ? m.register : c === "too_certain" ? m.certain : p.msg.errors.generic!); return; }
    p.onCreated(data.market as MarketRow);
  }, () => setErr(p.msg.errors.generic!));
  const when = (iso: string) => new Intl.DateTimeFormat(INTL_TAG[p.locale], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const isFollowed = !!show && follow.some((f) => f.id === show.id);
  return (
    <Sheet onClose={p.onClose} label={m.title}>
      <div class="shead"><h2>{m.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{m.body}</p>
      {!show && follow.length > 0 && <div class="mkchips wrap" aria-label={m.followed}>{follow.map((f) => <button key={f.id} class="mkchip" onClick={() => setShow(f)}><Star size={13} fill="currentColor" /> {f.name}</button>)}</div>}
      {show
        ? <button class="placerow" onClick={() => { setShow(null); setQ(""); }}><span class="pn"><b>{show.name}</b></span><X size={16} /></button>
        : <>
            <label class="searchbox"><Search size={18} /><input class="field" value={q} placeholder={m.search} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autoFocus /></label>
            {hits?.map((h) => <button key={h.id} class="placerow" onClick={() => setShow({ id: h.id, name: h.name })}><span class="pn"><b>{h.name}</b><small>{[h.year, h.status].filter(Boolean).join(" · ")}</small></span></button>)}
          </>}
      {show && <button class={`btn secondary ${isFollowed ? "on" : ""}`} onClick={toggleFollow}><Star size={16} fill={isFollowed ? "currentColor" : "none"} /> {isFollowed ? m.unfollow : m.follow}</button>}
      {show && eps !== null && eps.length === 0 && <p class="hint">{m.noEpisodes}</p>}
      {show && eps && eps.length > 0 && <>
        <h3 class="steplabel">{m.pickEpisode}</h3>
        <div class="seplist">{eps.map((e) => <button key={e.id} class={`placerow ${ep?.id === e.id ? "sel" : ""}`} aria-pressed={ep?.id === e.id} onClick={() => { setEp(e); setThr(null); setPrev(null); }}><span class="pn"><b>S{String(e.season).padStart(2, "0")}E{String(e.number).padStart(2, "0")} · {e.name}</b><small>{when(e.airstamp)}</small></span></button>)}</div>
      </>}
      {ep && thr !== null && <div class="serating">
        <span class="detail">{m.threshold}</span>
        <div class="stepper"><button class="iconbtn" aria-label="−0,1" onClick={() => setThr(Math.max(1, Math.round((thr - 0.1) * 10) / 10))}>−</button><b class="num">{fmtDec(thr, 1, p.locale)}</b><button class="iconbtn" aria-label="+0,1" onClick={() => setThr(Math.min(10, Math.round((thr + 0.1) * 10) / 10))}>+</button></div>
        {prev && <p class="hint">{m.priced(fmtDec(prev.reference, 1, p.locale), Math.round(prev.chance * 100), fmtOdds(prev.odds_yes, p.locale), fmtOdds(prev.odds_no, p.locale))}</p>}
      </div>}
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || !ep || !prev} aria-busy={busy} onClick={create}>{busy ? m.creating : m.create}</button>
      <p class="hint">{m.credit}</p>
    </Sheet>
  );
}
