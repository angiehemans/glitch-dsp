import type { GlitchState } from "@glitch/protocol";
import ProjectCard from "@scamp/components/ProjectCard/ProjectCard";
import Home from "@scamp/views/Home/Home";
import { send } from "../../store/glitch";
import { renameByKey, renameWhenCreated } from "../rename";
import { navigate } from "../router";
import { clock } from "./SongsView";

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
      showSamples={false}
      subtitle={count === 0 ? "No projects yet. Create one to start a rig." : `${count} project${count === 1 ? "" : "s"} · most recently opened first`}
      onNewProject={() => {
        // Name it in place on its card; Enter names it and opens its rig.
        renameWhenCreated("project", (id, how) => how === "enter" && navigate(`/rig?project=${encodeURIComponent(id)}`));
        send({ type: "project.create" });
      }}
      setlistsSub={
        state.librarySetlists.length
          ? "Not tied to a project · add one to any project from its Setlists tab"
          : "None yet. A setlist made here can be added to any project."
      }
      setlists={state.librarySetlists.map((l) => {
        const songs = l.songs.map((id) => state.songs.find((s) => s.id === id)).filter((s) => s !== undefined);
        const total = songs.reduce((sum, s) => sum + s.length, 0);
        return {
          id: l.id,
          name: l.name,
          meta: `${songs.length} song${songs.length === 1 ? "" : "s"} · ${clock(total)}`,
          href: `/setlist?id=${encodeURIComponent(l.id)}`,
          renameKey: `setlist:${l.id}`,
        };
      })}
      onNewSetlist={() => {
        // Name it in place on its card, then open it to add songs.
        renameWhenCreated("setlist", (id, how) => how === "enter" && navigate(`/setlist?id=${encodeURIComponent(id)}`));
        send({ type: "setlist.create", library: true });
      }}
      projects={state.projects.map((p) => (
        <ProjectCard
          key={p.id}
          className="gl-project-card"
          color={p.color as ProjectColor}
          state={p.id === state.project?.id ? "current" : "default"}
          name={p.name}
          renameKey={`project:${p.id}`}
          href={`/rig?project=${encodeURIComponent(p.id)}`}
          lastOpened={openedAgo(p.openedAt)}
          chainCount={String(p.chainCount)}
          presetCount="0"
          setlistCount="0"
          mainOutput="Main · Out 1/2"
          onRename={() => renameByKey(`project:${p.id}`)}
        />
      ))}
    />
  );
}
