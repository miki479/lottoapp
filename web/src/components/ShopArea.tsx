import { useCallback, useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { loadAlbum, type AlbumData, type PackOpen } from "../lib/shop.ts";
import { Album } from "./Album.tsx";
import { PackShop } from "./PackShop.tsx";

/** The Shop and Album tabs of the Rewards sheet share one album state, reloaded after every pack. */
export function ShopArea({ tab, locale, msg, credits, registered, onTab, onChanged, onAuth }: {
  tab: "shop" | "album"; locale: Locale; msg: Messages; credits: number; registered: boolean; onTab: (t: "shop" | "album") => void; onChanged: () => void; onAuth: () => void;
}) {
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const reload = useCallback(() => loadAlbum().then((a) => setAlbum(a)), []);
  useEffect(() => { reload(); }, [reload]);
  const bought = (_: PackOpen) => { reload(); onChanged(); };
  return tab === "shop"
    ? <PackShop locale={locale} msg={msg} album={album} credits={credits} registered={registered} onBought={bought} onAlbum={() => onTab("album")} onAuth={onAuth} />
    : <Album locale={locale} msg={msg} data={album} onRetry={reload} />;
}
