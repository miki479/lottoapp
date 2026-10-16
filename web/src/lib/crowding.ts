/**
 * Peak-hour crowding of 31 main sections of Tokyo-area railways, fiscal year 2025 (weekday morning peak, hourly average).
 * Source: 国土交通省 (MLIT) 「都市鉄道の混雑率調査結果（令和７年度実績）」 資料２, PDL 1.0. Transcribed here; it is statistics, not live data.
 * Rate = riders / capacity: 100% is "everyone has a seat, strap or pole".
 */
export interface CrowdRow { ja: string; en: string; seg: string; pct: number }
export const CROWD_YEAR = "2025";
export const CROWD_SOURCE = { name: "国土交通省「都市鉄道の混雑率調査結果（令和７年度実績）」", via: "MLIT (processed)", license: "PDL 1.0 (CC BY compatible)", licenseUrl: "https://www.mlit.go.jp/link.html", url: "https://www.mlit.go.jp/report/press/tetsudo04_hh_000139.html" };
export const CROWD_AVERAGE = 143;
export const CROWD: CrowdRow[] = [
  { ja: "東武 伊勢崎線", en: "Tobu Isesaki", seg: "小菅→北千住", pct: 142 },
  { ja: "東武 東上線", en: "Tobu Tojo", seg: "北池袋→池袋", pct: 131 },
  { ja: "西武 池袋線", en: "Seibu Ikebukuro", seg: "椎名町→池袋", pct: 130 },
  { ja: "西武 新宿線", en: "Seibu Shinjuku", seg: "下落合→高田馬場", pct: 148 },
  { ja: "京成 押上線", en: "Keisei Oshiage", seg: "京成曳舟→押上", pct: 157 },
  { ja: "京成 本線", en: "Keisei Main", seg: "大神宮下→京成船橋", pct: 137 },
  { ja: "京王線", en: "Keio", seg: "下高井戸→明大前", pct: 145 },
  { ja: "京王 井の頭線", en: "Keio Inokashira", seg: "池ノ上→駒場東大前", pct: 125 },
  { ja: "小田急 小田原線", en: "Odakyu Odawara", seg: "世田谷代田→下北沢", pct: 150 },
  { ja: "東急 東横線", en: "Tokyu Toyoko", seg: "祐天寺→中目黒", pct: 124 },
  { ja: "東急 田園都市線", en: "Tokyu Den-en-toshi", seg: "池尻大橋→渋谷", pct: 138 },
  { ja: "京急 本線", en: "Keikyu Main", seg: "戸部→横浜", pct: 120 },
  { ja: "都営 浅草線", en: "Toei Asakusa", seg: "本所吾妻橋→浅草", pct: 123 },
  { ja: "都営 三田線", en: "Toei Mita", seg: "西巣鴨→巣鴨", pct: 146 },
  { ja: "都営 新宿線", en: "Toei Shinjuku", seg: "西大島→住吉", pct: 152 },
  { ja: "東京メトロ 日比谷線", en: "Tokyo Metro Hibiya", seg: "三ノ輪→入谷", pct: 163 },
  { ja: "東京メトロ 銀座線", en: "Tokyo Metro Ginza", seg: "赤坂見附→溜池山王", pct: 153 },
  { ja: "東京メトロ 丸ノ内線", en: "Tokyo Metro Marunouchi", seg: "新大塚→茗荷谷", pct: 154 },
  { ja: "東京メトロ 東西線", en: "Tokyo Metro Tozai", seg: "木場→門前仲町", pct: 160 },
  { ja: "東京メトロ 有楽町線", en: "Tokyo Metro Yurakucho", seg: "東池袋→護国寺", pct: 153 },
  { ja: "東京メトロ 千代田線", en: "Tokyo Metro Chiyoda", seg: "町屋→西日暮里", pct: 150 },
  { ja: "東京メトロ 半蔵門線", en: "Tokyo Metro Hanzomon", seg: "渋谷→表参道", pct: 111 },
  { ja: "JR 東海道線", en: "JR Tokaido", seg: "川崎→品川", pct: 159 },
  { ja: "JR 横須賀線", en: "JR Yokosuka", seg: "武蔵小杉→西大井", pct: 138 },
  { ja: "JR 中央線（快速）", en: "JR Chuo (Rapid)", seg: "中野→新宿", pct: 158 },
  { ja: "JR 中央線（各駅停車）", en: "JR Chuo-Sobu (Local)", seg: "代々木→千駄ヶ谷", pct: 93 },
  { ja: "JR 京浜東北線", en: "JR Keihin-Tohoku", seg: "川口→赤羽", pct: 158 },
  { ja: "JR 常磐線（快速）", en: "JR Joban (Rapid)", seg: "三河島→日暮里", pct: 142 },
  { ja: "JR 常磐線（各駅停車）", en: "JR Joban (Local)", seg: "亀有→綾瀬", pct: 128 },
  { ja: "JR 総武線（快速）", en: "JR Sobu (Rapid)", seg: "新小岩→錦糸町", pct: 160 },
  { ja: "JR 総武線（各駅停車）", en: "JR Sobu (Local)", seg: "錦糸町→両国", pct: 151 },
];
