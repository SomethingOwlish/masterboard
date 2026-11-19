module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
  overrides: [
    {
      // ТЗ-3, этап 17 (В8): long JSX lines are a warning; files are reformatted when a stage touches them.
      files: ['*.tsx'],
      rules: {
        'max-len': ['warn', { code: 160, ignoreComments: true, ignoreUrls: true, ignoreStrings: false, ignoreTemplateLiterals: false, ignoreRegExpLiterals: true }],
      },
    },
  ],
}
