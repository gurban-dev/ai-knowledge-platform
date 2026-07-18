import baseConfig from '@akp/eslint-config';

export default [
  ...baseConfig,
  {
    ignores: ['prisma/generated/**', 'prisma/seed.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
