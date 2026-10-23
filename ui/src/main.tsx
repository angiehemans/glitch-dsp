import { render } from "preact";
import "@scamp/design/theme.css";
import "./app/app.css";
import { App } from "./app/App";
import { startStore } from "./store/glitch";

startStore();
render(<App />, document.getElementById("app")!);
