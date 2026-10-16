import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { loadAlbum, type AlbumData } from "../lib/shop.ts";
import { hubText } from "../lib/shopText.ts";
import { Album } from "./Album.tsx";
import { Collapse } from "./Collapse.tsx";

/** The figurine album lives in the profile, folded away until the player wants to look at it. */
export function ProfileAlbum({ locale, msg }: { locale: Locale; msg: Messages }) {
  const [album, setAlbum] = useState<AlbumData | null | undefined>(undefined);
  const reload = () => loadAlbum().then((a) => setAlbum(a), () => setAlbum(null));
  useEffect(() => { reload(); }, []);
  return (
    <Collapse id="profalbum" title={hubText(locale).tabs.album} open={false}>
      <Album locale={locale} msg={msg} data={album} onRetry={() => { setAlbum(undefined); reload(); }} />
    </Collapse>
  );
}
