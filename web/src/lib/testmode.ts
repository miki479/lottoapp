/** Private test markets (sources without a licence yet) are shown only after the owner opens the app once with ?test=1. */
export function testMode(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("test");
    if (q === "1") localStorage.setItem("ll_test", "1");
    if (q === "0") localStorage.removeItem("ll_test");
    return localStorage.getItem("ll_test") === "1";
  } catch { return false; }
}
