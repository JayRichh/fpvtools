import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            tag.startsWith('fpv-') ||
            tag.startsWith('pid-') ||
            tag.startsWith('pack-') ||
            tag.startsWith('bbl-') ||
            tag.startsWith('link-') ||
            tag.startsWith('vtx-') ||
            tag.startsWith('unit-') ||
            tag.startsWith('tilt-') ||
            tag.startsWith('tune-') ||
            tag.startsWith('motor-') ||
            tag.startsWith('build-') ||
            tag.startsWith('flight-') ||
            tag.startsWith('rf-'),
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@components': '/src/components',
    },
  },
})
