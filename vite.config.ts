import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `test` is consumed by Vitest; use `vite` entry so production `vite build`
// does not need the `vitest` package on disk.
export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["**/playtest-*.spec.js"],
  },
});
