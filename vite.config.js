import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
      manifest: {
        name: "ShowUp",
        short_name: "ShowUp",
        description: "Show up or pay up — social accountability with friends, staked in Gold Flakes.",
        theme_color: "#0D0D0D",
        background_color: "#0D0D0D",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Only precache the built app shell/assets. Do not add runtime
        // caching for API calls: Supabase (auth/RPCs) and Stripe redirects
        // must always hit the network. navigateFallback covers same-origin
        // SPA navigations (including `?event=` / `?checkout=` query params
        // on `/`); cross-origin OAuth/Stripe redirects are never intercepted
        // by the service worker.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/supabase\//],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
