import { render } from "preact";
import { LawGhost, LawScene } from "../src/components/Cannabis";
import "../src/app.css";
const m = { params: { label: "Legalità" } } as never, msg = { tabs: { law: "Legalità" } } as never;
render(<div style="width:400px;background:#e9ecf5"><div style="width:150px"><LawGhost /></div><LawScene m={m} hint={null} msg={msg} /></div>, document.getElementById("app")!);
