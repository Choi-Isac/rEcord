import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해 GitHub Pages 등 하위 경로 배포에서도 동작하게 한다
  base: "./",
});
