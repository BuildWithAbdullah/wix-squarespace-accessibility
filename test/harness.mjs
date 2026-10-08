/**
 * test/harness.mjs
 *
 * One browser for the whole suite, and one way to grade a page.
 *
 * Grading a page means loading it, injecting the audit, and collecting every
 * finding. Whether the repair layer is injected as well is the only thing
 * that changes between the three questions the suite asks:
 *
 *   fail.html with no rules      does the failing example actually fail?
 *   pass.html with no rules      is the corrected example genuinely correct?
 *   fail.html with the rules     does the shipped repair layer earn the same
 *                                grade as fixing it in the editor would?
 *
 * The third is the one that matters commercially, because it is the claim
 * the repository makes to anybody who pastes the injection block into a
 * client site.
 */

import puppeteer from 'puppeteer';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runBehaviour } from '../audit/behaviour.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* The library and audit files, in the order a browser needs them: the text
   helpers before the name computation that uses them, both before the rules
   and the checks. tools/bundle.mjs emits the same order, and
   test/bundle.test.mjs asserts the two agree. */
export const LIB_FILES = [
  'lib/text.js',
  'lib/accessible-name.js',
  'shared/a11y-injection-kit.js'
];

export const AUDIT_FILES = ['audit/checks.js'];

export function ruleFiles() {
  return readdirSync(path.join(ROOT, 'rules'))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => 'rules/' + f);
}

let browser = null;

export async function getBrowser() {
  if (browser) return browser;
  const options = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  /* Set PUPPETEER_EXECUTABLE_PATH when a Chromium is already on the machine
     and Puppeteer's own download was skipped. CI installs normally and needs
     nothing. */
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  browser = await puppeteer.launch(options);
  return browser;
}

export async function closeBrowser() {
  if (browser) { await browser.close(); browser = null; }
}

async function addFiles(page, files) {
  for (const file of files) {
    await page.addScriptTag({ path: path.join(ROOT, file) });
  }
}

/**
 * Open an example page with the audit loaded, and optionally the repair
 * layer. Returns the page so a caller can keep interacting with it.
 */
export async function openExample(relativePath, { withRules = false } = {}) {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 480, height: 800 });
  await page.goto(pathToFileURL(path.join(ROOT, relativePath)).href, { waitUntil: 'load' });

  /* Any real activation of any control, from mouse or keyboard, is counted
     here rather than in each example. The behavioural check for a promoted
     control asks whether pressing Enter made the page react at all, and a
     control that is genuinely operable dispatches a click that reaches this
     listener. */
  await page.evaluate(() => {
    window.__activations = 0;
    document.addEventListener('click', () => { window.__activations++; }, true);
  });

  await addFiles(page, LIB_FILES);
  if (withRules) {
    await addFiles(page, ruleFiles());
    await page.evaluate(() => window.A11yKit.start());
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  await addFiles(page, AUDIT_FILES);
  return page;
}

/** Every finding on a page, static and behavioural. */
export async function gradePage(page) {
  const statics = await page.evaluate(() => window.A11yChecks.runStatic(document));
  const behavioural = await runBehaviour(page);
  return statics.concat(behavioural);
}

export async function grade(relativePath, options) {
  const page = await openExample(relativePath, options);
  try {
    return await gradePage(page);
  } finally {
    await page.close();
  }
}

export function idsOf(findings) {
  return [...new Set(findings.map((f) => f.id))].sort();
}
