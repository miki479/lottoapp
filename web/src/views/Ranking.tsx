import { useEffect, useState } from "preact/hooks";
import { Chips } from "../components/Chips.tsx";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { seasonDaysLeft } from "../lib/format.ts";
import type { GroupRow, LbRow, Profile } from "../lib/types.ts";

type Scope = "global" | "country" | "city" | "friends";
const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : String(r));

export function Ranking(p: { msg: Messages; profile: Profile | null; registered: boolean; reload: () => void; onToast: (s: string) => void; onSave: () => void; onRank: (rank: number | null, scope: string) => void }) {
  const [scope, setScope] = useState<Scope>("global");
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [name, setName] = useState(p.profile?.display_name ?? "");
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const m = p.msg.ranking;

  const loadGroups = async () => {
    const { data } = await sb.from("groups").select("code,name").order("created_at", { ascending: false });
    const list = (data ?? []) as GroupRow[];
    setGroups(list); if (!group && list[0]) setGroup(list[0].code);
  };
  useEffect(() => { if (p.registered) loadGroups(); }, [p.registered]);

  const key = scope === "country" ? p.profile?.country : scope === "city" ? p.profile?.city_id : scope === "friends" ? group : null;
  useEffect(() => {
    if (!p.registered) return;
    if (scope !== "global" && !key) { setRows([]); return; }
    setRows(null);
    sb.rpc("leaderboard", { p_scope: scope === "friends" ? "group" : scope, p_key: key ?? null, p_limit: 50 }).then(({ data }) => {
      const r = ((data ?? []) as LbRow[]).map((x) => ({ ...x, rank: Number(x.rank), score: Number(x.score) }));
      setRows(r); const me = r.find((x) => x.is_me);
      if (scope === "global") p.onRank(me ? me.rank : null, m.scopes.global);
    });
  }, [scope, key, p.registered]);

  const saveName = async () => {
    const { error } = await sb.from("profiles").update({ display_name: name.trim() }).eq("id", p.profile!.id);
    if (error) p.onToast(p.msg.errors.generic!); else { p.reload(); setNewName(name.trim()); }
  };
  const create = async () => {
    const { data, error } = await sb.rpc("create_group", { p_name: newName || "LateLotto" });
    if (error) return p.onToast(p.msg.errors.registration_required!);
    await loadGroups(); setGroup(String(data)); setNewName("");
  };
  const join = async () => {
    const { data, error } = await sb.rpc("join_group", { p_code: code });
    if (error) return p.onToast(p.msg.errors[error.message.includes("unknown_group") ? "unknown_group" : "generic"]!);
    await loadGroups(); setGroup(String(data)); setCode(""); setScope("friends");
  };

  if (!p.registered) {
    return (
      <div class="view ranking">
        <h2 class="vt">{m.title}</h2>
        <section class="panel gate">
          <div class="big">🏆</div><h3>{m.needAccount.title}</h3><p>{m.needAccount.body}</p>
          <button class="primary shine wide" onClick={p.onSave}>{p.msg.save.send}</button>
        </section>
      </div>
    );
  }
  return (
    <div class="view ranking">
      <h2 class="vt">{m.title}</h2>
      <p class="season">⏳ {m.season(seasonDaysLeft())}</p>
      {!p.profile?.display_name && (
        <section class="panel namebox">
          <label>{m.name.label}</label>
          <div class="row"><input value={name} placeholder={m.name.placeholder} maxLength={24} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            <button class="primary" disabled={name.trim().length < 2} onClick={saveName}>{m.name.save}</button></div>
        </section>
      )}
      <Chips<Scope> small value={scope} onPick={setScope} chips={[
        { id: "global", label: m.scopes.global, icon: "🌍" }, { id: "country", label: m.scopes.country, icon: "🏳️" },
        { id: "city", label: m.scopes.city, icon: "🏙️" }, { id: "friends", label: m.scopes.friends, icon: "👥" }]} />
      {scope === "friends" && (
        <section class="panel groups">
          {groups.length > 0 && <div class="gl">{groups.map((g) => <button key={g.code} class={g.code === group ? "on" : ""} onClick={() => setGroup(g.code)}>{g.name}</button>)}</div>}
          {group && <button class="code" onClick={() => { navigator.clipboard?.writeText(group); p.onToast(m.groups.copied); }}>{m.groups.yourCode(group)}</button>}
          {groups.length === 0 && <p class="muted">{m.groups.none}</p>}
          <div class="row"><input value={newName} placeholder={m.groups.namePh} maxLength={30} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} /><button class="ghost" disabled={newName.trim().length < 2} onClick={create}>{m.groups.create}</button></div>
          <div class="row"><input value={code} placeholder={m.groups.codePh} maxLength={6} onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())} /><button class="ghost" disabled={code.length < 6} onClick={join}>{m.groups.join}</button></div>
        </section>
      )}
      <div class="lb">
        {rows === null && [0, 1, 2, 3].map((i) => <div class="sk" key={i} />)}
        {rows && rows.length === 0 && <p class="muted empty">{m.empty}</p>}
        {rows?.map((r, i) => (
          <div class={`lrow ${r.is_me ? "me" : ""} r${r.rank}`} key={r.user_id} style={`--i:${Math.min(i, 12)}`}>
            <span class="rk">{medal(r.rank)}</span>
            <span class="nm">{r.display_name}{r.is_me && <em>{m.you}</em>}{r.streak > 1 && <small>🔥{r.streak}</small>}</span>
            <b class={r.score >= 0 ? "good" : "bad"}>{r.score > 0 ? "+" : ""}{r.score}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
