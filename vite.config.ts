import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// demo_page.html is a SingleFile snapshot of a Rightmove property page; Vite
// serves it as-is and our inject bundle is loaded from a <script type=module>
// tag appended to it. dashboard.html is the full-page breakdown.
export default defineConfig({
  plugins: [react()],
  server: {port: 5173, open: '/demo_page.html'},
  build: {
    rollupOptions: {
      input: {
        demo: resolve(__dirname, 'demo_page.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
});
