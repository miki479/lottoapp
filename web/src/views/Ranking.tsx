import { ArrowDown, ArrowUp, Check, Share2, Swords, Trophy, TrendingDown, TrendingUp, UserMinus, Users, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Empty } from "../components/Empty.tsx";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { seasonDaysLeft } from "../lib/format.ts";
import type { GroupRow, LbRow, Profile } from "../lib/types.ts";
import type { Place } from "../lib/places.ts";
import { HomePlaceField } from "../components/HomePlaceField.tsx";
import { loadFriends, type FriendRow } from "../lib/friends.ts";
import { Look } from "../components/looks/Look.tsx";
import { useLooks } from "../lib/looks.ts";

type Tab = "world" | "local" | "friends";
type Local = "near" | "city" | "country";
const RADII = [10, 30, 50, 100];

export function Ranking(p: { locale: Locale; msg: Messages; profile: Profile | null; registered: boolean; onToast: (s: string, kind?: "ok" | "err") => void; onAuth: () => void; onNickname: () => void; home: Place | null; onHome: (pl: Place | null) => void; onRank: (rank: number | null, scope: string) => void; onProfile: (id: string) => void }) {
  const m = p.msg.ranking;
  const [tab, setTab] = useState<Tab>("world");
  const [local, setLocal] = useState<Local>("near");
  const [km, setKm] = useState(30);
  const scope = tab === "world" ? "global" : tab === "friends" ? "friends" : local === "near" ? "near" : local;
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [gname, setGname] = useState("");
  const [code, setCode] = useState("");
  const [fsub, setFsub] = useState<"board" | "groups">("board");
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const board = tab === "friends" && fsub === "board";
  const refreshFriends = async () => setFriends(await loadFriends());
  useEffect(() => { if (p.registered && board) refreshFriends(); }, [p.registered, board]);
  const looks = useLooks([...(rows ?? []).map((r) => r.user_id), ...(friends ?? []).map((r) => r.user_id)]);
  const face = (id: string) => { const l = looks[id]; return l ? <Look avatar={l.avatar} decoration={l.decoration} size={36} /> : <span class="lkph" />; };

  const loadGroups = async () => {
    const { data } = await sb.from("groups").select("code,name").order("created_at", { ascending: false });
    const list = (data ?? []) as GroupRow[]; setGroups(list); if (!group && list[0]) setGroup(list[0].code);
  };
  useEffect(() => { if (p.registered) loadGroups(); }, [p.registered]);
  const key = scope === "country" ? p.profile?.country : scope === "city" ? p.profile?.city_id : scope === "friends" ? group : scope === "near" ? String(km) : null;
  useEffect(() => {
    if (!p.registered || board) return;
    if (scope !== "global" && !key) { setRows([]); return; }
    if (scope === "near" && !p.home) { setRows([]); return; }
    setRows(null);
    let live = true; // a slower answer for a scope the player already left must not replace the current list
    sb.rpc("leaderboard", { p_scope: scope === "friends" ? "group" : scope, p_key: key ?? null, p_limit: 50 }).then(({ data }) => {
      if (!live) return;
      const r = ((data ?? []) as LbRow[]).map((x) => ({ ...x, rank: Number(x.rank), score: Number(x.score) }));
      setRows(r); if (scope === "global") p.onRank(r.find((x) => x.is_me)?.rank ?? null, m.scopes.global);
    });
    return () => { live = false; };
  }, [scope, key, p.registered, p.home?.id, board]);

  const [gbusy, setGbusy] = useState(false);
  const create = async () => { if (gbusy) return; setGbusy(true); const name = gname; setGname(""); const { data, error } = await sb.rpc("create_group", { p_name: name }); setGbusy(false); if (error) { setGname(name); return p.onToast(p.msg.errors[error.message.includes("nickname_not_allowed") ? "nickname_not_allowed" : error.message.includes("bad_nickname") ? "bad_nickname" : "registration_required"]!, "err"); } await loadGroups(); setGroup(String(data)); };
  const join = async () => { if (gbusy) return; setGbusy(true); const c0 = code; setCode(""); const { data, error } = await sb.rpc("join_group", { p_code: c0 }); setGbusy(false); if (error) { setCode(c0); return p.onToast(p.msg.errors[error.message.includes("unknown_group") ? "unknown_group" : "generic"]!, "err"); } await loadGroups(); setGroup(String(data)); setTab("friends"); setFsub("groups"); };

  if (!p.registered) return (
    <div class="screen stack"><h1>{m.title}</h1><div class="card"><Empty icon={Trophy} title={m.gate.title} body={m.gate.body} cta={m.gate.cta} onCta={p.onAuth} /></div></div>
  );
  return (
    <div class="screen stack" style="max-width:720px;margin:0 auto;width:100%">
      <h1>{m.title}</h1>
      <p class="detail">{m.season(seasonDaysLeft())}</p>
      {!p.profile?.display_name && <button class="card pressable" style="text-align:left" onClick={p.onNickname}><b>{p.msg.profile.nickname.title}</b><p class="hint">{p.msg.profile.nickname.label}</p></button>}
      <div class="seg" role="tablist">{(["world", "local", "friends"] as Tab[]).map((x) => <button key={x} role="tab" class={tab === x ? "on" : ""} aria-selected={tab === x} onClick={() => setTab(x)}>{p.msg.rankTabs[x]}</button>)}</div>
      {tab === "local" && (
        <section class="card stack">
          <div class="mkchips">{(["near", "city", "country"] as Local[]).map((x) => <button key={x} class={`mkchip ${local === x ? "on" : ""}`} aria-pressed={local === x} onClick={() => setLocal(x)}>{p.msg.rankTabs[x]}</button>)}</div>
          {local === "near" && !p.home && <><p class="hint">{p.msg.rankTabs.needHome}</p><HomePlaceField msg={p.msg} locale={p.locale} value={p.home} onChange={p.onHome} /></>}
          {local === "near" && p.home && <><div class="mkchips">{RADII.map((r) => <button key={r} class={`mkchip ${km === r ? "on" : ""}`} aria-pressed={km === r} onClick={() => setKm(r)}>{r} {p.msg.rankTabs.km}</button>)}</div><HomePlaceField msg={p.msg} locale={p.locale} value={p.home} onChange={p.onHome} /></>}
        </section>
      )}
      {tab === "friends" && (
        <div class="mkchips" role="tablist">{(["board", "groups"] as const).map((x) => <button key={x} role="tab" class={`mkchip ${fsub === x ? "on" : ""}`} aria-selected={fsub === x} onClick={() => setFsub(x)}>{x === "board" ? p.msg.frd.boardTab : p.msg.frd.groupsTab}</button>)}</div>
      )}
      {board && (
        <>
          <p class="detail">{p.msg.frd.boardHint}</p>
                    {friends === null && [0, 1, 2].map((i) => <div class="sk s" key={i} />)}
          {friends && friends.length <= 1 && <div class="card"><Empty icon={Users} title={p.msg.frd.empty} body={p.msg.frd.emptyBody} /></div>}
          {friends && friends.length > 1 && (
            <div class="list">
              {friends.map((r) => (
                <div class={`row ${r.is_me ? "me" : ""}`} key={r.user_id}>
                  <span class={`rank ${r.rank <= 3 ? "top" : ""}`}>{r.rank}</span>
                  {face(r.user_id)}
                  <button class="grow rowlink" onClick={() => p.onProfile(r.user_id)}><b>{r.display_name || p.msg.frd.anon}</b>{r.is_me && <span class="detail"> · {m.you}</span>}</button>
                  {r.prev_rank !== r.rank && <span class={`mv ${r.rank < r.prev_rank ? "up" : "down"}`} aria-label={r.rank < r.prev_rank ? "up" : "down"}>{r.rank < r.prev_rank ? <ArrowUp size={13} strokeWidth={3} /> : <ArrowDown size={13} strokeWidth={3} />}{Math.abs(r.prev_rank - r.rank)}</span>}
                  <span class={`score big num ${r.score > 0 ? "pos" : r.score < 0 ? "neg" : "zero"}`}>{r.score > 0 ? <ArrowUp size={15} strokeWidth={3} /> : r.score < 0 ? <ArrowDown size={15} strokeWidth={3} /> : null}{r.score > 0 ? "+" : r.score < 0 ? "−" : ""}{Math.abs(r.score)}</span>
                </div>
              ))}
            </div>
          )}
                            </>
      )}
      {tab === "friends" && fsub === "groups" && (
        <section class="card stack">
          {groups.length > 0 && <div class="chiprow">{groups.map((g) => <button key={g.code} class={`chip ${g.code === group ? "on" : ""}`} onClick={() => setGroup(g.code)}>{g.name}</button>)}</div>}
          {group && <button class="btn secondary" onClick={() => { navigator.clipboard?.writeText(group); p.onToast(p.msg.common.copied); }}><Users size={18} />{m.groups.yourCode(group)}</button>}
          {groups.length === 0 && <p class="hint">{m.groups.none}</p>}
          <div style="display:flex;gap:8px"><input class="field" value={gname} placeholder={m.groups.namePh} maxLength={30} onInput={(e) => setGname((e.target as HTMLInputElement).value)} /><button class="btn secondary" disabled={gbusy || gname.trim().length < 2} onClick={create}>{m.groups.create}</button></div>
          <div style="display:flex;gap:8px"><input class="field" value={code} placeholder={m.groups.codePh} maxLength={6} onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())} /><button class="btn secondary" disabled={gbusy || code.length < 6} onClick={join}>{m.groups.join}</button></div>
        </section>
      )}
      {!board && rows === null && [0, 1, 2, 3].map((i) => <div class="sk s" key={i} />)}
      {!board && rows && rows.length === 0 && <div class="card"><Empty icon={Trophy} title={m.empty.title} body={m.empty.body} /></div>}
      {!board && rows && rows.length > 0 && (
        <div class="list">
          {rows.map((r) => (
            <div class={`row ${r.is_me ? "me" : ""}`} key={r.user_id}>
              <span class={`rank ${r.rank <= 3 ? "top" : ""}`}>{r.rank}</span>
              {face(r.user_id)}
              <button class="grow rowlink" onClick={() => p.onProfile(r.user_id)}><b>{r.display_name}</b>{r.is_me && <span class="detail"> · {m.you}</span>}</button>
              <span class={`score num ${r.score > 0 ? "pos" : r.score < 0 ? "neg" : "zero"}`}>{r.score > 0 ? <TrendingUp size={14} /> : r.score < 0 ? <TrendingDown size={14} /> : null}{r.score > 0 ? "+" : r.score < 0 ? "−" : ""}{Math.abs(r.score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
