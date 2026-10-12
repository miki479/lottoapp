/**
 * Test markets (sources without a licence yet, e.g. ViaggiaTreno trains) are visible while the app is pre-release.
 * Flip PRE_RELEASE to false before launch: they are then shown only to whoever opened the app once with ?test=1.
 */
const PRE_RELEASE = true;
export function testMode(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("test");
    if (q === "1") localStorage.setItem("ll_test", "1");
    if (q === "0") localStorage.setItem("ll_test", "0");
    const v = localStorage.getItem("ll_test");
    return PRE_RELEASE ? v !== "0" : v === "1";
  } catch { return PRE_RELEASE; }
}
