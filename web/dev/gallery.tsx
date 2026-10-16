import { render } from "preact";
import { AVATARS, DECORATIONS } from "../../shared/looks";
import { Look } from "../src/components/looks/Look";
import { frameOf } from "../src/components/looks/frames";
import { rayR } from "../src/components/looks/geo";
import "../src/app.css";
const minR = (id: string) => { const P = frameOf(id, true); let m = 1e9; for (let a = 0; a < 360; a += 1) m = Math.min(m, rayR(P, a)); return m.toFixed(1); };
render(<div>
  <div style="display:flex;flex-wrap:wrap;gap:20px">{DECORATIONS.map((d, i) => <div key={d.id} style="text-align:center"><Look avatar={AVATARS[i % 10]!} decoration={d.id} size={170} /><br />{d.id} · min {minR(d.id)}</div>)}</div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:20px">{AVATARS.map((a) => <div key={a} style="text-align:center"><Look avatar={a} decoration="gold" size={72} /><br />{a}</div>)}</div>
  <div style="display:flex;gap:10px;margin-top:20px">{DECORATIONS.map((d) => <Look key={d.id} avatar="fox" decoration={d.id} size={44} />)}</div>
</div>, document.getElementById("app")!);
