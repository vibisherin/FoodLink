import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Browser calls /api/... on the Vite port; Vite forwards them to Express.
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
