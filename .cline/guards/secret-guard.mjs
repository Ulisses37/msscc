#!/usr/bin/env node
/**
 * Cline PreToolUse secret guard.
 *
 * Reads the hook payload from stdin and cancels any tool call whose file paths
 * or shell command tokens point at a secret file (.env files, keys, certs).
 * Also blocks changes to the guard itself and to .clineignore.
 *
 * Called by .clinerules/hooks/PreToolUse (macOS/Linux) and
 * .clinerules/hooks/PreToolUse.ps1 (Windows). Requires Node.js only.
 */

import { readFileSync } from 'node:fs';

const PATH_KEYS = new Set([
  'path',
  'paths',
  'file',
  'files',
  'file_path',
  'file_paths',
  'filePath',
  'filePaths',
  'absolutePath',
  'target_file',
  'directory',
  'cwd',
]);
const COMMAND_KEYS = new Set(['command', 'commands', 'cmd', 'args', 'script']);
const PATCH_HEADER = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;

const SECRET_NAME = [
  /^\.env([.*?[].*)?$/i,
  /\.(pem|key|p12|pfx)$/i,
  /^id_(rsa|ed25519|ecdsa)/i,
];
const ALLOWED_NAME = [/\.example$/i];

const PROTECTED_PATHS = [
  /(^|\/)\.clineignore$/,
  /(^|\/)\.clinerules\/hooks\//,
  /(^|\/)\.cline\/guards\//,
];

function respond(cancel, errorMessage) {
  process.stdout.write(JSON.stringify(cancel ? { cancel, errorMessage } : { cancel }));
  process.exit(0);
}

function dejson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function collect(value, bucket, out) {
  const parsed = dejson(value);
  if (typeof parsed === 'string') {
    if (bucket) out[bucket].push(parsed);
    for (const match of parsed.matchAll(PATCH_HEADER)) {
      out.paths.push((match[1] || match[2]).trim());
    }
    return;
  }
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => collect(item, bucket, out));
    return;
  }
  if (parsed && typeof parsed === 'object') {
    for (const [key, child] of Object.entries(parsed)) {
      let childBucket = null;
      if (PATH_KEYS.has(key)) childBucket = 'paths';
      else if (COMMAND_KEYS.has(key)) childBucket = 'commands';
      collect(child, childBucket ?? bucket, out);
    }
  }
}

function tokenize(command) {
  return command
    .split(/[\s;|&()<>=,`]+/)
    .map((token) => token.replace(/^['"]+|['"]+$/g, ''))
    .filter((token) => token && !token.startsWith('-'));
}

function normalize(candidate) {
  return candidate.replace(/\\/g, '/').replace(/^['"]+|['"]+$/g, '').trim();
}

function isSecret(candidate) {
  const name = normalize(candidate).split('/').pop() ?? '';
  if (!name) return false;
  if (ALLOWED_NAME.some((pattern) => pattern.test(name))) return false;
  return SECRET_NAME.some((pattern) => pattern.test(name));
}

function isProtected(candidate) {
  const path = normalize(candidate);
  return PROTECTED_PATHS.some((pattern) => pattern.test(path));
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  respond(true, 'Secret guard could not parse the hook payload, so the tool call was blocked.');
}

const toolName = String(
  payload?.preToolUse?.toolName ?? payload?.tool_call?.name ?? payload?.toolName ?? '',
);
const parameters = payload?.preToolUse?.parameters ?? payload?.tool_call?.input ?? payload?.parameters ?? {};
const isReadOnlyTool = /read|list|search/i.test(toolName);

const found = { paths: [], commands: [] };
collect(parameters, typeof dejson(parameters) === 'string' ? 'commands' : null, found);

const commandTokens = found.commands.flatMap(tokenize);
const candidates = [...found.paths, ...commandTokens];

const secretHits = [...new Set(candidates.filter(isSecret))];
if (secretHits.length > 0) {
  respond(
    true,
    `Blocked ${toolName || 'tool call'}: ${secretHits.join(', ')} is a secret file. ` +
      'Cline may not read, edit, or run commands against secret files. ' +
      'Use the matching .env.example file for variable names.',
  );
}

const protectedHits = [
  ...new Set([
    ...(isReadOnlyTool ? [] : found.paths.filter(isProtected)),
    ...commandTokens.filter(isProtected),
  ]),
];
if (protectedHits.length > 0) {
  respond(
    true,
    `Blocked ${toolName || 'tool call'}: ${protectedHits.join(', ')} is part of the Cline ` +
      'access guard. Change it by hand in a reviewed commit.',
  );
}

respond(false);
