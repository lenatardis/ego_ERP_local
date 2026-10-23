import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    // GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH
    base: process.env.BASE_PATH || "/",
    plugins: [react()],
    server: {
        proxy: {
            "/media": {
                target: "https://dev.panel.egodevelopment.pp.ua",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});