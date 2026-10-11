// Cloudflare Pages Function: country of the visitor, from the edge network. The IP is not stored.
export const onRequestGet = (ctx: { request: Request & { cf?: { country?: string } } }) => {
  const c = ctx.request.cf?.country ?? null;
  return Response.json({ country: c && /^[A-Z]{2}$/.test(c) ? c : null }, { headers: { "cache-control": "private, max-age=3600" } });
};
