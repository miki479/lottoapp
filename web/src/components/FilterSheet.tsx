import { Bitcoin, CloudFog, Crown, CloudLightning, Gauge, Mountain, Newspaper, Orbit, Rocket, Droplet, Flower2, Fuel, Gem, CloudHail, CloudRain, Globe, Snowflake, Sun, Thermometer, Wind, X } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";
import { Flag } from "./Flag.tsx";
import { Sheet } from "./Sheet.tsx";

export interface FilterOption { key: string; count: number }

export const ICON: Record<string, typeof Wind> = { rain: CloudRain, temp: Thermometer, wind: Wind, snow: Snowflake, uv: Sun, aqi: CloudFog, pollen: Flower2, hail: CloudHail, world: Globe, crypto: Bitcoin, metals: Gem, oil: Droplet, fuel: Fuel, f1: Gauge, chess: Crown, hn: Newspaper, launch: Rocket, neo: Orbit, volcanoes: Mountain, storms: CloudLightning, ice: Snowflake };
const FLAG: Record<string, string> = { jp: "JP", it: "IT", ca: "US", tr: "TR" };

export function filterLabel(msg: Messages, key: string): string {
  return key === "all" ? msg.wx.all : key === "rain" ? msg.wx.rain : key === "world" ? msg.wx.world : msg.wx.regions[key] ?? msg.wx.names[key as "temp"] ?? key;
}

/** Sub-categories of Weather (rain, temperature, wind…) and Nature (world, Japan, Italy…) live in one tidy sheet instead of a row of pills. */
export function FilterSheet({ msg, options, value, onPick, onClose }: { msg: Messages; options: FilterOption[]; value: string; onPick: (k: string) => void; onClose: () => void }) {
  const all = options.reduce((n, o) => n + o.count, 0);
  const rows: FilterOption[] = [{ key: "all", count: all }, ...options];
  return (
    <Sheet onClose={onClose} label={msg.wx.filter}>
      <div class="shead"><h2>{msg.wx.filter}</h2><button class="iconbtn" onClick={onClose} aria-label={msg.common.close}><X size={22} /></button></div>
      <div class="filtergrid">
        {rows.map((o) => {
          const Icon = ICON[o.key];
          return (
            <button key={o.key} class={`filteropt ${value === o.key ? "on" : ""}`} aria-pressed={value === o.key} onClick={() => { onPick(o.key); onClose(); }}>
              <span class="fi">{FLAG[o.key] ? <Flag cc={FLAG[o.key]!} size={22} /> : Icon ? <Icon size={26} /> : <Globe size={26} />}</span>
              <b>{filterLabel(msg, o.key)}</b><em>{o.count}</em>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
