// Tiny relay to run on a machine with a normal (non-datacenter) IP, exposed with e.g. Cloudflare Tunnel.
//   RELAY_SECRET=long-random node scripts/viaggiatreno-relay.mjs      (PORT defaults to 8787)
// The Edge Function then uses VIAGGIATRENO_BASE_URL=https://<your-tunnel> and RELAY_SECRET.
import http from "node:http";

const UPSTREAM = "https://www.viaggiatreno.it/infomobilitamobile/resteasy/viaggiatreno";
const SECRET = process.env.RELAY_SECRET;
if (!SECRET || SECRET.length < 16) { console.error("Set RELAY_SECRET (16+ chars)"); process.exit(1); }
const ALLOWED = /^\/(andamentoTreno\/[A-Z0-9]+\/\d+\/\d+|partenze\/[A-Z0-9]+\/[^/]+|arrivi\/[A-Z0-9]+\/[^/]+|autocompletaStazione\/[^/]+)$/;
const TTL_MS = 45_000;
const cache = new Map();

http.createServer(async (req, res) => {
  if (req.headers["x-relay-secret"] !== SECRET) { res.writeHead(403).end("forbidden"); return; }
  const path = (req.url ?? "").split("?")[0];
  if (req.method !== "GET" || !ALLOWED.test(path)) { res.writeHead(404).end("not found"); return; }
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) { res.writeHead(hit.status, { "content-type": hit.type }).end(hit.body); return; }
  try {
    const up = await fetch(UPSTREAM + path, { headers: { "User-Agent": "LateLotto-relay/0.1" }, signal: AbortSignal.timeout(20000) });
    const body = await up.text();
    const type = up.headers.get("content-type") ?? "application/json";
    const denied = /Access Denied/i.test(body);
    const status = denied ? 502 : up.status;
    if (status === 200) cache.set(path, { at: Date.now(), status, type, body });
    res.writeHead(status, { "content-type": type }).end(denied ? "upstream denied" : body);
  } catch (e) {
    res.writeHead(504).end(String(e.message ?? e));
  }
  if (cache.size > 500) cache.clear();
}).listen(Number(process.env.PORT ?? 8787), () => console.log("relay listening"));
