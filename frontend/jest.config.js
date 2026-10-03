/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest.js');

const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  testEnvironment: 'node',
  testMatch: ['**/*.test.{ts,tsx}'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
});
