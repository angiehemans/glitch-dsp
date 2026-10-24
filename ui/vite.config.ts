import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const scamp = fileURLToPath(new URL("./glitch", import.meta.url));

export default defineConfig({
  plugins: [preact()],
  base: "./",
  // Scamp's images (/assets/*.webp) are referenced from the URL root, so serve its public/ as ours.
  publicDir: "glitch/public",
  resolve: {
    alias: {
      "@scamp": scamp,
      // Scamp's own files import each other as "@/components/...".
      "@": scamp,
    },
    // ui/glitch may have its own node_modules (Scamp installs one); never load two Preacts.
    dedupe: ["preact", "@preact/signals"],
  },
  server: {
    host: true, // reachable from the Mac for the dev-remote preset
    port: 5290,
    strictPort: true,
  },
  build: {
    target: "safari15",
  },
});
