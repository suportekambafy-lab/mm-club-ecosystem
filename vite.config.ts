// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      // Pre-bundle the router with React so both resolve to the SAME React copy.
      // Without this the router loads raw from node_modules while React comes from
      // .vite/deps, giving two React instances and a null hook dispatcher
      // ("resolveDispatcher().use") inside <Await>.
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "@tanstack/react-router"],
    },
    resolve: {

      alias: [
        {
          // pdf-lib depends on tslib@1 (CJS-only), which breaks ESM interop in the
          // worker bundle ("Cannot destructure property '__extends'").
          // Force the modern ESM-capable tslib@2 that is hoisted at the root.
          find: /^tslib$/,
          replacement: path.resolve(rootDir, "node_modules/tslib/tslib.es6.mjs"),
        },
        // Pin `entities` to the hoisted v4 copy (react-email renderer needs
        // ./lib/decode.js, removed in v7).
        {
          find: "entities/lib/decode.js",
          replacement: path.resolve(rootDir, "node_modules/entities/lib/decode.js"),
        },
        {
          find: "entities/lib/encode.js",
          replacement: path.resolve(rootDir, "node_modules/entities/lib/encode.js"),
        },
        {
          find: /^entities$/,
          replacement: path.resolve(rootDir, "node_modules/entities"),
        },

      ],
    },
  },
});
