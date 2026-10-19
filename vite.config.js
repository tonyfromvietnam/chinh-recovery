import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the root of the Vercel site (https://chinh-recovery.vercel.app) and http://localhost:5173/
export default defineConfig({
  plugins: [react()],
  base: "/",
});
