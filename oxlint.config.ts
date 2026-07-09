import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["dist/**", "dist-ssr/**", "src-tauri/target/**"],
});
