// Seeds the big towns of Japan, the US and Europe as permanent places (same mechanism as the Italian capitals, see seed-capitals.mjs): the places job then makes
// their weather questions, so players there find fresh local questions near them. Towns that already have a city file (cities/*.json) are left out.
//   node scripts/seed-world.mjs            (checks every town against the Open-Meteo geocoder and prints the result)
//   node scripts/seed-world.mjs --apply    (writes the places; needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
import { supabaseUrl } from "./lib-env.mjs";

// [name shown, geocoder query, country, admin, lat, lon]  (positions from the research notes; the geocoder confirms the timezone and the exact point)
const T = [
  ["Yokohama 横浜", "Yokohama", "JP", "Kanagawa", 35.4437, 139.638], ["Osaka 大阪", "Osaka", "JP", "Osaka", 34.6937, 135.5023], ["Nagoya 名古屋", "Nagoya", "JP", "Aichi", 35.1815, 136.9066],
  ["Sapporo 札幌", "Sapporo", "JP", "Hokkaido", 43.0618, 141.3545], ["Fukuoka 福岡", "Fukuoka", "JP", "Fukuoka", 33.5904, 130.4017], ["Kobe 神戸", "Kobe", "JP", "Hyogo", 34.6901, 135.1956],
  ["Kyoto 京都", "Kyoto", "JP", "Kyoto", 35.0116, 135.7681], ["Sendai 仙台", "Sendai", "JP", "Miyagi", 38.2682, 140.8694], ["Hiroshima 広島", "Hiroshima", "JP", "Hiroshima", 34.3853, 132.4553],
  ["Naha 那覇", "Naha", "JP", "Okinawa", 26.2124, 127.6809], ["Saitama さいたま", "Saitama", "JP", "Saitama", 35.8617, 139.6455], ["Chiba 千葉", "Chiba", "JP", "Chiba", 35.6073, 140.1063],
  ["Kawasaki 川崎", "Kawasaki", "JP", "Kanagawa", 35.5309, 139.7029], ["Kitakyushu 北九州", "Kitakyushu", "JP", "Fukuoka", 33.8834, 130.8751],
  ["New York", "New York", "US", "New York", 40.7128, -74.006], ["Los Angeles", "Los Angeles", "US", "California", 34.0522, -118.2437], ["Chicago", "Chicago", "US", "Illinois", 41.8781, -87.6298],
  ["Houston", "Houston", "US", "Texas", 29.7604, -95.3698], ["Phoenix", "Phoenix", "US", "Arizona", 33.4484, -112.074], ["Miami", "Miami", "US", "Florida", 25.7617, -80.1918],
  ["Dallas", "Dallas", "US", "Texas", 32.7767, -96.797], ["Atlanta", "Atlanta", "US", "Georgia", 33.749, -84.388], ["Philadelphia", "Philadelphia", "US", "Pennsylvania", 39.9526, -75.1652],
  ["Washington DC", "Washington", "US", "District of Columbia", 38.9072, -77.0369], ["Las Vegas", "Las Vegas", "US", "Nevada", 36.1699, -115.1398],
  ["München", "Munich", "DE", "Bayern", 48.1351, 11.582], ["Hamburg", "Hamburg", "DE", "Hamburg", 53.5511, 9.9937], ["Köln", "Cologne", "DE", "Nordrhein-Westfalen", 50.9375, 6.9603],
  ["Frankfurt", "Frankfurt am Main", "DE", "Hessen", 50.1109, 8.6821], ["Stuttgart", "Stuttgart", "DE", "Baden-Württemberg", 48.7758, 9.1829], ["Düsseldorf", "Düsseldorf", "DE", "Nordrhein-Westfalen", 51.2277, 6.7735], ["Leipzig", "Leipzig", "DE", "Sachsen", 51.3397, 12.3731],
  ["Marseille", "Marseille", "FR", "Provence-Alpes-Côte d'Azur", 43.2965, 5.3698], ["Lyon", "Lyon", "FR", "Auvergne-Rhône-Alpes", 45.764, 4.8357], ["Toulouse", "Toulouse", "FR", "Occitanie", 43.6047, 1.4442],
  ["Nice", "Nice", "FR", "Provence-Alpes-Côte d'Azur", 43.7102, 7.262], ["Strasbourg", "Strasbourg", "FR", "Grand Est", 48.5734, 7.7521], ["Lille", "Lille", "FR", "Hauts-de-France", 50.6292, 3.0573],
  ["Barcelona", "Barcelona", "ES", "Cataluña", 41.3874, 2.1686], ["Valencia", "Valencia", "ES", "Comunidad Valenciana", 39.4699, -0.3763], ["Sevilla", "Seville", "ES", "Andalucía", 37.3891, -5.9845],
  ["Bilbao", "Bilbao", "ES", "País Vasco", 43.263, -2.935], ["Málaga", "Malaga", "ES", "Andalucía", 36.7213, -4.4214], ["Zaragoza", "Zaragoza", "ES", "Aragón", 41.6488, -0.8891], ["Palma", "Palma", "ES", "Illes Balears", 39.5696, 2.6502],
  ["London", "London", "GB", "England", 51.5074, -0.1278], ["Manchester", "Manchester", "GB", "England", 53.4808, -2.2426], ["Birmingham", "Birmingham", "GB", "England", 52.4862, -1.8904],
  ["Glasgow", "Glasgow", "GB", "Scotland", 55.8642, -4.2518], ["Liverpool", "Liverpool", "GB", "England", 53.4084, -2.9916], ["Edinburgh", "Edinburgh", "GB", "Scotland", 55.9533, -3.1883],
  ["Leeds", "Leeds", "GB", "England", 53.8008, -1.5491], ["Cardiff", "Cardiff", "GB", "Wales", 51.4816, -3.1791],
  ["Rotterdam", "Rotterdam", "NL", "Zuid-Holland", 51.9244, 4.4777], ["Den Haag", "The Hague", "NL", "Zuid-Holland", 52.0705, 4.3007], ["Utrecht", "Utrecht", "NL", "Utrecht", 52.0907, 5.1214], ["Eindhoven", "Eindhoven", "NL", "Noord-Brabant", 51.4416, 5.4697],
  ["Warszawa", "Warsaw", "PL", "Mazowieckie", 52.2297, 21.0122], ["Kraków", "Krakow", "PL", "Małopolskie", 50.0647, 19.945], ["Łódź", "Lodz", "PL", "Łódzkie", 51.7592, 19.456],
  ["Wrocław", "Wroclaw", "PL", "Dolnośląskie", 51.1079, 17.0385], ["Poznań", "Poznan", "PL", "Wielkopolskie", 52.4064, 16.9252], ["Gdańsk", "Gdansk", "PL", "Pomorskie", 54.352, 18.6466],
  ["Stockholm", "Stockholm", "SE", "Stockholm", 59.3293, 18.0686], ["Göteborg", "Gothenburg", "SE", "Västra Götaland", 57.7089, 11.9746], ["Malmö", "Malmo", "SE", "Skåne", 55.605, 13.0038],
  ["København", "Copenhagen", "DK", "Hovedstaden", 55.6761, 12.5683], ["Bergen", "Bergen", "NO", "Vestland", 60.3913, 5.3221],
];
const near = (a, b, c, d) => Math.hypot(a - c, (b - d) * 0.7) < 0.35;
const rows = [];
for (const [name, q, cc, admin, lat, lon] of T) {
  let hit = null;
  for (let k = 0; k < 4 && !hit; k++) {
    try { const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json&countryCode=${cc}`); const j = await r.json(); hit = (j.results ?? []).find((h) => near(h.latitude, h.longitude, lat, lon)) ?? null; if (!hit) break; } catch { await new Promise((res) => setTimeout(res, 1500)); }
    await new Promise((res) => setTimeout(res, 100));
  }
  if (!hit) { console.log(`no geocoder match near the expected point: ${name}`); continue; }
  rows.push({ id: `p-${(+hit.latitude).toFixed(2)}_${(+hit.longitude).toFixed(2)}`, name, admin, country: cc, lat: +(+hit.latitude).toFixed(5), lon: +(+hit.longitude).toFixed(5), timezone: hit.timezone, last_used_at: "2036-01-01T00:00:00Z" });
}
console.log(`${rows.length} of ${T.length} towns confirmed; timezones: ${[...new Set(rows.map((r) => r.timezone))].join(", ")}`);
if (!process.argv.includes("--apply")) process.exit(0);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const res = await fetch(`${supabaseUrl()}/rest/v1/places`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
console.log(res.ok ? `seeded ${rows.length} places` : `failed ${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
