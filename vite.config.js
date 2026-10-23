import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the root of its Vercel project (https://chinh-recovery.vercel.app), which www.duychinhdinh.com/chinh-recovery
// shows via a rewrite, and from http://localhost:5173/
export default defineConfig({
  plugins: [react()],
  base: "/",
});
