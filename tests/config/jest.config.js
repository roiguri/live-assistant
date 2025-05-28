module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '../../',
  roots: ['<rootDir>/tests/unit'],
  collectCoverageFrom: [
    'services/**/*.js',
    'content/**/*.js',
    'popup/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/config/test-helpers.js'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js'
  ],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  }
}; 