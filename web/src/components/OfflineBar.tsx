import { Wifi, WifiOff } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";

/** Sticky strip under the top bar while the connection is down, and a short "back online" note when it returns. */
export function OfflineBar({ offline, msg, onRetry }: { offline: boolean; msg: Messages; onRetry: () => void }) {
  const was = useRef(false);
  const [back, setBack] = useState(false);
  useEffect(() => {
    if (offline) { was.current = true; setBack(false); return; }
    if (was.current) { was.current = false; setBack(true); const t = setTimeout(() => setBack(false), 2500); return () => clearTimeout(t); }
  }, [offline]);
  if (!offline && !back) return null;
  return (
    <div class={`offlinebar ${offline ? "down" : "up"}`} role="status" aria-live="polite">
      {offline ? <WifiOff size={18} /> : <Wifi size={18} />}
      <span>{offline ? msg.common.offline : msg.common.backOnline}</span>
      {offline && <button class="link" onClick={onRetry}>{msg.common.retry}</button>}
    </div>
  );
}
