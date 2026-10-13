/** The title strings, per language: five per subject in the order risk, cautious, lucky, regular, highroller. */
export type TitleLocale = "it" | "en-US" | "en-GB" | "ja";
type Five = readonly [string, string, string, string, string];
interface Pack { newbie: string; subjects: Record<"train" | "bus" | "weather" | "nature" | "traffic" | "finance" | "culture" | "games" | "music" | "sport" | "law" | "mix", Five> }

export const TITLE_TEXT: Record<TitleLocale, Pack> = {
  it: {
    newbie: "Esordiente allo sbando",
    subjects: {
      train: ["Cassandra dei binari", "Pendolare rassegnato", "Capostazione", "Abbonato a vita", "Il re del binario 3"],
      bus: ["Profeta della fermata", "Aspetta-bus di ruolo", "Autista onorario", "Fantasma del capolinea", "Magnate del biglietto"],
      weather: ["Mago delle nuvole", "Ombrello a vita", "Generale Isobara", "Meteorologo da balcone", "Signore del monsone"],
      nature: ["Sismografo umano", "Placca tettonica", "Veggente del terremoto", "Uragano part-time", "Re dell'epicentro"],
      traffic: ["Scavalcatore di code", "Fermo in tangenziale", "Navigatore ironico", "Pendolare del casello", "Sceicco dell'autostrada"],
      finance: ["Cripto-avventuriero", "Salvadanaio con le gambe", "Lupo di Piazza Affari", "Trader del bar", "Mr. Tutto Dentro"],
      culture: ["Critico incompreso", "Spettatore pigro", "Oracolo del divano", "Maratoneta di serie", "Produttore a credito"],
      games: ["Speedrunner di debiti", "Giocatore da backlog", "Fortunato del multiplayer", "Cliente dei saldi Steam", "Re dei giochi intonsi"],
      music: ["Groupie senza biglietto", "Ascoltatore in loop", "Orecchio assoluto", "Playlist in ripetizione", "Discografico da cameretta"],
      sport: ["Allenatore da divano", "Tifoso prudente", "Mister Fantacalcio", "Abbonato alla curva", "Presidente senza società"],
      law: ["Avvocato del diavolo", "Esperto di cavilli", "Giudice onorario", "Eterno in appello", "Re della parcella"],
      mix: ["Tuttologo temerario", "Tuttologo prudente", "Tuttologo fortunato", "Tuttologo", "Tuttologo col portafoglio"],
    },
  },
  "en-US": {
    newbie: "Rookie, Ready or Not",
    subjects: {
      train: ["Cassandra of the Tracks", "Resigned Commuter", "Station Master", "Lifetime Pass Holder", "King of Track 3"],
      bus: ["Prophet of the Bus Stop", "Professional Bus Waiter", "Honorary Driver", "Ghost of the Terminal", "Fare Tycoon"],
      weather: ["Cloud Wizard", "Umbrella for Life", "General Isobar", "Balcony Meteorologist", "Monsoon Lord"],
      nature: ["Human Seismograph", "Tectonic Plate", "Earthquake Seer", "Part-Time Hurricane", "King of the Epicenter"],
      traffic: ["Queue Jumper", "Stuck on the Beltway", "Ironic Navigator", "Toll Booth Commuter", "Highway Sultan"],
      finance: ["Crypto Adventurer", "Piggy Bank on Legs", "Wolf of Main Street", "Barstool Trader", "Mr. All-In"],
      culture: ["Misunderstood Critic", "Lazy Viewer", "Couch Oracle", "Series Marathoner", "Producer on Credit"],
      games: ["Speedrunner of Debt", "Backlog Dweller", "Lucky Lobby Player", "Steam Sale Regular", "Hoarder of Unplayed"],
      music: ["Groupie Without a Ticket", "Stuck on Repeat", "Golden Ears", "Playlist on Loop", "Bedroom Record Mogul"],
      sport: ["Armchair Coach", "Cautious Fan", "Fantasy League Boss", "Bleachers Regular", "Owner Without a Team"],
      law: ["Devil's Advocate", "Fine Print Expert", "Honorary Judge", "Eternal Appellant", "Retainer King"],
      mix: ["Reckless Know-It-All", "Prudent Know-It-All", "Lucky Know-It-All", "Know-It-All", "Deep-Pockets Know-It-All"],
    },
  },
  "en-GB": {
    newbie: "Newbie, Ready or Not",
    subjects: {
      train: ["Cassandra of the Sidings", "Resigned Commuter", "Stationmaster", "Season Ticket for Life", "King of Platform 3"],
      bus: ["Prophet of the Bus Stop", "Professional Queuer", "Honorary Driver", "Ghost of the Depot", "Night Bus Tycoon"],
      weather: ["Cloud Wizard", "Brolly for Life", "General Isobar", "Garden-Gate Forecaster", "Lord of the Drizzle"],
      nature: ["Human Seismograph", "Tectonic Plate", "Earthquake Seer", "Part-Time Hurricane", "King of the Epicentre"],
      traffic: ["Queue Jumper", "Stuck on the M25", "Ironic Sat-Nav", "Services Regular", "Motorway Mogul"],
      finance: ["Crypto Adventurer", "Piggy Bank on Legs", "Wolf of Slough", "Pub Trader", "Mr. All-In"],
      culture: ["Misunderstood Critic", "Lazy Viewer", "Sofa Oracle", "Box-Set Marathoner", "Producer on Tick"],
      games: ["Speedrunner of Debt", "Backlog Dweller", "Lucky Lobby Player", "Steam Sale Regular", "Hoarder of Unplayed"],
      music: ["Groupie Without a Ticket", "Stuck on Repeat", "Golden Ears", "Playlist on Loop", "Bedroom Record Mogul"],
      sport: ["Armchair Manager", "Cautious Supporter", "Fantasy League Boss", "Season Ticket Holder", "Chairman Without a Club"],
      law: ["Devil's Advocate", "Small Print Expert", "Magistrate in Waiting", "Perpetual Appellant", "King of the Brief"],
      mix: ["Reckless Know-All", "Prudent Know-All", "Lucky Know-All", "Know-All", "Know-All with Deep Pockets"],
    },
  },
  ja: {
    newbie: "うっかり新人",
    subjects: {
      train: ["線路のカッサンドラ", "諦め顔の通勤客", "名誉駅長", "定期券の主", "3番線の王様"],
      bus: ["バス停の預言者", "バス待ちのプロ", "名誉運転手", "終点の幽霊", "回数券の大富豪"],
      weather: ["雲を読む魔術師", "万年折りたたみ傘", "気圧配置の将軍", "ベランダ気象予報士", "スコールの王"],
      nature: ["歩く地震計", "動かぬプレート", "地震を当てる人", "パートタイム台風", "震源地の王様"],
      traffic: ["渋滞すり抜け師", "渋滞ハマり名人", "皮肉屋のナビ", "料金所の常連", "高速道路の大王"],
      finance: ["仮想通貨の冒険家", "足の生えた貯金箱", "兜町の狼", "立ち飲み相場師", "全額投入さん"],
      culture: ["誤解された評論家", "ながら見の達人", "ソファの預言者", "一気見マラソン走者", "ツケで映画を作る人"],
      games: ["借金タイムアタック走者", "積みゲー住人", "野良マッチの強運", "セールの常連", "未プレイ蒐集家"],
      music: ["チケットなき追っかけ", "リピート再生の住人", "絶対音感もどき", "ループ再生の主", "自室のレコード会社社長"],
      sport: ["居間の名監督", "慎重派サポーター", "ファンタジー監督", "年間シート族", "球団なきオーナー"],
      law: ["悪魔の代弁者", "細則マニア", "名誉判事", "万年控訴人", "弁護士費用の王"],
      mix: ["無謀な物知り", "慎重な物知り", "運のいい物知り", "何でも知ってる人", "財布の厚い物知り"],
    },
  },
};
