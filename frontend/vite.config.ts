import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080";
const devPort = Number(process.env.VITE_DEV_PORT ?? 5173);
// Browser hits host port 3000 while Vite listens on 5173 inside Docker
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT ?? devPort);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: devPort,
    watch: {
      // Reliable file watching when the source tree is bind-mounted (Docker on Windows)
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
    hmr: {
      clientPort: hmrClientPort,
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
