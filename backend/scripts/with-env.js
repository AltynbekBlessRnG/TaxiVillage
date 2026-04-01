const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const value = stripQuotes(line.slice(eqIndex + 1).trim());
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envFileName = process.env.ENV_FILE || '.env';
const envFilePath = path.resolve(process.cwd(), envFileName);
loadEnvFile(envFilePath);

process.on('unhandledRejection', (reason) => {
  const message = String(reason && reason.message ? reason.message : reason || '');
  if (message.toLowerCase().includes('connection is closed')) {
    return;
  }
  console.error(reason);
  process.exitCode = 1;
});

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('with-env requires a command');
  process.exit(1);
}

const command = args[0];
const commandArgs = args.slice(1);

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
