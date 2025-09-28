import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT' || 
            warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      }
    }
  }
}));
