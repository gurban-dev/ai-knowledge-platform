import baseConfig from '@akp/eslint-config';

export default [
  ...baseConfig,

  {
    ignores: ['eslint.config.js', 'scripts/**'],
  },

  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.eslint.json'],
      },
    },
  },

  {
    files: [
      'src/modules/**/*.routes.ts',
      'src/modules/**/*.controller.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  
  {
    files: [
      '**/*.test.ts',
      'test/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  {
    files: [
      'src/plugins/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    files: [
      'src/plugins/auth.ts',
    ],
    rules: {
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
];