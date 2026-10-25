import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // How many reverse proxies sit in front of the API (0 = none). Only then is X-Forwarded-For believed.
  TRUST_PROXY: z.string().default('0'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  ADMIN_EMAIL: z.string().default('admin@rms.local'),
  ADMIN_PASSWORD: z.string().default('ChangeMe123!'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// In production the secret must be a real one, not the placeholder from .env.example.
if (env.NODE_ENV === 'production' && (/change-?me/i.test(env.JWT_SECRET) || env.JWT_SECRET.length < 32)) {
  console.error('Invalid environment configuration: JWT_SECRET must be a random string of at least 32 characters in production (not the placeholder).');
  process.exit(1);
}

/** 'true'/'false', a hop count ('1'), or a proxy address/subnet list, as Express expects. */
const parseTrustProxy = (v) => {
  const s = String(v).trim();
  if (s === 'true') return true;
  if (s === 'false' || s === '' || s === '0') return false;
  return /^\d+$/.test(s) ? Number(s) : s;
};
export default {
  ...env,
  isProd: env.NODE_ENV === 'production',
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
};
