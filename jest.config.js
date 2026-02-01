module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'db/**/*.js',
    'routes/**/*.js',
    'lib/**/*.js',
    '!node_modules/**',
    '!coverage/**'
  ],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  verbose: true
};
