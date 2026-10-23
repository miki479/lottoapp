import { memo } from "./cache.ts";
import { sb } from "./api.ts";

export interface ShopStatus { lucky_until: string | null; promo_until: string | null }
/** When the lucky hour and the launch promo end (null: not running). Read at most once a minute. */
export const shopStatus = (): Promise<ShopStatus> =>
  memo("shopStatus", 60_000, async () => { const { data } = await sb.rpc("shop_status"); return { lucky_until: data?.lucky_until ?? null, promo_until: data?.promo_until ?? null } as ShopStatus; });
