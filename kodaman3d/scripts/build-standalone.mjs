/**
 * build-standalone.mjs — produce ONE self-contained .html file of the whole game.
 *
 * WHY THIS EXISTS. Playtesters are not necessarily developers, and asking someone
 * to install Node, clone a repo and run a dev server to look at a building is a
 * good way to never get feedback. This emits a single file that opens by
 * double-click, with nothing to install and nothing to fetch.
 *
 * WHY IT IS EVEN POSSIBLE HERE, which is not true of most 3D projects: this build
 * has NO ASSET FILES. Every texture is painted procedurally into a canvas at
 * startup (`facadeAtlas.js` and friends), and the environment map is PMREM-baked
 * from a synthetic sky rather than loaded from an .hdr. So there is nothing to
 * inline except the JavaScript itself. If a future phase adds a .glb — and
 * locked decisions 15/18 say Quaternius glTF is coming for the hero rig — this
 * script will need to inline those as base64 data URIs, or it will silently emit
 * a file that 404s the moment it leaves this machine. THAT IS THE ONE THING THAT
 * WILL BREAK THIS. There is a guard below that fails loudly if it happens.
 *
 * The output is deliberately gitignored. It is a build artifact, it is ~0.6 MB,
 * and committing a new copy every iteration would bloat the history of a repo
 * that already has an open PR. Regenerate it instead — that is the whole point
 * of it being one command.
 *
 *     npm run build:standalone
 *
 * Output: dist-standalone/kodaman3d.html (stable path, overwritten in place, so
 * a tester can be sent "the same file" each time).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'dist-standalone');
const outFile = join(outDir, 'kodaman3d.html');

/** Everything Vite emitted, so we can prove nothing is left un-inlined. */
function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

console.log('› vite build (VITE_PLAYTEST=1 — debug surfaces start hidden)');
// VITE_PLAYTEST hides the lil-gui tuning panel, the stats.js meter and the state
// readout at startup. `Game.js` reads it; F1 still reveals all three, so a tester
// can be talked through showing them if we ever need a number out of them. The
// point is only that the first thing they see is the game, not an instrument
// panel they might start adjusting — feedback on a build nobody else has is
// worse than no feedback.
execFileSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_PLAYTEST: '1' },
});

const htmlPath = join(dist, 'index.html');
if (!existsSync(htmlPath)) throw new Error('vite build produced no dist/index.html');
let html = readFileSync(htmlPath, 'utf8');

// --- inline the one module script -------------------------------------------
const scriptRe = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
const scripts = [...html.matchAll(scriptRe)];
if (scripts.length !== 1) {
  throw new Error(
    `expected exactly 1 external <script>, found ${scripts.length}. ` +
      'The bundle was probably code-split; inline every chunk or disable splitting.',
  );
}
const [tag, src] = [scripts[0][0], scripts[0][1]];
const jsPath = join(dist, src.replace(/^\//, ''));

// Check for un-inlined references on the DOCUMENT SHELL, before the bundle goes
// in. Running it afterwards scans 600 kB of minified JavaScript too, where any
// `src="…"` inside a string literal reads as a false positive — which is exactly
// what happened the first time this ran.
const shellRefs = [...html.replace(tag, '').matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(data:|https?:|#|$)/.test(u));
let js = readFileSync(jsPath, 'utf8')
  // The .map does not travel with a single file; a dangling reference just makes
  // devtools noisy for whoever opens it.
  .replace(/\/\/# sourceMappingURL=.*$/m, '')
  .trimEnd();

// `</script>` anywhere inside the bundle would close our own tag early.
js = js.replaceAll('</script>', '<\\/script>');

// NOTE the replacer FUNCTION. `String.replace` with a string replacement expands
// `$&`, `$'`, `` $` `` and `$1`…`$99`, and minified bundles are full of `$`. A
// string replacement here would silently corrupt the JavaScript in a way that
// depends on what the minifier happened to emit — the worst kind of bug to chase.
// A function replacement disables that expansion entirely.
html = html.replace(tag, () => `<script type="module">\n${js}\n</script>`);

// --- drop preload hints ------------------------------------------------------
//
// Vite emits <link rel="modulepreload" href="/assets/…"> for the chunk it just
// bundled. Once that chunk is inlined the hint points at a file that will not
// travel with this HTML, so it is dead weight at best and a 404 at worst.
// (The guard below catches it if this is ever removed — that is how it was found.)
html = html.replace(/\s*<link\b[^>]*rel="(?:modulepreload|preload)"[^>]*>/g, '');

// --- inline any stylesheet ---------------------------------------------------
for (const m of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]) {
  const cssPath = join(dist, m[1].replace(/^\//, ''));
  html = html.replace(m[0], `<style>\n${readFileSync(cssPath, 'utf8')}\n</style>`);
}

// --- guard: nothing may still be referenced from outside the file ------------
//
// This is the check that catches the .glb case described at the top. It is
// deliberately a hard failure: a standalone build that quietly depends on a file
// it did not inline is worse than no standalone build, because it works
// perfectly on the machine that made it and breaks on the tester's.
// `shellRefs` was computed above, on the shell only. Stylesheets found since then
// have been inlined, so drop anything that is no longer present in the document.
const leftovers = shellRefs.filter((u) => html.includes(`="${u}"`));
if (leftovers.length) {
  throw new Error(
    `these would 404 on another machine — inline them as data: URIs first:\n  ${leftovers.join('\n  ')}`,
  );
}

const emitted = walk(dist).filter((f) => !/\.map$/.test(f.rel) && f.rel !== 'index.html' && f.rel !== '.gitkeep');
const notInlined = emitted.filter((f) => f.full !== jsPath);
if (notInlined.length) {
  console.warn(
    `! vite emitted files this script did not inline (harmless only if unused):\n  ${notInlined
      .map((f) => f.rel)
      .join('\n  ')}`,
  );
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html);

const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`\n✓ ${outFile}`);
console.log(`  ${mb} MB, self-contained — open it by double-click, no server needed.`);
