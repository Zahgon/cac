import js from '@eslint/js'
import globals from 'globals'

// The upstream TypeScript repo used `@sxzz/eslint-config`, a preset built around
// typescript-eslint. This project is plain JavaScript, so it uses the official
// flat config with `@eslint/js` recommended rules instead. The two upstream rule
// overrides ('unicorn/no-array-sort', 'node/prefer-global/process') came from
// plugins that preset pulled in and have no equivalent here.
export default [
  {
    ignores: ['dist', 'coverage', 'skills', 'node_modules'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        // Runtime-detection globals probed with `typeof` in src/runtime.js
        Deno: 'readonly',
        Bun: 'readonly',
      },
    },
    rules: {
      // `while ((m = re.exec(v)))` in utils.js is a deliberate, parenthesised
      // assignment-in-condition — the standard regex iteration idiom.
      'no-cond-assign': ['error', 'except-parens'],
    },
  },
  {
    files: ['tests/**/*.js', 'verify/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
