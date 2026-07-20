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

          // NOTE: Do NOT split React (react / react-dom) into its own chunk.
          // Libraries like react-hot-toast and lucide-react call
          // React.createContext() at module-init time. When React lives in a
          // separate chunk, cross-chunk ES-module binding order can leave
          // `React` undefined at that point →
          //   "Cannot read properties of undefined (reading 'createContext')"
          //
          // NOTE: CodeMirror + lezer also must NOT be isolated into their own
          // chunk — they have internal circular deps that cause a Rollup TDZ
          // error at runtime:
          //   "Cannot access 'X' before initialization"
          //
          // Safest rule: everything from node_modules → one "vendor" chunk.
          return "vendor";
        },
      },
    },
  },
});
