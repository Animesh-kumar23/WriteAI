import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // Raise the warning threshold for large but expected chunks (CodeMirror).
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting — why this matters for Lighthouse:
         *
         *  - Each chunk gets its own cache entry in the browser.
         *  - Vendor libraries (React, CodeMirror, dnd-kit) change far less
         *    often than your app code, so they stay cached across deploys.
         *  - Smaller per-chunk downloads improve Time to Interactive on
         *    slower connections.
         *
         * Three buckets:
         *  vendor-react     — React + React-DOM (always needed, rarely changes)
         *  vendor-editor    — CodeMirror (heavy, almost never changes)
         *  vendor-dnd       — dnd-kit (medium, rarely changes)
         *  vendor           — everything else from node_modules
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("/react-dom/") || id.includes("/react/")) {
            return "vendor-react";
          }
          if (id.includes("/@codemirror/") || id.includes("/codemirror/") || id.includes("/@lezer/")) {
            return "vendor-editor";
          }
          if (id.includes("/@dnd-kit/")) {
            return "vendor-dnd";
          }

          // Everything else in node_modules goes into a single vendor chunk.
          return "vendor";
        },
      },
    },
  },
});
