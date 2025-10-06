#!/usr/bin/env node
import { exit } from 'node:process';

const { npm_execpath = '', npm_config_user_agent = '', SKIP_PNPM_CHECK = '' } = process.env;

const isPnpm = npm_execpath.includes('pnpm') || npm_config_user_agent.includes('pnpm');
const isBypass = SKIP_PNPM_CHECK.toLowerCase() === 'true';

if (isPnpm || isBypass) {
  exit(0);
}

const message = `\nThis repository uses pnpm.\n\n` +
  `Detected install via another package manager.\n` +
  `Use "corepack enable" followed by "pnpm install".\n` +
  `Set SKIP_PNPM_CHECK=true to bypass (not recommended).\n`;

console.error(message);
exit(1);
