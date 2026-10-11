import { Trophy, TrendingDown, TrendingUp, Users } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Empty } from "../components/Empty.tsx";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { seasonDaysLeft } from "../lib/format.ts";
import type { GroupRow, LbRow, Profile } from "../lib/types.ts";

type Scope = "global" | "country" | "city" | "friends";

export function Ranking(p: { msg: Messages; profile: Profile | null; registered: boolean; onToast: (s: string, kind?: "ok" | "err") => void; onAuth: () => void; onNickname: () => void; onRank: (rank: number | null, scope: string) => void }) {
  const m = p.msg.ranking;
  const [scope, setScope] = useState<Scope>("global");
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [gname, setGname] = useState("");
  const [code, setCode] = useState("");

  const loadGroups = async () => {
    const { data } = await sb.from("groups").select("code,name").order("created_at", { ascending: false });
    const list = (data ?? []) as GroupRow[]; setGroups(list); if (!group && list[0]) setGroup(list[0].code);
  };
  useEffect(() => { if (p.registered) loadGroups(); }, [p.registered]);
  const key = scope === "country" ? p.profile?.country : scope === "city" ? p.profile?.city_id : scope === "friends" ? group : null;
  useEffect(() => {
    if (!p.registered) return;
    if (scope !== "global" && !key) { setRows([]); return; }
    setRows(null);
    sb.rpc("leaderboard", { p_scope: scope === "friends" ? "group" : scope, p_key: key ?? null, p_limit: 50 }).then(({ data }) => {
      const r = ((data ?? []) as LbRow[]).map((x) => ({ ...x, rank: Number(x.rank), score: Number(x.score) }));
      setRows(r); if (scope === "global") p.onRank(r.find((x) => x.is_me)?.rank ?? null, m.scopes.global);
    });
  }, [scope, key, p.registered]);

  const create = async () => { const { data, error } = await sb.rpc("create_group", { p_name: gname }); if (error) return p.onToast(p.msg.errors[error.message.includes("nickname_not_allowed") ? "nickname_not_allowed" : error.message.includes("bad_nickname") ? "bad_nickname" : "registration_required"]!, "err"); await loadGroups(); setGroup(String(data)); setGname(""); };
  const join = async () => { const { data, error } = await sb.rpc("join_group", { p_code: code }); if (error) return p.onToast(p.msg.errors[error.message.includes("unknown_group") ? "unknown_group" : "generic"]!, "err"); await loadGroups(); setGroup(String(data)); setCode(""); setScope("friends"); };

  if (!p.registered) return (
    <div class="screen stack"><h1>{m.title}</h1><div class="card"><Empty icon={Trophy} title={m.gate.title} body={m.gate.body} cta={m.gate.cta} onCta={p.onAuth} /></div></div>
  );
  return (
    <div class="screen stack" style="max-width:720px;margin:0 auto;width:100%">
      <h1>{m.title}</h1>
      <p class="detail">{m.season(seasonDaysLeft())}</p>
      {!p.profile?.display_name && <button class="card pressable" style="text-align:left" onClick={p.onNickname}><b>{p.msg.profile.nickname.title}</b><p class="hint">{p.msg.profile.nickname.label}</p></button>}
      <div class="seg" role="tablist">{(["global", "country", "city", "friends"] as Scope[]).map((s) => <button key={s} role="tab" class={scope === s ? "on" : ""} aria-selected={scope === s} onClick={() => setScope(s)}>{m.scopes[s]}</button>)}</div>
      {scope === "friends" && (
        <section class="card stack">
          {groups.length > 0 && <div class="chiprow">{groups.map((g) => <button key={g.code} class={`chip ${g.code === group ? "on" : ""}`} onClick={() => setGroup(g.code)}>{g.name}</button>)}</div>}
          {group && <button class="btn secondary" onClick={() => { navigator.clipboard?.writeText(group); p.onToast(p.msg.common.copied); }}><Users size={18} />{m.groups.yourCode(group)}</button>}
          {groups.length === 0 && <p class="hint">{m.groups.none}</p>}
          <div style="display:flex;gap:8px"><input class="field" value={gname} placeholder={m.groups.namePh} maxLength={30} onInput={(e) => setGname((e.target as HTMLInputElement).value)} /><button class="btn secondary" disabled={gname.trim().length < 2} onClick={create}>{m.groups.create}</button></div>
          <div style="display:flex;gap:8px"><input class="field" value={code} placeholder={m.groups.codePh} maxLength={6} onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())} /><button class="btn secondary" disabled={code.length < 6} onClick={join}>{m.groups.join}</button></div>
        </section>
      )}
      {rows === null && [0, 1, 2, 3].map((i) => <div class="sk s" key={i} />)}
      {rows && rows.length === 0 && <div class="card"><Empty icon={Trophy} title={m.empty.title} body={m.empty.body} /></div>}
      {rows && rows.length > 0 && (
        <div class="list">
          {rows.map((r) => (
            <div class={`row ${r.is_me ? "me" : ""}`} key={r.user_id}>
              <span class={`rank ${r.rank <= 3 ? "top" : ""}`}>{r.rank}</span>
              <span class="grow"><b>{r.display_name}</b>{r.is_me && <span class="detail"> · {m.you}</span>}</span>
              <span class={`score num ${r.score > 0 ? "pos" : r.score < 0 ? "neg" : "zero"}`}>{r.score > 0 ? <TrendingUp size={14} /> : r.score < 0 ? <TrendingDown size={14} /> : null}{r.score > 0 ? "+" : r.score < 0 ? "−" : ""}{Math.abs(r.score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
