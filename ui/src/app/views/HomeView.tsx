import type { GlitchState } from "@glitch/protocol";
import Home from "@scamp/views/Home/Home";
import { send } from "../../store/glitch";
import { navigate } from "../router";

type ProjectColor = "orange" | "cyan" | "pink" | "lime" | "violet";

function openedAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "Opened just now";
  if (minutes < 60) return `Opened ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Opened ${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Opened yesterday" : `Opened ${days} days ago`;
}

export function HomeView({ state }: { state: GlitchState }) {
  const count = state.projects.length;

  return (
    <Home
      showTopBar={false}
      subtitle={count === 0 ? "No projects yet. Create one to start a rig." : `${count} project${count === 1 ? "" : "s"} · most recently opened first`}
      projects={state.projects.map((p) => ({
        id: p.id,
        color: p.color as ProjectColor,
        state: p.id === state.project?.id ? "current" : "default",
        name: p.name,
        href: `/rig?project=${encodeURIComponent(p.id)}`,
        lastOpened: openedAgo(p.openedAt),
        chainCount: String(p.chainCount),
        presetCount: "0",
        setlistCount: "0",
        mainOutput: "Main · Out 1/2",
      }))}
      onNewProject={() => {
        send({ type: "project.create" }); // the engine opens the new project
        navigate("/rig");
      }}
    />
  );
}
