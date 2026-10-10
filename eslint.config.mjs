/**
 * LINT RULES for the whole monorepo (ESLint "flat config"). Run with `npm run lint` from the repository root.
 * Lint only REPORTS problems; it never changes files unless you run `npm run lint:fix` yourself.
 * Uses: ESLint's recommended rules, typescript-eslint's recommended rules, and the React Hooks rules for the
 * website, admin panel and UI kit. See docs/CODING_STANDARDS.md ("Linting and formatting").
 */
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `_name` marks a value that is unused on purpose (e.g. `const { maxAge: _maxAge, ...rest } = opts`).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  // API, scripts and tests run in Node. The server logs through pino, so a stray console.log is flagged.
  {
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'warn' },
  },
  // Browser apps and the UI kit: React Hooks must follow the rules of hooks.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler advice (components declared inside components, setState in effects, libraries the
      // compiler can't optimise). Shown as warnings: fixing them means refactoring pages, done page by page later.
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
  // Config files (vite, tailwind, postcss, tsup) run in Node; the .cjs ones use require().
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
