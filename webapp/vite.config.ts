import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// De webapp komt op GitHub Pages in de map /roof360-web/nieuw/.
// Het oude voorbeeld (index.html in de hoofdmap) blijft zo gewoon werken.
// "npm run voorbeeld" maakt een losse preview in ../../voorbeeld (niet in de repo).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'voorbeeld' ? './' : '/roof360-web/nieuw/',
  build: {
    outDir: mode === 'voorbeeld' ? '../../voorbeeld' : '../nieuw',
    emptyOutDir: true,
  },
}));
