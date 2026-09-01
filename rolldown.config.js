import { defineConfig } from 'rolldown'

// Mirrors the original tsdown config: bundle to ESM and INLINE `mri`
// (upstream `inlineDeps: ['mri']` + alias to `mri/lib/index.mjs`).
export default defineConfig({
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'index.js',
  },
  resolve: {
    alias: { mri: 'mri/lib/index.mjs' },
  },
})
