module.exports = {
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    env: {
        es6: true,
        browser: false,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'prettier',
    ],
    plugins: [
        'import',
        'prettier',
    ],
    rules: {
        indent: ['error', 4],
        semi: ['error', 'always'],
        'no-console': 'off',
        'no-param-reassign': 'off',
        'no-restricted-syntax': 'off',
        'no-await-in-loop': 'off',
    },
};
