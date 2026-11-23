import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import process from 'node:process';

const [baseRef, outputFile] = process.argv.slice(2);
const { SCREENSHOTS_URL, HEAD_SHA, RUN_URL } = process.env;
const repoRoot = process.cwd();

const packages = [
  { name: 'API', dir: 'apps/api' },
  { name: 'Web', dir: 'apps/web' },
  { name: 'Shared', dir: 'packages/shared' },
];

function readSummary(dir) {
  const file = resolve(repoRoot, dir, 'coverage/coverage-summary.json');
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function formatRatio({ covered, total }) {
  if (total === 0) return 'n/a';
  return `${((covered / total) * 100).toFixed(1)}% (${covered}/${total})`;
}

function changedFiles() {
  try {
    return execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=AMR', `${baseRef}...HEAD`],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

const summaries = packages.map((pkg) => ({ ...pkg, summary: readSummary(pkg.dir) }));
const fileCoverage = new Map();
for (const { summary } of summaries) {
  for (const [file, metrics] of Object.entries(summary ?? {})) {
    if (file !== 'total') fileCoverage.set(relative(repoRoot, file), metrics);
  }
}

const lines = ['<!-- ci-report -->', '## CI report', ''];

lines.push(
  SCREENSHOTS_URL
    ? `**Journey screenshots:** [journey-screenshots](${SCREENSHOTS_URL})`
    : '**Journey screenshots:** none were uploaded on this run.',
  '',
  '### Coverage',
  '',
);

if (summaries.every(({ summary }) => !summary)) {
  lines.push("Coverage didn't run on this run (the tests may have failed earlier), so there are no figures.");
} else {
  lines.push('| Package | Lines | Branches |', '|---|---|---|');
  for (const { name, summary } of summaries) {
    lines.push(
      summary
        ? `| ${name} | ${formatRatio(summary.total.lines)} | ${formatRatio(summary.total.branches)} |`
        : `| ${name} | didn't run | didn't run |`,
    );
  }
  lines.push(
    '',
    'Counts every source file, including ones no test loads. Web components and pages are covered by the Playwright journey, not by Vitest.',
    '',
    '### Files this PR changed',
    '',
  );

  const changed = changedFiles();
  const changedWithCoverage = (changed ?? []).filter((file) => fileCoverage.has(file));
  if (!changed) {
    lines.push(`Couldn't diff against \`${baseRef}\`.`);
  } else if (changedWithCoverage.length === 0) {
    lines.push('No source files with coverage changed.');
  } else {
    lines.push('| File | Lines | Branches |', '|---|---|---|');
    for (const file of changedWithCoverage) {
      const metrics = fileCoverage.get(file);
      lines.push(`| \`${file}\` | ${formatRatio(metrics.lines)} | ${formatRatio(metrics.branches)} |`);
    }
  }
}

const footer = [HEAD_SHA && `commit ${HEAD_SHA.slice(0, 7)}`, RUN_URL && `[run](${RUN_URL})`]
  .filter(Boolean)
  .join(', ');
lines.push('', `<sub>For information only: nothing here fails the build.${footer ? ` From ${footer}.` : ''}</sub>`, '');

writeFileSync(outputFile, lines.join('\n'));
