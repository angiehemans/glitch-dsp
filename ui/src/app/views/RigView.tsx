import Rig from "@scamp/views/Rig/Rig";

// Static Scamp design for now: no engine data until chains land (M2). The app shell owns the top bar.
export function RigView() {
  return <Rig topbar="hidden" />;
}
