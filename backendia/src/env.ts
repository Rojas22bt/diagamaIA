import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// The hosting environment takes precedence; local credentials stay on the server.
if (existsSync('.env')) loadEnvFile('.env');
