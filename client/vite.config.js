import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const proxyPaths = [
  "/health",
  "/verify",
  "/verify-file",
  "/issue",
  "/revoke",
  "/certificates",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useDevelopmentProxy = !env.VITE_API_BASE_URL;

  return {
    plugins: [react()],
    server: useDevelopmentProxy
      ? {
          proxy: Object.fromEntries(
            proxyPaths.map((path) => [
              path,
              { target: "http://localhost:3000", changeOrigin: true },
            ]),
          ),
        }
      : undefined,
  };
});
