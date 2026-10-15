import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://tonyfromvietnam.github.io/chinh-recovery/
export default defineConfig({
  plugins: [react()],
  base: "/chinh-recovery/",
});
