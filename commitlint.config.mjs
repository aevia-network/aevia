/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // apps
        'video',
        'network',
        // services
        'provider-node',
        'recorder',
        'manifest-svc',
        'indexer',
        // packages
        'protocol',
        'ui',
        'auth',
        'libp2p-config',
        'contracts',
        // cross-cutting
        'infra',
        'ci',
        'docs',
        'deps',
        'repo',
        'release',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
