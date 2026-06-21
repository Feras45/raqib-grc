import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy sends /api to `vercel dev` (port 3000). In production both are one origin.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
  build: { outDir: "dist", sourcemap: false },
});
