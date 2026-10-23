export * from "./model";
export * from "./commands";
export * from "./events";

/** WebView event names. Mirrored in engine/src/bridge/Protocol.h. */
export const COMMAND_EVENT = "glitch:command";
export const ENGINE_EVENT = "glitch:event";
