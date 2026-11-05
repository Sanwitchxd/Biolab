import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Puerto del frontend (PORT) y del backend (BACKEND_PORT) configurables por variable de entorno.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: process.env.DEV_SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "8443"),
    strictPort: true,
    // /api -> backend (así el navegador no necesita CORS en desarrollo)
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: process.env.DEV_SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "8443"),
  },
});
