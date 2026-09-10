// .eslintrc.js
const path = require('path');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.join(__dirname, 'tsconfig.eslint.json'),
    tsconfigRootDir: __dirname, // 绝对路径，避免 cwd 变化导致 include 失效
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: path.join(__dirname, 'tsconfig.eslint.json'),
        tsconfigRootDir: __dirname,
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'build/',
    'coverage/',
    'next.config.js',
    'postcss.config.js',
    'tailwind.config.js',
  ],
};
