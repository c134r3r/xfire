#!/usr/bin/env python3
"""NEON REGENT - Aufnahmen (Schreie, Stöhnen, Rufe) zu einem Sound-Bundle packen.

  assets/sound/raw/<kategorie>_<sprecher>_<nr>.(wav|flac|ogg|mp3)   Rohaufnahmen, ein Take pro Datei
  assets/sound/QUELLEN.md                                            Herkunft + Lizenz je Datei (Pflicht)
  ->  assets/sound/neonregent.sound.js                               window.NEONREGENT_SOUNDS (Base64-MP3)

Das Bundle ist eine normale <script>-Datei mit Data-URIs - wie die Sprite-Bundles läuft es
auch von file:// (fetch/XHR auf lokale Dateien würde dort scheitern). MP3 statt OGG, weil
Safari/iOS OGG nicht zuverlässig dekodiert.

Verarbeitung je Datei: Mono, 44.1 kHz, Stille vorne/hinten abschneiden, Lautheit angleichen
(RMS-Ziel je Kategorie, Spitze höchstens -1 dBFS), 5 ms Ein- / 20 ms Ausblendung, MP3.

Lizenzsperre: Jede Datei braucht eine Zeile in QUELLEN.md, Lizenz CC0, Public Domain,
eigene Aufnahme (mit Einverständnis der Person) oder synthetisch. Sonst bricht das Skript ab -
so landet nie eine Datei mit unklarer Lizenz im öffentlichen Repo.

  pip install numpy soundfile soxr lameenc
  python3 tools/sound-packer/pack.py                      # Standardpfade (siehe oben)
  python3 tools/sound-packer/pack.py --raw DIR --quellen FILE --out FILE --kbps 96
"""
import argparse
import base64
import json
import os
import re
import sys

import lameenc
import numpy as np
import soundfile as sf
import soxr

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SR = 44100
# RMS-Ziel (dBFS, gemessen über die lauten Teile) je Kategorie: Schreie laut, Stöhnen leiser
CATS = {'angst': -14, 'treffer': -15, 'schmerz': -15, 'brennen': -14, 'ruf': -16,
        'stoehnen': -20, 'keuchen': -22, 'spieler': -17}
LICENSES = ('cc0', 'public domain', 'eigene aufnahme', 'synthetisch')
NAME = re.compile(r'^([a-z]+)_([a-z0-9]+)_([a-z0-9]+)\.(wav|flac|ogg|mp3)$')


def read_sources(path):
    """Markdown-Tabelle in QUELLEN.md: | Datei | Urheber | Lizenz | Quelle (URL) | Datum |"""
    out = {}
    if not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) >= 3 and NAME.match(cells[0]):
            out[cells[0]] = {'urheber': cells[1], 'lizenz': cells[2], 'quelle': cells[3] if len(cells) > 3 else ''}
    return out


def process(path, cat):
    x, sr = sf.read(path, always_2d=True, dtype='float32')
    x = x.mean(axis=1)
    if sr != SR:
        x = soxr.resample(x, sr, SR).astype('float32')
    peak = float(np.max(np.abs(x)))
    if peak < 1e-4:
        raise ValueError('nur Stille')
    # Stille abschneiden: 10-ms-Hüllkurve unter -40 dB relativ zur Spitze
    win = int(SR * 0.01)
    env = np.sqrt(np.convolve(x * x, np.ones(win) / win, mode='same'))
    on = np.where(env > peak * 10 ** (-40 / 20))[0]
    a, b = max(0, on[0] - int(0.015 * SR)), min(len(x), on[-1] + int(0.06 * SR))
    x = x[a:b].copy()
    if len(x) < 0.12 * SR:
        raise ValueError(f'zu kurz nach dem Zuschneiden ({len(x) / SR:.2f} s) - Take kaputt oder fast nur Stille?')
    # Lautheit angleichen, ohne die Spitze über -1 dBFS zu heben
    loud = x[np.abs(x) > peak * 0.05]
    rms = float(np.sqrt(np.mean(loud ** 2))) if len(loud) else 1e-4
    g = min(10 ** (CATS[cat] / 20) / rms, 10 ** (-1 / 20) / float(np.max(np.abs(x))))
    x *= g
    fi, fo = int(0.005 * SR), int(0.02 * SR)
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo)
    return x, g


def to_mp3(x, kbps):
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    return bytes(enc.encode(pcm) + enc.flush())


def show(path):
    p = os.path.abspath(path)
    return os.path.relpath(p, ROOT) if p.startswith(ROOT + os.sep) else p


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--raw', default=os.path.join(ROOT, 'assets/sound/raw'))
    ap.add_argument('--quellen', default=os.path.join(ROOT, 'assets/sound/QUELLEN.md'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets/sound/neonregent.sound.js'))
    ap.add_argument('--kbps', type=int, default=96)
    args = ap.parse_args()

    sources = read_sources(args.quellen)
    items, errors = [], []
    for fn in sorted(os.listdir(args.raw)):
        if fn.startswith('.') or fn.lower().endswith(('.md', '.txt')):
            continue
        m = NAME.match(fn)
        if not m:
            errors.append(f'{fn}: Dateiname passt nicht zu <kategorie>_<sprecher>_<nr>.wav')
            continue
        cat, speaker, nr = m.group(1), m.group(2), m.group(3)
        if cat not in CATS:
            errors.append(f'{fn}: unbekannte Kategorie "{cat}" (erlaubt: {", ".join(CATS)})')
            continue
        src = sources.get(fn)
        if not src:
            errors.append(f'{fn}: fehlt in {show(args.quellen)}')
            continue
        if not src['lizenz'].lower().startswith(LICENSES):
            errors.append(f'{fn}: Lizenz "{src["lizenz"]}" nicht erlaubt (nur CC0, Public Domain, eigene Aufnahme)')
            continue
        try:
            x, g = process(os.path.join(args.raw, fn), cat)
        except Exception as e:  # defekte Datei: melden statt still überspringen
            errors.append(f'{fn}: {e}')
            continue
        data = to_mp3(x, args.kbps)
        items.append({'file': fn, 'cat': cat, 'speaker': speaker, 'n': nr, 'dur': round(len(x) / SR, 3),
                      'gainDb': round(20 * float(np.log10(g)), 1), 'bytes': len(data),
                      'data': 'data:audio/mpeg;base64,' + base64.b64encode(data).decode()})
    if errors:
        print('FEHLER - nichts geschrieben:')
        for e in errors:
            print('  ' + e)
        sys.exit(1)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write('// Generiert von tools/sound-packer/pack.py - nicht von Hand ändern\n')
        f.write('window.NEONREGENT_SOUNDS = ' + json.dumps({'version': 1, 'items': items}) + ';\n')
    per = {}
    for it in items:
        per.setdefault(it['cat'], set()).add(it['speaker'])
    print(f'{len(items)} Aufnahmen -> {show(args.out)} ({os.path.getsize(args.out) / 1e6:.2f} MB)')
    for cat in CATS:
        n = sum(1 for it in items if it['cat'] == cat)
        if n:
            print(f'  {cat:9s} {n:3d} Takes, Sprecher: {", ".join(sorted(per[cat]))}')


if __name__ == '__main__':
    main()
