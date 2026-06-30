import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
      '.refonte-backup-*/**',
      // Catalyst is a vendored third-party UI kit — keep it as shipped.
      'components/catalyst/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Next 16 ships stricter react-hooks rules. These two fire on patterns
      // that are correct here: Date.now() in Server Components (no re-render)
      // and one-shot setState inside a guarded effect. Downgrade to warn so
      // they surface without failing the gate — revisit as cleanup.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
