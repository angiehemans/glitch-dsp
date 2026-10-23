import { render } from "preact";
import { installInteractions } from "scampjs/runtime";
import "@scamp/design/theme.css";
import "./app/app.css";
import { App } from "./app/App";
import { startMeters } from "./app/meters";
import { startRouter } from "./app/router";
import { startStore } from "./store/glitch";

installInteractions(document); // Scamp's data-scamp-click / -outside / -escape (menus, modals)
startRouter();
startMeters();
startStore();
render(<App />, document.getElementById("app")!);
