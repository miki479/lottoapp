import { useCallback, useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { loadAlbum, type AlbumData, type PackOpen } from "../lib/shop.ts";
import { Album } from "./Album.tsx";
import { PackShop } from "./PackShop.tsx";
import { Supplies } from "./Supplies.tsx";

/** The Shop and Album tabs of the Rewards sheet share one album state, reloaded after every pack. */
export function ShopArea({ tab, locale, msg, credits, registered, boosts, freezes, limitUntil, limitAt, onTab, onChanged, onAuth }: {
  tab: "shop" | "album"; locale: Locale; msg: Messages; credits: number; registered: boolean; boosts: number; freezes: number; limitUntil: string | null; limitAt: string | null; onTab: (t: "shop" | "album") => void; onChanged: () => void; onAuth: () => void;
}) {
  const [album, setAlbum] = useState<AlbumData | null | undefined>(undefined);
  const reload = useCallback(() => loadAlbum().then((a) => setAlbum(a), () => setAlbum(null)), []);
  const retry = useCallback(() => { setAlbum(undefined); reload(); }, [reload]);
  useEffect(() => { reload(); }, [reload]);
  const bought = (_: PackOpen) => { reload(); onChanged(); };
  return tab === "shop"
    ? <PackShop locale={locale} msg={msg} album={album ?? null} credits={credits} registered={registered} onBought={bought} onAlbum={() => onTab("album")} onAuth={onAuth} extra={<Supplies locale={locale} credits={credits} registered={registered} boosts={boosts} freezes={freezes} limitUntil={limitUntil} limitAt={limitAt} onChanged={onChanged} />} />
    : <Album locale={locale} msg={msg} data={album} onRetry={retry} />;
}
