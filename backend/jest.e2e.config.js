/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test/e2e/setup.ts'],
};
