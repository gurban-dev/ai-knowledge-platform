import baseConfig from '@akp/eslint-config';

export default [
  ...baseConfig,

  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: [
            'eslint.config.js',
            'vitest.config.ts',
            'prisma/seed.ts',
            'prisma/seed.js',
            'src/vector.test.ts',
          ],
        },
      },
    },
  },

  {
    files: [
      '**/*.test.ts',
      '**/*.config.ts',
      '**/eslint.config.js',
      '**/vitest.config.ts',
    ],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },

  {
    files: [
      'prisma/seed.ts',
      'prisma/seed.js',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
];