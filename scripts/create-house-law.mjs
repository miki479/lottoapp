// House questions for the "law" category: laws, referendums and rules that people have fought over for years. Odds are a rough reading of the news, settled by hand
// (admin_house_settle) once the date has passed; unsettled questions are refunded at the deadline.   node scripts/create-house-law.mjs [--apply]
import { computeOdds } from "../shared/odds.ts";
import { supabaseUrl } from "./lib-env.mjs";

const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, apply = process.argv.includes("--apply");
const Q = [
  ["ma-q8", "2026-11-03", 0.06, "Il 3 novembre gli elettori del Massachusetts approveranno la Question 8 che abroga la vendita legale di cannabis ricreativa?", "On November 3, will Massachusetts voters approve Question 8 to repeal legal recreational cannabis sales?", "11月3日、マサチューセッツ州の有権者は娯楽用大麻の合法販売を廃止する「質問8」を承認する?"],
  ["us-hemp-thc", "2026-12-11", 0.6, "Entro l'11 dicembre il Congresso USA approverà un altro rinvio o un quadro che eviti il divieto federale dei prodotti di canapa con THC?", "By December 11, will the US Congress pass another delay or a framework that avoids the federal ban on THC hemp products?", "12月11日までに、米議会はTHC入りヘンプ製品の連邦禁止を回避する再延期または枠組みを可決する?"],
  ["it-canapa-parlamento", "2026-12-31", 0.02, "Entro il 31 dicembre il Parlamento italiano modificherà o abrogherà il divieto di infiorescenze di canapa?", "By December 31, will the Italian Parliament amend or repeal the ban on hemp flowers?", "12月31日までに、イタリア議会は麻の花の禁止を修正または廃止する?"],
  ["it-consulta-canapa", "2027-01-31", 0.03, "Entro il 31 gennaio 2027 la Corte costituzionale deciderà sul divieto delle infiorescenze di canapa?", "By January 31, 2027, will Italy's Constitutional Court rule on the hemp flower ban?", "2027年1月31日までに、イタリア憲法裁判所は麻の花の禁止について判断する?"],
  ["us-dea-s3", "2027-01-31", 0.08, "Entro il 31 gennaio 2027 la DEA pubblicherà la norma definitiva che sposta la cannabis dalla Tabella I alla III per tutti gli usi?", "By January 31, 2027, will the DEA publish the final rule moving cannabis from Schedule I to III for all uses?", "2027年1月31日までに、DEAは大麻を全用途でスケジュールIからIIIへ移す最終規則を公表する?"],
  ["de-kcang", "2027-01-31", 0.05, "Entro il 31 gennaio 2027 il Bundestag approverà una restrizione alla legalizzazione della cannabis ricreativa?", "By January 31, 2027, will the Bundestag pass a restriction on recreational cannabis legalisation?", "2027年1月31日までに、連邦議会は娯楽用大麻合法化の制限を可決する?"],
  ["nl-wiet", "2027-01-31", 0.08, "Entro il 31 gennaio 2027 il Parlamento olandese approverà una legge o mozione per fermare il wietexperiment?", "By January 31, 2027, will the Dutch parliament pass a law or motion to stop the wietexperiment?", "2027年1月31日までに、オランダ議会は大麻実験を止める法律または動議を可決する?"],
  ["co-adult-use", "2027-01-31", 0.03, "Entro il 31 gennaio 2027 il Congresso colombiano approverà in via definitiva la cannabis per uso adulto?", "By January 31, 2027, will Colombia's Congress give final approval to adult-use cannabis?", "2027年1月31日までに、コロンビア議会は成人用大麻を最終承認する?"],
  ["es-37h", "2027-01-31", 0.03, "Entro il 31 gennaio 2027 il Congresso spagnolo approverà la settimana lavorativa a 37,5 ore?", "By January 31, 2027, will Spain's Congress approve the 37.5-hour working week?", "2027年1月31日までに、スペイン議会は週37.5時間労働を承認する?"],
  ["it-salario-minimo", "2027-01-31", 0.02, "Entro il 31 gennaio 2027 la Camera approverà in via definitiva il salario minimo legale?", "By January 31, 2027, will the Italian Chamber give final approval to a statutory minimum wage?", "2027年1月31日までに、イタリア下院は法定最低賃金を最終承認する?"],
];
const rows = Q.map(([id, day, p, it, en, ja]) => {
  const d = Date.parse(day + "T00:00:00Z"), closes = d - 3600_000, at = (d + 86400_000) / 1000, odds = computeOdds(p);
  return {
    city_id: "world", category: "law", kind: "tick_gt", feed_id: `tick-house:law-${id}`,
    params: { series: `house:law-${id}`, at, unit: "", label: "Legalità", threshold: 0.5, house: true, art: "law", q: { it, en, ja } },
    closes_at: new Date(closes).toISOString(), target_at: new Date(at * 1000).toISOString(), deadline_at: new Date(at * 1000 + 45 * 86400_000).toISOString(),
    odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `world|tick_house:law-${id}|${at}|0.5`,
  };
});
for (const r of rows) console.log(r.dedupe_key, r.odds_yes, r.odds_no, r.closes_at);
if (apply) {
  const r = await fetch(`${SB}/rest/v1/markets?on_conflict=dedupe_key`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows) });
  console.log(r.status, (await r.text()).length);
}
