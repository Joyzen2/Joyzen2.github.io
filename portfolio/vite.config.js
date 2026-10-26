import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const entry = path => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({ plugins: [react()], base: '/', build: { rolldownOptions: { input: { home: entry('./index.html'), csi500: entry('./csi500/index.html'), text: entry('./text-factors/index.html'), investor: entry('./investorbench/index.html') } } } });
