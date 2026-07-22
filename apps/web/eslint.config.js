import baseConfig from '@akp/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  ...baseConfig,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-page-custom-font': 'off',
    },
    languageOptions: {
        parserOptions: {
          tsconfigRootDir: import.meta.dirname,
          projectService: {
            allowDefaultProject: [
              'eslint.config.js',
              'next.config.mjs',
              'postcss.config.mjs',
              'vitest.config.ts',
            ],
          },
        },
    },
  },
  {
    files: [
      '**/*.config.js',
      '**/*.config.mjs',
      '**/eslint.config.js',
      '**/next.config.mjs',
      '**/postcss.config.mjs',
      '**/playwright.config.ts',
      '**/vitest.config.ts',
    ],
    rules: {
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
];