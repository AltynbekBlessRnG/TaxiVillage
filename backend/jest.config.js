/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
