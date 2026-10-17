import { STREAK_MILESTONES } from "../../../shared/rewards.ts";
import type { CardCat, PackRarity } from "../../../shared/cards.ts";
import type { Locale } from "../i18n/index.ts";

/** Words of the Rewards sheet tabs Today (daily bonus), Shop and Album. Kept here, per language, so no other i18n file changes. */
export interface HubText {
  tabs: { today: string; shop: string; album: string };
  daily: {
    title: string; sub: string; day: (n: number) => string; claim: (a: string) => string; claimed: string; resets: (t: string) => string;
    locked: (a: string) => string; play: string; lapsed: string; freezeNote: (n: number) => string; usesFreeze: string; freezeTile: string;
    milestones: (list: string) => string; milestone: (d: number, b: string) => string; refill: string; got: (a: string) => string; today: string; weekDone: string;
  };
  shop: {
    title: string; intro: string; packs: [string, string, string, string]; odds: string; oddsLine: (p: Record<PackRarity, string>) => string; looksShare: (p: string) => string; dupRule: (pct: number, back: string) => string;
    buy: (price: string) => string; pay: (price: string) => string; notNow: string; confirm: string; opening: string; tap: (n: number) => string; tapAria: (n: number) => string;
    isNew: string; duplicate: string; dupBack: (a: string) => string; added: string; done: string; seeAlbum: string; limit: (n: number, cap: number) => string; limitHit: string; notEnough: string;
    needAccount: string; makeProfile: string; sink: string; pending: string; hintHalo: string; balance: string; deal: string; promoTag: string; luckyTag: string; luckyHint: string; until: (t: string) => string;
    errors: Record<string, string>;
    supply: { title: string; hint: string; names: Record<"boost1" | "boost5" | "freeze1" | "kit", [string, string]>; have: (b: number, f: number) => string; full: string; bought: string; save: (pct: number) => string; limit: { name: string; tag: string; desc: string; buy: string; on: string; active: string; cooling: string; ready: string } };
  };
  album: {
    title: string; progress: (a: number, b: number) => string; cards: string; looks: string; all: string; back: string; missing: string; number: (n: number) => string;
    copies: (n: number) => string; avatar: string; decoration: string; wearHint: string; stats: (spent: string, back: string) => string; loadError: string; retry: string; of: (a: number, b: number) => string;
    cats: Record<CardCat, string>; rar: Record<PackRarity, string>; empty: string;
  };
}

const IT: HubText = {
  tabs: { today: "Oggi", shop: "Negozio", album: "Album" },
  daily: {
    title: "Bonus giornaliero", sub: "Ogni giorno della tua serie vale di più. Dopo il giorno 7 il calendario riparte.", day: (n) => `Giorno ${n}`, claim: (a) => `Ritira ${a}`, claimed: "Ritirato oggi. A domani.",
    resets: (t) => `Nuovo giorno tra ${t}`, locked: (a) => `Fai una previsione oggi per sbloccare ${a}`, play: "Fai una previsione", lapsed: "La serie è ripartita da capo: giorno 1, senza rancore.",
    freezeNote: (n) => `Congelamenti: ${n}. Ne copre un giorno saltato, e ne ricevi uno ogni 7 giorni (massimo 2).`, usesFreeze: "Un congelamento coprirà il giorno saltato.", freezeTile: "+1 congelamento",
    milestones: (l) => `In più, i premi della serie: ${l}.`, milestone: (d, b) => `${d} giorni ${b}`,
    refill: "Sotto i 100 crediti? Un rabbocco a 250 arriva da solo, una volta al giorno.", got: (a) => `Bonus giornaliero: ${a}`, today: "Oggi", weekDone: "Settimana completa",
  },
  shop: {
    title: "Negozio di bustine", intro: "Spendi crediti in bustine di figurine: 100 carte numerate da ogni angolo dell’app e, più raramente, un look per il tuo personaggio. I crediti sono finti, le carte servono solo a divertirsi.",
    packs: ["Curiosa", "Audace", "Fuoriclasse", "Mitica"], odds: "Probabilità", oddsLine: (p) => `Comune ${p.common} · Rara ${p.rare} · Epica ${p.epic} · Leggendaria ${p.legendary}`, looksShare: (p) => `Un look ogni tanto: circa ${p} delle bustine`,
    dupRule: (pct, back) => `Una doppia ti restituisce circa il ${pct}% del prezzo (${back}).`, buy: (p) => `Apri · ${p}`, pay: (p) => `Paga ${p} e apri`, notNow: "Non ora", confirm: "Una bustina contiene una sola figurina o un look.",
    opening: "Tocca la bustina per aprirla", tap: (n) => (n === 1 ? "Ancora 1 tocco" : `Ancora ${n} tocchi`), tapAria: (n) => `Tocca la bustina: mancano ${n} tocchi`,
    isNew: "Nuova!", duplicate: "Doppia", dupBack: (a) => `La avevi già: ${a} ti tornano indietro`, added: "Aggiunta all’album", done: "Fatto", seeAlbum: "Vai all’album",
    limit: (n, cap) => `Bustine aperte oggi: ${n} su ${cap}`, limitHit: "Per oggi basta bustine: ne puoi aprire altre domani.", notEnough: "Crediti insufficienti",
    needAccount: "Crea un profilo per aprire le bustine e tenere la tua collezione.", makeProfile: "Crea un profilo", sink: "I crediti spesi qui escono dal gioco: non portano vantaggi nelle previsioni.",
    deal: "Offerta del giorno", promoTag: "Promo lancio", luckyTag: "Ora fortunata ✨", luckyHint: "Più probabilità di rarità alte", until: (t) => `fino alle ${t}`, pending: "Hai una bustina da aprire", hintHalo: "L’alone anticipa la rarità", balance: "Saldo",
    errors: { play_first: "Fai prima una previsione oggi.", insufficient_credits: "Crediti insufficienti.", pack_limit: "Per oggi basta bustine: ne puoi aprire altre domani.", too_fast: "Un attimo: aspetta due secondi tra una bustina e l’altra.", registration_required: "Serve un profilo salvato per aprire le bustine.", not_authenticated: "Sto ancora preparando tutto. Riprova tra un secondo.", unknown_pack: "Questa bustina non esiste.", generic: "Qualcosa non ha funzionato. Riprova.", stock_full: "Scorta piena: usa prima qualche boost o ghiaccio.", cooldown: "Il Rompilimiti si sta ricaricando." },
    supply: { title: "Scorte", hint: "Boost e ghiaccio per le tue serie di giorni e le tue puntate migliori.", names: { boost1: ["Boost", "Raddoppia la vincita netta di una puntata (fino a +1.000)."], boost5: ["5 Boost", "Cinque boost insieme, a prezzo di scorta."], freeze1: ["Ghiaccio", "Salva la tua serie se salti un giorno."], kit: ["Kit del pendolare", "3 boost e 2 ghiacci: parti attrezzato."] }, have: (b, f) => `Hai ${b} boost e ${f} ghiacci`, full: "Scorta piena", bought: "Aggiunto alle tue scorte", save: (p) => `-${p}%`, limit: { name: "Rompilimiti", tag: "Leggendario", desc: "Per 24 ore togli i limiti bassi alle puntate singole: treni, bus e tutto il resto arrivano fino a 50.000 di vincita. Uno ogni 15 giorni.", buy: "Sblocca per 24 ore", on: "Rompilimiti attivo: limiti alzati", active: "Attivo, finisce tra", cooling: "Si ricarica: di nuovo disponibile tra", ready: "Pronto" } },
  },
  album: {
    title: "Album", progress: (a, b) => `${a} di ${b} trovate`, cards: "Figurine", looks: "Look", all: "Tutte le categorie", back: "Indietro", missing: "Non ancora trovata", number: (n) => `n. ${n} di 100`,
    copies: (n) => `${n} copie`, avatar: "Personaggio", decoration: "Decorazione", wearHint: "I look si indossano da Profilo → Decorazioni.", stats: (s, b) => `Crediti spesi in bustine: ${s}. Restituiti per le doppie: ${b}.`,
    loadError: "Non riesco a caricare l’album.", retry: "Riprova", of: (a, b) => `${a}/${b}`, empty: "Ancora nessuna figurina. La prima bustina è nel Negozio.",
    cats: { transport: "Trasporti", weather: "Meteo", nature: "Natura", sport: "Sport", games: "Giochi", finance: "Finanza", culture: "Cultura", law: "Legge" },
    rar: { common: "Comune", rare: "Rara", epic: "Epica", legendary: "Leggendaria" },
  },
};

const EN: HubText = {
  tabs: { today: "Today", shop: "Shop", album: "Album" },
  daily: {
    title: "Daily bonus", sub: "Every day of your streak pays more. After day 7 the calendar starts again.", day: (n) => `Day ${n}`, claim: (a) => `Claim ${a}`, claimed: "Claimed today. See you tomorrow.",
    resets: (t) => `New day in ${t}`, locked: (a) => `Make one prediction today to unlock ${a}`, play: "Make a prediction", lapsed: "The streak started over: day 1 again, no hard feelings.",
    freezeNote: (n) => `Freezes: ${n}. One covers a missed day, and you earn one every 7 days (max 2).`, usesFreeze: "A freeze will cover your missed day.", freezeTile: "+1 freeze",
    milestones: (l) => `On top of that, streak rewards: ${l}.`, milestone: (d, b) => `${d} days ${b}`,
    refill: "Under 100 credits? A top-up to 250 arrives by itself, once a day.", got: (a) => `Daily bonus: ${a}`, today: "Today", weekDone: "Week complete",
  },
  shop: {
    title: "Pack shop", intro: "Spend credits on packs of collectibles: 100 numbered figurine cards from every corner of the app and, more rarely, a look for your character. Credits are pretend and the cards are just for fun.",
    packs: ["Curious", "Bold", "Ace", "Mythic"], odds: "Odds", oddsLine: (p) => `Common ${p.common} · Rare ${p.rare} · Epic ${p.epic} · Legendary ${p.legendary}`, looksShare: (p) => `Now and then a look: about ${p} of the packs`,
    dupRule: (pct, back) => `A duplicate gives back about ${pct}% of the price (${back}).`, buy: (p) => `Open · ${p}`, pay: (p) => `Pay ${p} and open`, notNow: "Not now", confirm: "A pack holds one single card or one look.",
    opening: "Tap the pack to open it", tap: (n) => (n === 1 ? "1 more tap" : `${n} more taps`), tapAria: (n) => `Tap the pack: ${n} taps left`,
    isNew: "New!", duplicate: "Duplicate", dupBack: (a) => `You already had it: ${a} back`, added: "Added to your album", done: "Done", seeAlbum: "See the album",
    limit: (n, cap) => `Packs opened today: ${n} of ${cap}`, limitHit: "That’s enough packs for today: more tomorrow.", notEnough: "Not enough credits",
    needAccount: "Create a profile to open packs and keep your collection.", makeProfile: "Create a profile", sink: "Credits spent here leave the game: they give no edge on predictions.",
    deal: "Deal of the day", promoTag: "Launch promo", luckyTag: "Lucky hour ✨", luckyHint: "Better odds of rare finds", until: (t) => `until ${t}`, pending: "You have a pack to open", hintHalo: "The glow hints at the rarity", balance: "Balance",
    errors: { play_first: "Make a prediction first today.", insufficient_credits: "Not enough credits.", pack_limit: "That’s enough packs for today: more tomorrow.", too_fast: "One moment: wait two seconds between packs.", registration_required: "You need a saved profile to open packs.", not_authenticated: "Still getting set up. Try again in a second.", unknown_pack: "That pack doesn’t exist.", generic: "Something broke. Give it another shot.", stock_full: "Stock full: use some boosts or freezes first.", cooldown: "The Limit Breaker is still recharging." },
    supply: { title: "Supplies", hint: "Boosts and freezes for your streaks and your best bets.", names: { boost1: ["Boost", "Doubles the net win of one bet (up to +1,000)."], boost5: ["5 Boosts", "Five boosts together, at a bulk price."], freeze1: ["Freeze", "Saves your streak if you miss a day."], kit: ["Commuter kit", "3 boosts and 2 freezes: start fully equipped."] }, have: (b, f) => `You have ${b} boosts and ${f} freezes`, full: "Stock full", bought: "Added to your supplies", save: (p) => `-${p}%`, limit: { name: "Limit Breaker", tag: "Legendary", desc: "For 24 hours the low limits on single bets are lifted: trains, buses and everything else go up to 50,000 of winnings. One every 15 days.", buy: "Unlock for 24 hours", on: "Limit Breaker on: limits raised", active: "Active, ends in", cooling: "Recharging: available again in", ready: "Ready" } },
  },
  album: {
    title: "Album", progress: (a, b) => `${a} of ${b} found`, cards: "Cards", looks: "Looks", all: "All categories", back: "Back", missing: "Not found yet", number: (n) => `No. ${n} of 100`,
    copies: (n) => `${n} copies`, avatar: "Character", decoration: "Decoration", wearHint: "Wear looks from Profile → Decorations.", stats: (s, b) => `Credits spent on packs: ${s}. Given back for duplicates: ${b}.`,
    loadError: "Couldn’t load the album.", retry: "Try again", of: (a, b) => `${a}/${b}`, empty: "No cards yet. Your first pack is in the Shop.",
    cats: { transport: "Transport", weather: "Weather", nature: "Nature", sport: "Sport", games: "Games", finance: "Finance", culture: "Culture", law: "Law" },
    rar: { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" },
  },
};

const JA: HubText = {
  tabs: { today: "今日", shop: "ショップ", album: "アルバム" },
  daily: {
    title: "デイリーボーナス", sub: "連続日数が増えるほど、もらえる額もアップ。7日目のあとはまた1日目から。", day: (n) => `${n}日目`, claim: (a) => `${a}を受け取る`, claimed: "今日の分は受け取り済み。また明日。",
    resets: (t) => `次の日まであと${t}`, locked: (a) => `今日1回予想すると${a}が受け取れます`, play: "予想する", lapsed: "連続記録はリセットされ、1日目からやり直しです。気軽にどうぞ。",
    freezeNote: (n) => `フリーズ：${n}個。1日休んでも記録を守り、7日ごとに1個もらえます（最大2個）。`, usesFreeze: "お休みした日はフリーズがカバーします。", freezeTile: "フリーズ+1",
    milestones: (l) => `さらに連続ボーナス：${l}。`, milestone: (d, b) => `${d}日 ${b}`,
    refill: "100クレジット未満なら、1日1回250まで自動で補充されます。", got: (a) => `デイリーボーナス：${a}`, today: "今日", weekDone: "1週間達成",
  },
  shop: {
    title: "パックショップ", intro: "クレジットでコレクションパックを購入。アプリのあらゆる分野から集めた番号付きカード100枚と、ごくまれにキャラクター用のルックが出ます。クレジットはニセモノ、カードはお楽しみです。",
    packs: ["きになる", "だいたん", "エース", "ミティック"], odds: "出現率", oddsLine: (p) => `コモン ${p.common} · レア ${p.rare} · エピック ${p.epic} · レジェンド ${p.legendary}`, looksShare: (p) => `ときどきルックも：パック全体の約${p}`,
    dupRule: (pct, back) => `ダブりは価格の約${pct}%が戻ります（${back}）。`, buy: (p) => `開ける · ${p}`, pay: (p) => `${p}を払って開ける`, notNow: "やめておく", confirm: "1パックにはカード1枚、またはルック1つが入っています。",
    opening: "パックをタップして開けよう", tap: (n) => `あと${n}回タップ`, tapAria: (n) => `パックをタップ：あと${n}回`,
    isNew: "NEW！", duplicate: "ダブり", dupBack: (a) => `すでに持っていたので${a}が戻ります`, added: "アルバムに追加しました", done: "OK", seeAlbum: "アルバムを見る",
    limit: (n, cap) => `今日開けたパック：${n} / ${cap}`, limitHit: "今日はここまで。続きは明日どうぞ。", notEnough: "クレジットが足りません",
    needAccount: "パックを開けてコレクションを残すには、プロフィールを作成してください。", makeProfile: "プロフィールを作成", sink: "ここで使ったクレジットはゲームから消えます。予想が有利になることはありません。",
    deal: "今日のお得", promoTag: "ローンチ特価", luckyTag: "ラッキータイム ✨", luckyHint: "レアが出やすい", until: (t) => `${t}まで`, pending: "開けていないパックがあります", hintHalo: "光の色でレア度がわかります", balance: "残高",
    errors: { play_first: "まず今日1回予想してください。", insufficient_credits: "クレジットが足りません。", pack_limit: "今日はここまで。続きは明日どうぞ。", too_fast: "少しお待ちを。パックの間は2秒あけてください。", registration_required: "パックを開けるには保存済みのプロフィールが必要です。", not_authenticated: "準備中です。少ししてからもう一度どうぞ。", unknown_pack: "そのパックはありません。", generic: "うまくいきませんでした。もう一度お試しください。", stock_full: "上限です。先にブーストかフリーズを使ってください。", cooldown: "リミットブレイカーは充電中です。" },
    supply: { title: "ストック", hint: "連続記録と勝負どころのためのブーストとフリーズ。", names: { boost1: ["ブースト", "1回の予想の純利益を2倍に（最大+1,000）。"], boost5: ["ブースト5個", "まとめ買いのお得な5個セット。"], freeze1: ["フリーズ", "1日休んでも連続記録を守ります。"], kit: ["通勤キット", "ブースト3個とフリーズ2個のセット。"] }, have: (b, f) => `ブースト${b}個・フリーズ${f}個を所有`, full: "上限に達しています", bought: "ストックに追加しました", save: (p) => `-${p}%`, limit: { name: "リミットブレイカー", tag: "レジェンド", desc: "24時間、単発の予想にかかる低い上限を解除。電車もバスもその他も最大50,000の勝ち分まで。15日に1回。", buy: "24時間アンロック", on: "リミットブレイカー発動中：上限アップ", active: "発動中。終了まで", cooling: "充電中。再び使えるまで", ready: "準備完了" } },
  },
  album: {
    title: "アルバム", progress: (a, b) => `${b}個中${a}個ゲット`, cards: "カード", looks: "ルック", all: "すべてのカテゴリ", back: "戻る", missing: "まだ見つかっていません", number: (n) => `No.${n} / 100`,
    copies: (n) => `${n}枚`, avatar: "キャラクター", decoration: "デコレーション", wearHint: "ルックは「プロフィール → デコレーション」で着けられます。", stats: (s, b) => `パックに使ったクレジット：${s}。ダブりで戻った分：${b}。`,
    loadError: "アルバムを読み込めませんでした。", retry: "再試行", of: (a, b) => `${a}/${b}`, empty: "まだカードがありません。最初のパックはショップにあります。",
    cats: { transport: "交通", weather: "天気", nature: "自然", sport: "スポーツ", games: "ゲーム", finance: "マネー", culture: "カルチャー", law: "法律" },
    rar: { common: "コモン", rare: "レア", epic: "エピック", legendary: "レジェンド" },
  },
};

const TEXT: Record<Locale, HubText> = { it: IT, "en-US": EN, "en-GB": EN, ja: JA };
export const hubText = (l: Locale): HubText => TEXT[l];
/** "3 days +50, 7 days +150, ..." from the streak milestones the server pays. */
export const milestoneList = (t: HubText, fmt: (n: number) => string): string =>
  Object.entries(STREAK_MILESTONES).map(([d, b]) => t.daily.milestone(Number(d), `+${fmt(b)}`)).join(", ");
