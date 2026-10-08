/**
 * tools/run-tests.mjs
 *
 * Runs the suite and checks the number the README quotes.
 *
 * It uses the structured event stream from node:test rather than the text a
 * reporter prints. That is not a stylistic preference. A verifier that parses
 * `node --test` output breaks on Node 24, which prints the spec reporter even
 * when piped, while Node 20 and 22 print TAP, and that difference has turned
 * CI red in a sibling repository for no reason at all. The event stream is
 * objects, identical on every supported version, so the reporter question
 * never arises.
 *
 * Counting tests from the sources instead was the other option, and it is
 * wrong here: a third of the cases in this suite are generated from tables,
 * so the number in the file and the number that runs are different, and only
 * one of them is worth quoting.
 *
 *   npm test                 run everything and check the README count
 *   npm test -- --no-count   run everything, skip the README check
 */

import { run } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TEST_FILES = [
  'test/text.test.mjs',
  'test/name.test.mjs',
  'test/kit.test.mjs',
  'test/pairs.test.mjs',
  'test/catalogue.test.mjs',
  'test/bundle.test.mjs'
].map((f) => path.join(ROOT, f));

/* tools/verify.mjs imports TEST_FILES from here, so running the suite has to
   be something this module does when it is executed and not something it
   does when it is read. The same trap as a bundler that writes its output on
   import, and the same fix. */
const RUN_DIRECTLY = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const checkCount = !process.argv.includes('--no-count');

let passed = 0;
const failed = [];

/* The stream is consumed with for await rather than with event listeners.
   An object stream only flows once something reads it, and attaching named
   event listeners alone does not count as reading it: the run completes, the
   listeners fire for some events and not others, the end handler may never
   run, and the process exits 0 having checked nothing. A runner that reports
   success by failing to look is the exact failure this repository is about,
   so it is worth the extra three lines to consume the stream properly. */
if (RUN_DIRECTLY) {
  for await (const event of run({ files: TEST_FILES, concurrency: 1 })) {
    if (event.type === 'test:pass') {
      if (event.data.skip || event.data.todo) continue;
      if (event.data.nesting !== 0) continue;
      passed++;
      process.stdout.write('ok   ' + event.data.name + '\n');
    } else if (event.type === 'test:fail') {
      if (event.data.nesting !== 0) continue;
      failed.push(event.data);
      process.stdout.write('FAIL ' + event.data.name + '\n');
      const error = event.data.details && event.data.details.error;
      if (error) {
        process.stdout.write('     ' + String(error.message || error).split('\n').join('\n     ') + '\n');
      }
    }
  }

  const total = passed + failed.length;
  process.stdout.write('\n' + passed + ' of ' + total + ' tests passed across ' + TEST_FILES.length + ' suites.\n');

  if (failed.length) process.exit(1);

  if (total === 0) {
    process.stdout.write('No tests ran at all, which is not a pass.\n');
    process.exit(1);
  }

  if (checkCount) {
    const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    /* Both places the README states the number, matched as whole strings.
       A loose pattern here read the trailing number of "325 of 327 ...
       passed" and agreed with itself while the line was nonsense. */
    const invocation = 'npm test          # ' + total + ' tests across ' + TEST_FILES.length + ' suites';
    const output = total + ' of ' + total + ' tests passed across ' + TEST_FILES.length + ' suites.';
    const missing = [invocation, output].filter((line) => !readme.includes(line));
    if (missing.length) {
      process.stdout.write('The README does not state the run exactly. Expected these lines:\n');
      missing.forEach((line) => process.stdout.write('  ' + line + '\n'));
      process.exit(1);
    }
    process.stdout.write('The README count matches.\n');
  }
}
