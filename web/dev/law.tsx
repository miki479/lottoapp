import { render } from "preact";
import { LawGhost, LawScene } from "../src/components/Cannabis";
import "../src/app.css";
const msg = { tabs: { law: "Legalità" } } as never;
render(<div style="display:flex;flex-direction:column;gap:16px;max-width:360px">
  <div style="width:360px;background:#e9ecf5;border-radius:16px;padding:10px"><LawGhost /></div>
  <div class="mscene" style="height:auto"><LawScene m={{ params: { label: "Cannabis in Italia" } } as never} hint={null} msg={msg} /></div>
</div>, document.getElementById("app")!);
