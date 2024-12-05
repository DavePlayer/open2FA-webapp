import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext", // Ensure support for ES modules
  },
  worker: {
    format: "es", // Use ES module format for workers
  },
});
