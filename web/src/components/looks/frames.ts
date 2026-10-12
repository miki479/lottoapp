import { Pt, polar, rad, smooth } from "./geo";

/**
 * The outline of every decoration, centred on (0, 0). The first ones are plain circles; from gold up the ring turns into a crest
 * (shield, hexagon, crystal, leaf, octagon) so the higher the level, the more it looks like a badge. Every outline keeps at least 53 from the centre,
 * so the avatar (radius 43) always fits.
 */
export function frameOf(id: string, hi: boolean): Pt[] {
  const seg = hi ? 7 : 3, n = hi ? 120 : 60;
  switch (id) {
    case "gold": return smooth([[-52, -50, 14], [0, -55], [52, -50, 14], [53, 6, 10], [34, 44, 18], [0, 64], [-34, 44, 18], [-53, 6, 10]], seg);
    case "diamond": return smooth([[0, -62], [53.7, -31], [53.7, 31], [0, 62], [-53.7, 31], [-53.7, -31]], seg);
    case "amethyst": return smooth([[0, -65], [55, -31], [55, 31], [0, 65], [-55, 31], [-55, -31]], seg);
    case "platinum": return smooth([[-53, -40, 8], [0, -62], [53, -40, 8], [53, 8, 10], [32, 46, 16], [0, 64], [-32, 46, 16], [-53, 8, 10]], seg);
    case "mithril": {
      const w = 54, h = 64, rho = (w * w + h * h) / (2 * w), cx = w - rho, phi = Math.acos(-cx / rho);
      const right: Pt[] = Array.from({ length: n / 2 + 1 }, (_, i) => { const t = -phi + (2 * phi * i) / (n / 2); return [cx + rho * Math.cos(t), rho * Math.sin(t)] as Pt; });
      const left: Pt[] = right.slice(1, -1).map(([x, y]) => [-x, y] as Pt).reverse();
      return [...right, ...left];
    }
    case "orichalcum": return smooth([[-55, -46, 24], [0, -57], [55, -46, 24], [55, 4, 12], [40, 42, 20], [0, 62], [-40, 42, 20], [-55, 4, 12]], seg);
    case "adamantium": return Array.from({ length: 8 }, (_, i) => { const a = 22.5 + 45 * i; return [60.6 * Math.sin(rad(a)), -60.6 * Math.cos(rad(a))] as Pt; });
    case "jade": return polar((a) => { const x = Math.abs(Math.sin(rad(a))), y = Math.abs(Math.cos(rad(a))); return 54 / Math.pow(Math.pow(x, 4) + Math.pow(y, 4), 0.25); }, n);
    case "ruby": return smooth([[-30, -55], [30, -55], [53, -30], [53, 20], [36, 50], [0, 64], [-36, 50], [-53, 20], [-53, -30]], seg);
    case "sapphire": {
      // round on top, narrowing to a point below
      const upper: Pt[] = Array.from({ length: n / 2 + 1 }, (_, i) => { const a = -90 + (180 * i) / (n / 2); return [55 * Math.sin(rad(a)), -55 * Math.cos(rad(a))] as Pt; });
      const bez = (s: 1 | -1): Pt[] => Array.from({ length: 14 }, (_, i) => { const t = (i + 1) / 14, u = 1 - t; return [s * (u * u * 55 + 2 * u * t * 55), 2 * u * t * 46 + t * t * 66] as Pt; });
      return [...upper, ...bez(1), ...bez(-1).slice(0, -1).reverse()];
    }
    case "obsidian": return smooth([[-54, -48], [0, -62], [54, -48], [54, 10], [40, 46], [0, 66], [-40, 46], [-54, 10]], seg);
    case "opal": return polar((a) => 57 + 3.5 * Math.cos(rad(12 * a)), n * 2);
    case "silver": case "bronze": case "copper": default: return polar(() => 55, n);
  }
}
