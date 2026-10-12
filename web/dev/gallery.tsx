import { render } from "preact";
import { AVATARS, DECORATIONS } from "../../shared/looks";
import { Look } from "../src/components/looks/Look";
import "../src/app.css";
render(<div>
  <div style="display:flex;flex-wrap:wrap;gap:24px">{DECORATIONS.map((d, i) => <div key={d.id} style="text-align:center"><Look avatar={AVATARS[i % 10]!} decoration={d.id} size={150} /><br />{d.id}</div>)}</div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:20px">{AVATARS.map((a) => <div key={a} style="text-align:center"><Look avatar={a} decoration="gold" size={72} /><br />{a}</div>)}</div>
  <div style="display:flex;gap:10px;margin-top:20px">{DECORATIONS.map((d) => <Look key={d.id} avatar="fox" decoration={d.id} size={36} />)}</div>
</div>, document.getElementById("app")!);
