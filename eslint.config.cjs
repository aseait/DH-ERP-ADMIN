// eslint.config.cjs
const path = require('node:path');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

const projectTsconfig = path.resolve(__dirname, 'tsconfig.eslint.json');

module.exports = tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/'],
  },

  // TypeScript type-checked rules for .ts/.tsx files
  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: projectTsconfig,
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      prettier: prettier,
    },
    rules: {
      // Prettier
      ...prettierConfig.rules,
      'prettier/prettier': 'error',

      // React Hooks — the two stable rules; v7 additions are React-Compiler-specific, keep off
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Relax a few @typescript-eslint rules that are too noisy for this codebase
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  }
);
