import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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