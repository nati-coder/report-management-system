/**
 * Shared password policy, mirrored by the backend's `strongPassword` zod schema:
 * at least 8 characters, one uppercase letter, one lowercase letter, one special character.
 */
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'special', label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const checkPassword = (pw = '') => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(pw) }));
export const isStrongPassword = (pw = '') => PASSWORD_RULES.every((r) => r.test(pw));
