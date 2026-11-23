import path from "node:path";
import { defineConfig, loadEnv, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function jsxInJs() {
  return {
    name: "cra-jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      const [file] = id.split("?");
      if (!/\/src\/.*\.js$/.test(file) || file.includes("/node_modules/")) return null;
      return transformWithOxc(code, file, { lang: "jsx", jsx: { runtime: "automatic" } });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, ["REACT_APP_", "VITE_"]);
  return {
    plugins: [
      jsxInJs(),
      react(),
      tailwindcss(),
    ],
    envPrefix: ["VITE_", "REACT_APP_"],
    define: Object.fromEntries(
      Object.entries(env)
        .filter(([key]) => key.startsWith("REACT_APP_"))
        .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
    ),
    resolve: {
      alias: [{ find: "@", replacement: path.resolve(__dirname, "./src") }],
    },
    optimizeDeps: {
      rolldownOptions: { moduleTypes: { ".js": "jsx" } },
    },
    build: { outDir: "build" },
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
  };
});

