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
