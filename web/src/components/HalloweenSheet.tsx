import { Sheet } from "./Sheet.tsx";
import { HalloweenLogo } from "./HalloweenLogo.tsx";
import { HalloweenChallenges } from "./HalloweenChallenges.tsx";
import type { Messages } from "../i18n/index.ts";

/** The event page: its five missions with progress; the badge is awarded by the server the moment the third win is confirmed. */
export function HalloweenSheet({ msg, onClose }: { msg: Messages; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={msg.halloween.title}>
      <div class="hwhead"><HalloweenLogo size={44} /><h2>{msg.halloween.title}</h2></div>
      <HalloweenChallenges msg={msg} />
    </Sheet>
  );
}
