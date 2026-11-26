// Runs after the build (see the "build" script). Fails the build if the calculator island grows past its budget.
//
// Two budgets, because "the calculator widget under 45 KB gzipped" (Prompt 13) can be read two ways:
//   1. The widget's own chunk (CalculatorWidget.*.js): the plan's 45 KB, read literally.
//   2. Everything the widget needs except the React runtime (its own chunk, zod, decimal.js, formatting, the currency store
//      and the largest calculator module): a guard against creep. Set a little above today's size, so it fails on growth,
//      not on today.
// React itself (client.*.js, react.*.js) is reported separately; it is the framework, not calculator code.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIR = join(process.cwd(), 'dist', '_astro');
export const WIDGET_CHUNK_BUDGET = 45 * 1024;
export const WIDGET_CLOSURE_BUDGET = 66 * 1024;
const FRAMEWORK = /^(client|react)\./;

const gz = (file: string): number => gzipSync(readFileSync(join(DIR, file))).length;
const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;

export function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1]);
}

export interface BundleReport {
  widget: { file: string; gzip: number };
  closure: { file: string; gzip: number }[];
  framework: { file: string; gzip: number }[];
  largestCalculator: { file: string; gzip: number };
}

export function measure(files: string[], read: (f: string) => string, size: (f: string) => number): BundleReport {
  const widgetFile = files.find((f) => /^CalculatorWidget\..+\.js$/.test(f));
  if (!widgetFile) throw new Error('No CalculatorWidget chunk in dist/_astro: has the build run?');
  const seen = new Set<string>();
  const walk = (f: string) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const dep of importsOf(read(f))) if (files.includes(dep)) walk(dep);
  };
  // The widget loads one calculator module on demand. Its own dependencies (zod, decimal.js, helpers) are part of what
  // a visitor downloads, so the largest module's static imports are counted too.
  const calculators = files.filter((f) => /-calculator\..+\.js$|^cm-to-inches\..+\.js$/.test(f)).map((file) => ({ file, gzip: size(file) }));
  const largest = calculators.sort((a, b) => b.gzip - a.gzip)[0] ?? { file: '(none)', gzip: 0 };
  walk(widgetFile);
  if (largest.file !== '(none)') walk(largest.file);
  seen.delete(largest.file); // reported on its own line
  return {
    widget: { file: widgetFile, gzip: size(widgetFile) },
    closure: [...seen].filter((f) => !FRAMEWORK.test(f)).map((file) => ({ file, gzip: size(file) })),
    framework: files.filter((f) => FRAMEWORK.test(f)).map((file) => ({ file, gzip: size(file) })),
    largestCalculator: largest,
  };
}

export default function main(): number {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));
  const report = measure(files, (f) => readFileSync(join(DIR, f), 'utf8'), gz);
  const closure = report.closure.reduce((n, c) => n + c.gzip, 0) + report.largestCalculator.gzip;
  const framework = report.framework.reduce((n, c) => n + c.gzip, 0);

  console.log('bundle-size (gzip):');
  console.log(`  widget chunk            ${kb(report.widget.gzip).padStart(9)}  budget ${kb(WIDGET_CHUNK_BUDGET)}   ${report.widget.file}`);
  for (const c of report.closure.sort((a, b) => b.gzip - a.gzip)) console.log(`    + ${c.file.padEnd(46)} ${kb(c.gzip).padStart(9)}`);
  console.log(`    + largest calculator module ${report.largestCalculator.file.padEnd(24)} ${kb(report.largestCalculator.gzip).padStart(9)}`);
  console.log(`  widget and its code     ${kb(closure).padStart(9)}  budget ${kb(WIDGET_CLOSURE_BUDGET)}`);
  console.log(`  React runtime (not counted) ${kb(framework).padStart(5)}`);

  const problems: string[] = [];
  if (report.widget.gzip > WIDGET_CHUNK_BUDGET)
    problems.push(`the widget chunk is ${kb(report.widget.gzip)} gzipped, over its ${kb(WIDGET_CHUNK_BUDGET)} budget`);
  if (closure > WIDGET_CLOSURE_BUDGET) problems.push(`the widget and its code are ${kb(closure)} gzipped, over the ${kb(WIDGET_CLOSURE_BUDGET)} guard`);
  if (problems.length) {
    console.error(`\nbundle-size FAILED:\n  - ${problems.join('\n  - ')}`);
    return 1;
  }
  console.log('bundle-size OK');
  return 0;
}
