import { checkPassword } from '../../utils/passwordPolicy.js';

/** Live checklist shown under a new-password field. */
export default function PasswordStrength({ password }) {
  const results = checkPassword(password);
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {results.map((r) => (
        <li key={r.key} className={r.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
          {r.passed ? '✓' : '○'} {r.label}
        </li>
      ))}
    </ul>
  );
}
