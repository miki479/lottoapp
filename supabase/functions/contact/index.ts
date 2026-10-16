// The contact form of the footer. The message is saved (nobody can read the table but the owner) and, when a mail service key is set, forwarded to the owner's mailbox.
// The address lives only in the environment (CONTACT_TO): nothing in the app, the page or the browser ever shows it.
import { createHash } from "node:crypto";
import { db, safe } from "../_lib/common.ts";
import { CORS, json, player } from "../_lib/nearby.ts";

const PER_USER_DAY = 3, PER_IP_DAY = 8;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) : "");

Deno.serve(safe(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = db(), me = await player(req, sb);
  if (!me) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { email?: unknown; message?: unknown; website?: unknown } | null;
  // a field no person sees: a script that fills every field is a bot, and it is told everything went fine
  if (clean(b?.website, 50)) return json({ ok: true });
  const message = clean(b?.message, 2000), email = clean(b?.email, 200);
  if (message.length < 10) return json({ error: "too_short" }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400);

  const ip = (req.headers.get("cf-connecting-ip") ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0] ?? "").trim();
  const ipHash = createHash("sha256").update(`lb-contact:${ip}`).digest("hex").slice(0, 32);
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ count: mine }, { count: fromIp }] = await Promise.all([
    sb.from("contact_messages").select("id", { count: "exact", head: true }).eq("user_id", me.uid).gt("at", since),
    sb.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("at", since),
  ]);
  if ((mine ?? 0) >= PER_USER_DAY || (fromIp ?? 0) >= PER_IP_DAY) return json({ error: "rate_limited" }, 429);

  const { error } = await sb.from("contact_messages").insert({ user_id: me.uid, email: email || null, message, ip_hash: ipHash });
  if (error) return json({ error: "save_failed" }, 500);

  const key = Deno.env.get("RESEND_API_KEY"), to = Deno.env.get("CONTACT_TO");
  if (key && to) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("CONTACT_FROM") ?? "LateBet <onboarding@resend.dev>", to: [to], reply_to: email || undefined, subject: "LateBet · nuovo messaggio", text: `${message}\n\n— ${email || "nessuna email"} · utente ${me.uid}` }),
      signal: AbortSignal.timeout(8000),
    }).catch((e) => console.error("mail failed", e));
  }
  return json({ ok: true });
}));
