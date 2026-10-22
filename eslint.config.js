import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  {
    ignores: ['out/**', 'release/**', 'dist/**', 'node_modules/**', '*.config.js']
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Underscore prefix is the project's existing signal for a deliberately
      // unused parameter (e.g. ProseMirror plugin callbacks).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      // Stripping control characters from filenames and paths is the point of
      // the regexes this flags (fileSystem.ts, tomes/paths.ts).
      'no-control-regex': 'off'
    }
  },

  // Build scripts are CommonJS and run under Node, so require() is correct there.
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  // Main and preload: Node globals, no DOM.
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Renderer: browser globals, React rules. react-hooks catches the stale-closure
  // and dependency bugs; jsx-a11y catches unlabelled and unreachable controls.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // Baseline for adopting lint on an existing codebase. These are real
      // findings, not noise, and they stay reported — they are warnings so that
      // `npm run lint` can gate new problems today instead of failing on debt
      // that predates it. Work them down and promote each back to 'error'.
      //
      //   react-hooks/set-state-in-effect  (30) — React Compiler-era rules, new in
      //   react-hooks/refs                 (23)   eslint-plugin-react-hooks v6
      //   react-hooks/immutability          (1)
      //   react-hooks/exhaustive-deps      (17) — already warn by default
      //   jsx-a11y/*                       (21) — sidebar tree and card grid are
      //                                           keyboard-inaccessible; panel
      //                                           labels lack htmlFor
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'warn',
      '@typescript-eslint/no-this-alias': 'warn'
    }
  },

  // Shared runs in both processes.
  {
    files: ['src/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    }
  },

  // Tests: vitest globals are imported explicitly, but these need Node.
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
