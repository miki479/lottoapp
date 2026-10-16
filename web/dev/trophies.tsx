import { render } from "preact";
import { TROPHY_IDS } from "../src/i18n/index";
import { Trophy3D } from "../src/components/looks/Trophy3D";
import "../src/app.css";
render(<div>
  <div style="display:flex;flex-wrap:wrap;gap:20px">{TROPHY_IDS.map((id) => <div key={id} style="text-align:center"><Trophy3D id={id} have size={170} /><br />{id}</div>)}</div>
  <div style="display:flex;gap:16px;margin-top:20px;align-items:center">{TROPHY_IDS.map((id) => <Trophy3D key={id} id={id} have size={56} />)}<span style="width:20px" />{TROPHY_IDS.map((id) => <Trophy3D key={id + "l"} id={id} have={false} size={56} />)}</div>
</div>, document.getElementById("app")!);
