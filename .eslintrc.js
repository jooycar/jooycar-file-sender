module.exports = {
  root: true,
  extends: [ 'jooycar' ],
  rules: {
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-empty-function': 'off',
  },
  globals: {
    context: true,
    describe: true,
    before: true,
    beforeEach: true,
    it: true,
    after: true,
    afterEach: true,
    requireModel: true,
    requireHelper: true,
    expect: true,
    Set: true,
    Map: true,
  },
  env: {
    node: true,
  },
}
