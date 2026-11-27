// Audio-Prüfung NEON REGENT (PLAN §9, R15): rendert jeden Klang der Klangbank offline als WAV nach tools/neonregent-test/out/audio/,
// prüft automatisch (kein NaN, Spitzenpegel vor Normalisierung 0.05-4, Länge plausibel) und dekodiert das Aufnahmen-Bundle.
// Die Session kann nicht hören: die WAVs gehören in den Bericht, das Urteil fällt der Nutzer.  Aufruf: node tools/neonregent-test/audio.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(), OUT = path.join(ROOT, 'tools/neonregent-test/out/audio');
fs.mkdirSync(OUT, { recursive: true });
// Takezahl je Kategorie laut assets/sound/raw (Dateinamen = <kategorie>_<sprecher>_<nr>)
const expect = {};
for (const f of fs.readdirSync(path.join(ROOT, 'assets/sound/raw'))) { const m = /^([a-z]+)_/.exec(f); if (m && /\.(flac|wav|ogg|mp3)$/.test(f)) expect[m[1]] = (expect[m[1]] || 0) + 1; }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); let bad = 0;
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html');
  await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 60000 });
  const st = await p.evaluate(() => NR_TEST.state());
  console.log('Klangbank:', st.bake.n, 'Varianten in', st.bake.ms.toFixed(0), 'ms (zuerst bereit nach', st.bake.firstMs.toFixed(0), 'ms), Fehler:', st.bake.fail.length);
  const got = await p.evaluate(() => Object.fromEntries(Object.keys(REC).map(c => [c, REC[c].length])));
  for (const c in expect) { const ok = got[c] === expect[c]; console.log('Aufnahmen', c.padEnd(9), got[c], '/', expect[c], ok ? 'ok' : 'FEHLT'); if (!ok) bad++; }
  for (const id of await p.evaluate(() => NR_TEST.ids())) {
    const r = await p.evaluate(i => NR_TEST.audioWav(i), id);
    fs.writeFileSync(path.join(OUT, id + '.wav'), Buffer.from(r.b64, 'base64'));
    const ok = !r.nan && r.rawPeak >= 0.05 && r.rawPeak <= 4 && r.seconds > 0.2 && r.seconds < 8;
    console.log(id.padEnd(22), r.seconds.toFixed(1) + ' s', 'Spitze ' + r.rawPeak.toFixed(2), 'RMS ' + r.rms.toFixed(3), ok ? 'ok' : 'FEHLER');
    if (!ok) bad++;
  }
  // Musik: je Track 6 Takte aus dem Volllast-Abschnitt (Takte 16-21) offline als WAV; Pegel, NaN, Länge
  const tracks = await p.evaluate(() => NR_TEST.musicTracks());
  for (let i = 0; i < tracks.length; i++) {
    const r = await p.evaluate(i => NR_TEST.musicWav(i, 16, 6), i);
    fs.writeFileSync(path.join(OUT, 'musik_' + (i + 1) + '_' + tracks[i] + '.wav'), Buffer.from(r.b64, 'base64'));
    const ok = !r.nan && r.rawPeak >= 0.1 && r.rawPeak <= 6 && r.seconds > 8;
    console.log(('musik_' + tracks[i]).padEnd(22), r.seconds.toFixed(1) + ' s', 'Spitze ' + r.rawPeak.toFixed(2), 'RMS ' + r.rms.toFixed(3), ok ? 'ok' : 'FEHLER'); if (!ok) bad++;
  }
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
