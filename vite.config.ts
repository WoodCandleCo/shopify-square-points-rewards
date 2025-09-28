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
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015',
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress common warnings that don't affect functionality
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT' || 
            warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
            warning.code === 'EVAL') {
          return;
        }
        warn(warning);
      }
    }
  }
}));