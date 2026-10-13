// Web push through OneSignal, loaded only when the player agrees (nothing is fetched from OneSignal before that).
// The worker files live in /push/onesignal/ so they do not clash with the app's own service worker.
// Sending is done by the server (supabase/functions/_lib/notify.ts); the app never holds a REST key.
const APP_ID = (import.meta.env as Record<string, string | undefined>).VITE_ONESIGNAL_APP_ID ?? "";

type OS = {
  init(o: Record<string, unknown>): Promise<void>;
  login(id: string): Promise<void>;
  logout(): Promise<void>;
  Notifications: { permission: boolean; requestPermission(): Promise<void>; addEventListener(e: string, f: () => void): void };
  User: { PushSubscription: { optIn(): Promise<void>; optOut(): Promise<void>; optedIn: boolean | undefined } };
};
declare global { interface Window { OneSignalDeferred?: ((os: OS) => void | Promise<void>)[] } }

export const pushAvailable = () => !!APP_ID && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
export const pushDenied = () => "Notification" in window && Notification.permission === "denied";

let loading: Promise<OS> | null = null;
function sdk(): Promise<OS> {
  loading ??= new Promise<OS>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"; s.defer = true; s.onerror = () => reject(new Error("push sdk"));
    document.head.appendChild(s);
    window.OneSignalDeferred.push(async (os) => {
      await os.init({ appId: APP_ID, serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js", serviceWorkerUpdaterPath: "push/onesignal/OneSignalSDKUpdaterWorker.js", serviceWorkerParam: { scope: "/push/onesignal/" } });
      resolve(os);
    });
  });
  return loading;
}

/** Ask for permission and tie this browser to the player (external id = user id). Returns true when notifications are on. */
export async function enablePush(userId: string): Promise<boolean> {
  const os = await sdk();
  await os.login(userId);
  await os.Notifications.requestPermission();
  if (!os.Notifications.permission) return false;
  await os.User.PushSubscription.optIn();
  return true;
}
export async function disablePush(): Promise<void> {
  const os = await sdk();
  await os.User.PushSubscription.optOut();
}
/** Current state without loading anything when the player never opted in. */
export async function pushEnabled(): Promise<boolean> {
  if (!pushAvailable() || Notification.permission !== "granted" || localStorage.getItem("push") !== "1") return false;
  const os = await sdk();
  return !!os.User.PushSubscription.optedIn;
}
export const rememberPush = (on: boolean) => { try { localStorage.setItem("push", on ? "1" : "0"); } catch { /* storage unavailable */ } };
export const pushAsked = () => { try { return localStorage.getItem("push") !== null; } catch { return true; } };

/** The reminder banner for people who have notifications off: due again after `days`; the very first time it only starts the clock (a person who just answered is not nagged at once). */
export function nagDue(days: number): boolean {
  try {
    const last = Number(localStorage.getItem("pushNag") ?? 0);
    if (!last) { localStorage.setItem("pushNag", String(Date.now())); return false; }
    return Date.now() - last > days * 86_400_000;
  } catch { return false; }
}
export const markNag = () => { try { localStorage.setItem("pushNag", String(Date.now())); } catch { /* storage unavailable */ } };
