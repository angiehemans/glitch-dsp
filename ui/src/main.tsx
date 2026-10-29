import { render } from "preact";
import { installInteractions } from "scampjs/runtime";
import { closeMenusOnOutsidePress } from "./app/menus";
import "@scamp/design/theme.css";
import "./app/app.css";
import { App } from "./app/App";
import { startMeters } from "./app/meters";
import { startRename } from "./app/rename";
import { startRouter } from "./app/router";
import { startStore } from "./store/glitch";

installInteractions(document); // Scamp's data-scamp-click / -outside / -escape (menus, modals)
closeMenusOnOutsidePress(document); // and -outside for presses inside the component, outside its menu
startRouter();
startMeters();
startRename();
startStore();
render(<App />, document.getElementById("app")!);
