import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'modules'];
const sourceExtensions = new Set(['.js', '.jsx', '.kt', '.ts', '.tsx']);
const forbiddenPatterns = [
  /\bconsole\.(?:debug|info|log|trace|warn)\s*\(/,
  /\bLog\.(?:d|e|i|v|w|wtf)\s*\(/,
  /\bprintln\s*\(/,
];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'build') {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = (
  await Promise.all(roots.map((root) => collectSourceFiles(root)))
).flat();
const violations = [];

for (const file of files) {
  const contents = await readFile(file, 'utf8');

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(contents)) {
      violations.push(`${file}: ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Potentially sensitive debug logging found:\n${violations.join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write('Sensitive debug log check passed.\n');
}
