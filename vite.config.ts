import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages (https://<user>.github.io/shindanshi-past-questions/) 配下で配信するため
  // サブパスを base に設定。ローカル dev/preview でも同じパスで動く。
  base: "/shindanshi-past-questions/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["data/*.json"],
      workbox: {
        // master_1ji.json (約5MB) を含め全データをプリキャッシュし完全オフライン動作
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,json,png,svg,woff2}"],
      },
      manifest: {
        name: "中小企業診断士 過去問",
        short_name: "診断士過去問",
        description: "中小企業診断士試験(1次・2次)過去問学習アプリ",
        lang: "ja",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
