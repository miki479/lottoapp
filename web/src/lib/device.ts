/** A random label for this browser, made once: it only lets the server notice many accounts opened from the same phone, it says nothing about the person. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem("dev");
    if (!id || id.length < 8) { id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`; localStorage.setItem("dev", id); }
    return id;
  } catch { return ""; }
}
