import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import clerk from '@clerk/astro';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react(), clerk()],
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
    ssr: {
      noExternal: [
        '@gravity-ui/uikit',
        '@gravity-ui/components',
        '@gravity-ui/markdown-editor',
        '@diplodoc/transform',
      ],
      external: ['sharp', 'detect-libc'],
    },
    server: {
      allowedHosts: ["yearlong-jon-patrilineal.ngrok-free.dev"]
    },
  },
});