import { defineConfig } from 'tsup';

// Production bundle for hosting (e.g. Render): `npm run build -w @bluenova/api`, then `npm start -w @bluenova/api`.
export default defineConfig({
  entry: ['src/server.ts', 'src/scripts/seed.ts', 'src/scripts/seedSuperAdmin.ts', 'src/scripts/testEmail.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: false,
  // The shared workspace package is TypeScript source, so it is bundled in; real npm packages stay external.
  noExternal: ['@bluenova/shared'],
});
