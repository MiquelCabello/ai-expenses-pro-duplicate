#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readDotEnv = () => {
  try {
    const raw = readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8');
    return raw.split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...rest] = line.split('=');
        if (!key) return acc;
        const value = rest.join('=').replace(/^"|"$/g, '').trim();
        if (value.length > 0) acc[key] = value;
        return acc;
      }, {});
  } catch (error) {
    return {};
  }
};

const envFromFile = readDotEnv();
const env = { ...envFromFile, ...process.env };

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in the environment or .env file.');
  process.exitCode = 1;
  process.exit();
}

const callFunction = async (fnName) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed calling ${fnName}: ${response.status} ${response.statusText}\n${text}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
};

const main = async () => {
  try {
    const [hibpEnabled, postgresVersion] = await Promise.all([
      callFunction('is_leaked_password_protection_enabled'),
      callFunction('current_postgres_version'),
    ]);

    const hibpState = typeof hibpEnabled === 'boolean' ? hibpEnabled : hibpEnabled?.is_leaked_password_protection_enabled;

    console.log('Leaked password protection (HIBP):', hibpState ? 'ENABLED' : 'DISABLED');
    console.log('Postgres version:', postgresVersion?.current_postgres_version || postgresVersion);
  } catch (error) {
    console.error('Security status check failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
};

await main();
