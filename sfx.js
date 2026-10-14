// ============================================
// XFire - Sound design (SFX, radio voices, ambience, announcer)
//
// Every sound is synthesized ONCE at load into AudioBuffers with an
// OfflineAudioContext, from layered physical recipes:
//   gunshot  = supersonic crack + muzzle body + low thump + rolling tail
//              + action click
//   cannon   = crack + sub boom + blast body + breech clank + long rumble
//   explosion= crack + sub boom + fireball roar + debris rattle + rumble
// Each sound has several randomized variants (round-robin) so a firing
// line never sounds like a loop. Playback is positional: stereo pan by
// screen position, distance falloff with air absorption (far = muffled),
// a shared outdoor reverb, per-sound voice limits and a master
// compressor so big battles stay punchy instead of clipping.
// ============================================

const SR = 44100;

// ---------- tiny synthesis DSL for offline recipes ----------
function makeRng(seed) {
    let s = seed | 0 || 1;
    return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

class Rec {
    constructor(oc, rnd) {
        this.oc = oc;
        this.rnd = rnd;
        this.out = oc.createGain();
        this.out.connect(oc.destination);
    }
    r(a, b) { return a + (b - a) * this.rnd(); }

    noiseBuf(dur, color = 'white') {
        const len = Math.max(1, Math.ceil(dur * SR));
        const b = this.oc.createBuffer(1, len, SR);
        const d = b.getChannelData(0);
        let last = 0, b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
            const w = this.rnd() * 2 - 1;
            if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
            else if (color === 'pink') {
                b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
                d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
            } else d[i] = w;
        }
        return b;
    }
    noise(dur, color, t = 0) {
        const s = this.oc.createBufferSource();
        s.buffer = this.noiseBuf(dur, color);
        s.start(t);
        return s;
    }
    osc(type, f0, f1, t0, t1, curve = 'exp') {
        const o = this.oc.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        if (f1 !== undefined && f1 !== f0) {
            if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t1);
            else o.frequency.linearRampToValueAtTime(f1, t1);
        }
        o.start(t0);
        o.stop(t1 + 0.05);
        return o;
    }
    filt(type, f, Q = 0.7, f1, t0 = 0, t1 = 0) {
        const b = this.oc.createBiquadFilter();
        b.type = type;
        b.frequency.setValueAtTime(f, t0);
        b.Q.value = Q;
        if (f1 !== undefined) b.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t1);
        return b;
    }
    // envelope points: [time, value] (exponential decays, linear attacks)
    env(points) {
        const g = this.oc.createGain();
        const p = g.gain;
        p.setValueAtTime(0.00001, 0);
        let prev = 0;
        for (const [t, v] of points) {
            const val = Math.max(0.00001, v);
            if (val >= prev) p.linearRampToValueAtTime(val, t);
            else p.exponentialRampToValueAtTime(val, t);
            prev = val;
        }
        return g;
    }
    shaper(amount = 2) {
        const ws = this.oc.createWaveShaper();
        const n = 1024, c = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); }
        ws.curve = c;
        return ws;
    }
    chain(...nodes) {
        for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
        return nodes[nodes.length - 1];
    }
    // layer = source -> filters... -> envelope -> bus
    layer(src, filters, envPts, dest) {
        const e = this.env(envPts);
        this.chain(src, ...filters, e, dest || this.out);
        return e;
    }
    // inharmonic metallic ring (clanks, pings, breech, bells)
    ring(t, base, partials, decay, vol, dest) {
        for (const [ratio, amp] of partials) {
            const o = this.osc('sine', base * ratio, base * ratio * 0.995, t, t + decay * 1.5);
            this.layer(o, [], [[t, 0], [t + 0.002, vol * amp], [t + decay * (1 / Math.sqrt(ratio)), 0.0001]], dest);
        }
    }
    // random short clicks: debris, gravel, crackle
    clicks(t0, t1, n, fLo, fHi, vol, dest) {
        for (let i = 0; i < n; i++) {
            const t = this.r(t0, t1);
            const s = this.noise(0.03, 'white', t);
            const f = this.filt('bandpass', this.r(fLo, fHi), this.r(2, 6));
            const v = vol * this.r(0.3, 1) * (1 - (t - t0) / (t1 - t0 + 0.001) * 0.6);
            this.layer(s, [f], [[t, 0], [t + 0.001, v], [t + this.r(0.008, 0.03), 0.0001]], dest);
        }
    }
    // a voiced syllable through formant filters (radio voices, grunts)
    syllable(t, dur, f0a, f0b, formants, vol, dest, rough = 0) {
        const src = this.osc('sawtooth', f0a, f0b, t, t + dur, 'lin');
        const bus = this.oc.createGain();
        bus.gain.value = 1;
        src.connect(bus);
        if (rough > 0) {
            const n = this.noise(dur + 0.05, 'white', t);
            const ng = this.oc.createGain(); ng.gain.value = rough;
            n.connect(ng); ng.connect(bus);
        }
        const e = this.env([[t, 0], [t + dur * 0.15, vol], [t + dur * 0.7, vol * 0.8], [t + dur, 0.0001]]);
        for (const [f, q, a] of formants) {
            const bp = this.filt('bandpass', f, q);
            const g = this.oc.createGain(); g.gain.value = a;
            bus.connect(bp); bp.connect(g); g.connect(e);
        }
        e.connect(dest || this.out);
    }
}

const VOWELS = [
    [[730, 8, 1], [1090, 10, 0.6], [2440, 12, 0.25]],   // a
    [[270, 8, 1], [2290, 12, 0.5], [3010, 14, 0.2]],    // i
    [[300, 8, 1], [870, 10, 0.5], [2240, 12, 0.2]],     // u
    [[530, 8, 1], [1840, 10, 0.55], [2480, 12, 0.2]],   // e
    [[570, 8, 1], [840, 10, 0.6], [2410, 12, 0.2]],     // o
    [[660, 8, 1], [1720, 10, 0.5], [2410, 12, 0.22]]    // ae
];

// ---------- recipes ----------
// Each returns its duration; draws into r.out (mono).
const RECIPES = {
    // --- small arms ---
    gun_rifle(r) {
        const t = 0;
        r.layer(r.noise(0.02), [r.filt('highpass', 2600)], [[t, 0], [t + 0.0006, 1.0], [t + 0.012, 0.0001]]);
        r.layer(r.noise(0.12), [r.filt('bandpass', r.r(800, 1200), 1.2)], [[t, 0], [t + 0.002, 0.8], [t + r.r(0.06, 0.09), 0.0001]]);
        r.layer(r.osc('sine', r.r(150, 175), 50, t, t + 0.06), [], [[t, 0], [t + 0.002, 0.8], [t + 0.07, 0.0001]]);
        r.layer(r.noise(0.5, 'brown'), [r.filt('lowpass', r.r(600, 900))], [[t, 0], [t + 0.012, 0.35], [t + r.r(0.3, 0.45), 0.0001]]);
        r.layer(r.noise(0.01, 'white', 0.035), [r.filt('bandpass', 3200, 4)], [[0.035, 0], [0.036, 0.08], [0.045, 0.0001]]);
        return 0.5;
    },
    gun_hmg(r) {
        const t = 0;
        r.layer(r.noise(0.02), [r.filt('highpass', 2000)], [[t, 0], [t + 0.0006, 1.0], [t + 0.015, 0.0001]]);
        r.layer(r.noise(0.16), [r.filt('bandpass', r.r(500, 750), 1)], [[t, 0], [t + 0.003, 0.9], [t + r.r(0.1, 0.13), 0.0001]]);
        r.layer(r.osc('sine', r.r(110, 130), 42, t, t + 0.09), [], [[t, 0], [t + 0.003, 1.0], [t + 0.1, 0.0001]]);
        r.layer(r.noise(0.7, 'brown'), [r.filt('lowpass', r.r(500, 700))], [[t, 0], [t + 0.015, 0.45], [t + r.r(0.45, 0.6), 0.0001]]);
        r.ring(0.05, r.r(2400, 2900), [[1, 0.5], [2.7, 0.3]], 0.04, 0.05);
        return 0.7;
    },
    // Series 9 small arms: arc-discharge snap with an electric whine
    gun_zap(r) {
        r.layer(r.noise(0.03), [r.filt('highpass', 3000)], [[0, 0], [0.0008, 0.7], [0.02, 0.0001]]);
        const sh = r.shaper(4);
        r.layer(r.osc('sawtooth', r.r(1900, 2400), 260, 0, 0.13), [r.filt('lowpass', 4000), sh], [[0, 0], [0.003, 0.35], [0.14, 0.0001]]);
        r.layer(r.noise(0.18), [r.filt('bandpass', 2500, 2, 600, 0, 0.15)], [[0, 0], [0.002, 0.6], [0.16, 0.0001]]);
        r.clicks(0.01, 0.12, 8, 2000, 6000, 0.25);
        r.layer(r.noise(0.35, 'brown'), [r.filt('lowpass', 500)], [[0, 0], [0.01, 0.2], [0.3, 0.0001]]);
        return 0.4;
    },

    // --- heavy guns ---
    cannon(r) {
        r.layer(r.noise(0.03), [r.filt('highpass', 1800)], [[0, 0], [0.0008, 1.0], [0.025, 0.0001]]);
        r.layer(r.osc('sine', r.r(68, 80), 30, 0, 0.4), [], [[0, 0], [0.004, 1.0], [0.42, 0.0001]]);
        r.layer(r.noise(0.7), [r.filt('lowpass', 2200, 0.7, 220, 0, 0.6)], [[0, 0], [0.004, 0.9], [r.r(0.5, 0.65), 0.0001]]);
        r.layer(r.noise(1.8, 'brown'), [r.filt('lowpass', 380)], [[0, 0], [0.03, 0.7], [r.r(1.4, 1.7), 0.0001]]);
        // breech / shell ejection clank
        r.ring(r.r(0.28, 0.36), r.r(380, 450), [[1, 0.6], [2.76, 0.4], [5.4, 0.2]], 0.25, 0.09);
        return 1.8;
    },
    // Series 9 plasma cannon: deep electric thrum and crackle
    plasma(r) {
        const sh = r.shaper(3);
        const o1 = r.osc('sawtooth', 58, 36, 0, 0.6), o2 = r.osc('sawtooth', 61.5, 38, 0, 0.6);
        const bus = r.oc.createGain(); o1.connect(bus); o2.connect(bus);
        r.layer(bus, [r.filt('lowpass', 3200, 2, 180, 0, 0.5), sh], [[0, 0], [0.005, 0.9], [0.6, 0.0001]]);
        r.layer(r.noise(0.05), [r.filt('highpass', 2500)], [[0, 0], [0.001, 0.8], [0.03, 0.0001]]);
        r.layer(r.osc('sine', 1800, 120, 0, 0.35), [], [[0, 0], [0.002, 0.25], [0.35, 0.0001]]);
        r.clicks(0.02, 0.35, 16, 1500, 7000, 0.3);
        r.layer(r.noise(1.2, 'brown'), [r.filt('lowpass', 300)], [[0, 0], [0.02, 0.5], [1.0, 0.0001]]);
        return 1.2;
    },
    artillery(r) {
        r.layer(r.noise(0.04), [r.filt('highpass', 1500)], [[0, 0], [0.001, 1.0], [0.03, 0.0001]]);
        r.layer(r.osc('sine', r.r(52, 60), 22, 0, 0.6), [], [[0, 0], [0.006, 1.0], [0.65, 0.0001]]);
        r.layer(r.noise(1.0), [r.filt('lowpass', 1800, 0.7, 160, 0, 0.9)], [[0, 0], [0.005, 1.0], [0.9, 0.0001]]);
        r.layer(r.noise(3.0, 'brown'), [r.filt('lowpass', 300)], [[0, 0], [0.05, 0.85], [r.r(2.4, 2.9), 0.0001]]);
        r.ring(0.5, r.r(300, 340), [[1, 0.5], [2.76, 0.35]], 0.35, 0.08);
        return 3.0;
    },
    // incoming shell: falling whistle, played before the impact
    shell_whistle(r) {
        const dur = 1.0;
        const o = r.osc('sine', r.r(2300, 2700), r.r(650, 800), 0, dur, 'exp');
        const vib = r.oc.createOscillator(); vib.frequency.value = r.r(5, 8);
        const vg = r.oc.createGain(); vg.gain.value = 18; vib.connect(vg); vg.connect(o.frequency); vib.start(0); vib.stop(dur);
        r.layer(o, [], [[0, 0], [0.4, 0.18], [dur * 0.95, 0.3], [dur, 0.0001]]);
        r.layer(r.noise(dur), [r.filt('bandpass', 2400, 3, 800, 0, dur)], [[0, 0], [0.5, 0.06], [dur, 0.0001]]);
        return dur;
    },
    rocket(r) {
        r.layer(r.noise(0.05), [r.filt('lowpass', 2500)], [[0, 0], [0.001, 0.8], [0.04, 0.0001]]);
        r.layer(r.osc('sine', 120, 50, 0, 0.1), [], [[0, 0], [0.003, 0.6], [0.1, 0.0001]]);
        r.layer(r.noise(1.4), [r.filt('bandpass', 500, 1.2, 2600, 0.02, 0.45)], [[0, 0], [0.06, 0.7], [0.35, 0.45], [r.r(1.1, 1.3), 0.0001]]);
        r.layer(r.noise(1.2, 'pink'), [r.filt('highpass', 3000)], [[0, 0], [0.08, 0.15], [1.1, 0.0001]]);
        return 1.4;
    },
    flame(r) {
        const dur = r.r(0.6, 0.75);
        r.layer(r.noise(dur, 'pink'), [r.filt('lowpass', 1100, 0.7)], [[0, 0], [0.04, 0.9], [dur * 0.6, 0.7], [dur, 0.0001]]);
        r.layer(r.noise(dur, 'brown'), [r.filt('lowpass', 250)], [[0, 0], [0.05, 0.8], [dur, 0.0001]]);
        r.layer(r.noise(0.08), [r.filt('bandpass', 1500, 1)], [[0, 0], [0.005, 0.5], [0.07, 0.0001]]);   // igniter pop
        r.clicks(0.03, dur, 22, 1500, 5000, 0.35);
        return dur + 0.05;
    },

    // --- explosions ---
    explosion_small(r) {
        r.layer(r.noise(0.04), [r.filt('highpass', 1500)], [[0, 0], [0.001, 1.0], [0.03, 0.0001]]);
        r.layer(r.osc('sine', r.r(85, 100), 28, 0, 0.5), [], [[0, 0], [0.005, 1.0], [0.5, 0.0001]]);
        r.layer(r.noise(0.9), [r.filt('lowpass', 4000, 0.7, 250, 0, 0.7)], [[0, 0], [0.006, 0.9], [r.r(0.6, 0.8), 0.0001]]);
        r.clicks(0.12, 0.9, Math.round(r.r(10, 18)), 1200, 4500, 0.35);
        r.layer(r.noise(1.6, 'brown'), [r.filt('lowpass', 320)], [[0, 0], [0.04, 0.75], [r.r(1.2, 1.5), 0.0001]]);
        return 1.7;
    },
    explosion_large(r) {
        r.layer(r.noise(0.05), [r.filt('highpass', 1200)], [[0, 0], [0.001, 1.0], [0.04, 0.0001]]);
        r.layer(r.osc('sine', r.r(62, 72), 18, 0, 0.9), [], [[0, 0], [0.008, 1.0], [0.9, 0.0001]]);
        r.layer(r.noise(1.5), [r.filt('lowpass', 3500, 0.7, 180, 0, 1.2)], [[0, 0], [0.008, 1.0], [1.3, 0.0001]]);
        // secondary detonation (fuel / ammo cook-off)
        const t2 = r.r(0.18, 0.35);
        r.layer(r.osc('sine', 75, 25, t2, t2 + 0.5), [], [[t2, 0], [t2 + 0.006, 0.6], [t2 + 0.5, 0.0001]]);
        r.layer(r.noise(0.8, 'white', t2), [r.filt('lowpass', 2500, 0.7, 200, t2, t2 + 0.6)], [[t2, 0], [t2 + 0.005, 0.5], [t2 + 0.6, 0.0001]]);
        r.clicks(0.2, 1.8, Math.round(r.r(24, 36)), 900, 4500, 0.4);
        r.layer(r.noise(3.2, 'brown'), [r.filt('lowpass', 260)], [[0, 0], [0.06, 0.95], [r.r(2.6, 3.0), 0.0001]]);
        return 3.2;
    },
    building_collapse(r) {
        RECIPES.explosion_large(r);
        // grinding collapse: rumbling, amplitude-wobbling low noise
        const n = r.noise(3.5, 'brown', 0.3);
        const lfo = r.oc.createOscillator(); lfo.frequency.value = r.r(5, 9);
        const lg = r.oc.createGain(); lg.gain.value = 0.35;
        const g = r.oc.createGain(); g.gain.value = 0.6;
        lfo.connect(lg); lg.connect(g.gain); lfo.start(0.3); lfo.stop(3.8);
        r.chain(n, r.filt('lowpass', 420), g);
        const e = r.env([[0.3, 0], [0.8, 0.8], [2.0, 0.5], [3.8, 0.0001]]);
        g.connect(e); e.connect(r.out);
        r.clicks(0.8, 3.5, 40, 600, 3500, 0.3);
        r.ring(r.r(1.0, 1.6), r.r(180, 260), [[1, 0.5], [2.3, 0.3], [4.1, 0.2]], 0.6, 0.12);
        return 4.0;
    },

    // --- impacts ---
    impact_metal(r) {
        r.layer(r.noise(0.01), [r.filt('highpass', 3000)], [[0, 0], [0.0005, 0.6], [0.006, 0.0001]]);
        r.ring(0, r.r(1600, 3200), [[1, 0.6], [2.76, 0.35], [5.4, 0.18]], r.r(0.05, 0.12), 0.35);
        return 0.25;
    },
    impact_dirt(r) {
        r.layer(r.noise(0.06), [r.filt('lowpass', r.r(500, 900))], [[0, 0], [0.002, 0.8], [0.05, 0.0001]]);
        r.layer(r.osc('sine', r.r(110, 140), 60, 0, 0.05), [], [[0, 0], [0.002, 0.4], [0.05, 0.0001]]);
        r.clicks(0.01, 0.12, 5, 1500, 4000, 0.15);   // sprayed gravel
        return 0.18;
    },
    impact_flesh(r) {
        r.layer(r.noise(0.06), [r.filt('lowpass', r.r(700, 1000))], [[0, 0], [0.003, 0.7], [0.045, 0.0001]]);
        r.layer(r.osc('sine', r.r(85, 100), 55, 0, 0.06), [], [[0, 0], [0.003, 0.5], [0.06, 0.0001]]);
        return 0.12;
    },
    ricochet(r) {
        const dur = r.r(0.25, 0.4);
        const o = r.osc('sine', r.r(2600, 3400), r.r(1100, 1500), 0, dur, 'exp');
        const vib = r.oc.createOscillator(); vib.frequency.value = r.r(18, 30);
        const vg = r.oc.createGain(); vg.gain.value = 60; vib.connect(vg); vg.connect(o.frequency); vib.start(0); vib.stop(dur);
        r.layer(o, [], [[0, 0], [0.01, 0.22], [dur, 0.0001]]);
        r.layer(r.noise(0.01), [r.filt('highpass', 4000)], [[0, 0], [0.0005, 0.5], [0.006, 0.0001]]);
        return dur;
    },

    // --- deaths ---
    death_human(r) {
        // pained cry: falling-pitch voice through vowel formants
        const dur = r.r(0.3, 0.5);
        const f0 = r.r(170, 260);
        const v = VOWELS[[0, 5, 4][(r.rnd() * 3) | 0]];
        r.syllable(0, dur, f0, f0 * r.r(0.55, 0.7), v, 0.45, r.out, 0.4);
        r.layer(r.noise(0.08), [r.filt('lowpass', 900)], [[0, 0], [0.003, 0.5], [0.07, 0.0001]]);
        return dur + 0.05;
    },
    death_beast(r) {
        const dur = r.r(0.45, 0.65);
        const f0 = r.r(85, 120);
        const sh = r.shaper(3);
        const bus = r.oc.createGain();
        r.syllable(0, dur, f0 * 1.3, f0 * 0.6, VOWELS[4], 0.5, bus, 1.2);
        r.chain(bus, sh, r.out);
        return dur + 0.05;
    },
    death_robot(r) {
        // power-down: falling servo whine + short-circuit crackle
        const sh = r.shaper(5);
        r.layer(r.osc('square', r.r(700, 900), 60, 0, 0.5), [r.filt('lowpass', 2000), sh], [[0, 0], [0.005, 0.25], [0.5, 0.0001]]);
        r.clicks(0, 0.4, 14, 2000, 7000, 0.35);
        r.layer(r.noise(0.04), [r.filt('bandpass', 1500, 2)], [[0, 0], [0.001, 0.6], [0.03, 0.0001]]);
        return 0.55;
    },

    // --- UI / feedback ---
    ui_click(r) {
        // mechanical switch: press + release
        for (const [t, f, v] of [[0, 3200, 0.5], [0.035, 2400, 0.3]]) {
            r.layer(r.noise(0.02, 'white', t), [r.filt('bandpass', f, 3)], [[t, 0], [t + 0.0005, v], [t + 0.012, 0.0001]]);
        }
        return 0.08;
    },
    radio_squelch(r) {
        // push-to-talk key up / down
        r.layer(r.noise(0.01), [r.filt('bandpass', 2500, 2)], [[0, 0], [0.0005, 0.35], [0.006, 0.0001]]);
        r.layer(r.noise(0.09), [r.filt('bandpass', 2000, 1.2)], [[0, 0], [0.004, 0.18], [0.08, 0.0001]]);
        return 0.1;
    },
    ack_move(r) { return RECIPES.radio_squelch(r); },
    ack_attack(r) {
        RECIPES.radio_squelch(r);
        r.layer(r.noise(0.012, 'white', 0.04), [r.filt('bandpass', 1800, 3)], [[0.04, 0], [0.0405, 0.4], [0.05, 0.0001]]);
        return 0.12;
    },
    unit_select(r) {
        r.layer(r.noise(0.01), [r.filt('bandpass', 3000, 3)], [[0, 0], [0.0005, 0.3], [0.006, 0.0001]]);
        r.layer(r.osc('sine', 1180, 1180, 0.01, 0.07), [r.filt('bandpass', 1200, 2)], [[0.01, 0], [0.015, 0.12], [0.07, 0.0001]]);
        return 0.09;
    },
    ui_build(r) {
        // heavy placement: dropped load + hydraulic hiss + clank
        r.layer(r.osc('sine', 90, 45, 0, 0.15), [], [[0, 0], [0.003, 0.8], [0.15, 0.0001]]);
        r.layer(r.noise(0.2, 'brown'), [r.filt('lowpass', 500)], [[0, 0], [0.004, 0.6], [0.18, 0.0001]]);
        r.layer(r.noise(0.6, 'white', 0.08), [r.filt('highpass', 2500)], [[0.08, 0], [0.15, 0.08], [0.6, 0.0001]]);
        r.ring(0.05, 420, [[1, 0.5], [2.76, 0.3]], 0.2, 0.12);
        return 0.7;
    },
    construction_complete(r) {
        r.ring(0, 330, [[1, 0.6], [2.76, 0.35], [5.4, 0.2]], 0.35, 0.18);
        r.layer(r.noise(0.5, 'white', 0.05), [r.filt('highpass', 2200)], [[0.05, 0], [0.1, 0.07], [0.5, 0.0001]]);
        for (const [t, f] of [[0.18, 660], [0.34, 880]]) {
            r.layer(r.osc('sine', f, f, t, t + 0.4), [], [[t, 0], [t + 0.01, 0.14], [t + 0.4, 0.0001]]);
        }
        return 0.9;
    },
    unit_ready(r) {
        RECIPES.radio_squelch(r);
        r.layer(r.osc('sine', 1000, 1000, 0.08, 0.2), [r.filt('bandpass', 1000, 2)], [[0.08, 0], [0.09, 0.16], [0.2, 0.0001]]);
        return 0.3;
    },
    research_complete(r) {
        [523, 659, 784].forEach((f, i) => {
            const t = i * 0.13;
            r.ring(t, f, [[1, 0.6], [2.0, 0.15], [3.01, 0.08]], 0.8, 0.12);
        });
        return 1.4;
    },
    bonus(r) {
        [880, 1109, 1319, 1760].forEach((f, i) => r.ring(i * 0.08, f, [[1, 0.6], [2.76, 0.2]], 0.5, 0.1));
        return 1.0;
    },
    alert(r) {
        // military klaxon: two alternating rasping tones
        const sh = r.shaper(3);
        const bus = r.oc.createGain();
        r.chain(bus, r.filt('lowpass', 2200), sh, r.out);
        for (let i = 0; i < 4; i++) {
            const t = i * 0.28, f = i % 2 ? 330 : 415;
            const o1 = r.osc('sawtooth', f, f, t, t + 0.26), o2 = r.osc('square', f * 1.005, f * 1.005, t, t + 0.26);
            const g = r.env([[t, 0], [t + 0.02, 0.2], [t + 0.24, 0.18], [t + 0.26, 0.0001]]);
            o1.connect(g); o2.connect(g); g.connect(bus);
        }
        return 1.2;
    },
    warn(r) {
        for (const [t, f] of [[0, 740], [0.16, 554]]) {
            r.layer(r.osc('square', f, f, t, t + 0.13), [r.filt('lowpass', 2000)], [[t, 0], [t + 0.005, 0.12], [t + 0.12, 0.08], [t + 0.13, 0.0001]]);
        }
        return 0.32;
    },
    denied(r) {
        r.layer(r.osc('sawtooth', 120, 118, 0, 0.2), [r.filt('lowpass', 700)], [[0, 0], [0.01, 0.25], [0.17, 0.2], [0.2, 0.0001]]);
        r.layer(r.osc('sawtooth', 123, 121, 0, 0.2), [r.filt('lowpass', 700)], [[0, 0], [0.01, 0.15], [0.2, 0.0001]]);
        return 0.22;
    },
    // brass-like fanfares (detuned saws, slow filter swell)
    victory(r) {
        const notes = [[0, 392, 0.22], [0.22, 523, 0.22], [0.44, 659, 0.22], [0.66, 784, 1.4]];
        for (const [t, f, d] of notes) for (const det of [0.997, 1.0, 1.004]) {
            r.layer(r.osc('sawtooth', f * det, f * det, t, t + d), [r.filt('lowpass', 400, 1, 2200, t, t + 0.12)], [[t, 0], [t + 0.04, 0.07], [t + d * 0.8, 0.06], [t + d, 0.0001]]);
        }
        return 2.2;
    },
    defeat(r) {
        const notes = [[0, 392, 0.35], [0.35, 349, 0.35], [0.7, 311, 0.35], [1.05, 262, 1.6]];
        for (const [t, f, d] of notes) for (const det of [0.996, 1.0, 1.005]) {
            r.layer(r.osc('sawtooth', f * det, f * det, t, t + d), [r.filt('lowpass', 300, 1, 1200, t, t + 0.2)], [[t, 0], [t + 0.06, 0.07], [t + d * 0.8, 0.05], [t + d, 0.0001]]);
        }
        return 2.8;
    },

    // --- radio voices (wordless but speech-like, through a field radio) ---
    voice_survivors(r) { return radioVoice(r, r.r(105, 150), 0.15, false); },
    voice_evolved(r) { return radioVoice(r, r.r(70, 95), 1.1, true); },
    voice_series9(r) {
        // vocoded machine speech: monotone buzz, hard formant switching, data chirps
        const sh = r.shaper(6);
        const radio = r.oc.createGain();
        r.chain(radio, r.filt('highpass', 350), r.filt('lowpass', 3200), sh, r.out);
        let t = 0.06;
        const n = 3 + ((r.rnd() * 4) | 0);
        for (let i = 0; i < n; i++) {
            const d = r.r(0.06, 0.12);
            const src = r.osc('square', 140, 140, t, t + d);
            const v = VOWELS[(r.rnd() * VOWELS.length) | 0];
            const e = r.env([[t, 0], [t + 0.005, 0.3], [t + d - 0.005, 0.3], [t + d, 0.0001]]);
            for (const [f, q, a] of v) { const bp = r.filt('bandpass', f, q * 1.5); const g = r.oc.createGain(); g.gain.value = a; src.connect(bp); bp.connect(g); g.connect(e); }
            e.connect(radio);
            t += d + r.r(0.01, 0.04);
        }
        for (let i = 0; i < 3; i++) r.layer(r.osc('sine', r.r(1800, 2600), r.r(1800, 2600), t + i * 0.05, t + i * 0.05 + 0.04), [], [[t + i * 0.05, 0], [t + i * 0.05 + 0.003, 0.08], [t + i * 0.05 + 0.04, 0.0001]]);
        return t + 0.2;
    },

    // looping ambience: desert wind (crossfaded seamlessly by the player)
    wind(r) {
        const dur = 10;
        const n = r.noise(dur, 'pink');
        const f = r.oc.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 0.8;
        // slow gusts: random walk on cutoff and level
        let fc = 500, lv = 0.5;
        f.frequency.setValueAtTime(fc, 0);
        const g = r.oc.createGain();
        g.gain.setValueAtTime(lv, 0);
        for (let t = 0.5; t <= dur; t += 0.5) {
            fc = Math.max(250, Math.min(1400, fc + r.r(-160, 160)));
            lv = Math.max(0.25, Math.min(1, lv + r.r(-0.18, 0.18)));
            f.frequency.linearRampToValueAtTime(fc, t);
            g.gain.linearRampToValueAtTime(lv, t);
        }
        const low = r.noise(dur, 'brown');
        const lg = r.oc.createGain(); lg.gain.value = 0.5;
        r.chain(low, r.filt('lowpass', 160), lg, r.out);
        r.chain(n, f, g, r.out);
        return dur;
    }
};

// Human / beast radio chatter: squelch, 3-6 formant syllables with
// consonant noise, band-limited and overdriven like a field radio
function radioVoice(r, f0, rough, beast) {
    const sh = r.shaper(beast ? 3.5 : 2.5);
    const radio = r.oc.createGain();
    radio.gain.value = 1.2;
    r.chain(radio, r.filt('highpass', beast ? 220 : 380), r.filt('lowpass', beast ? 2400 : 2900), sh, r.out);
    // background hiss while the channel is open
    let t = 0.07;
    const n = 3 + ((r.rnd() * 4) | 0);
    const syl = [];
    for (let i = 0; i < n; i++) {
        const d = r.r(0.07, 0.16);
        syl.push([t, d]);
        t += d + r.r(0.01, 0.06);
    }
    const total = t + 0.06;
    r.layer(r.noise(total + 0.1), [r.filt('bandpass', 2200, 0.6)], [[0, 0], [0.01, 0.05], [total, 0.04], [total + 0.1, 0.0001]], radio);
    r.layer(r.noise(0.012), [r.filt('bandpass', 2600, 2)], [[0, 0], [0.0005, 0.5], [0.008, 0.0001]], radio);
    const contour = r.r(-0.15, 0.15);
    syl.forEach(([st, d], i) => {
        const p = f0 * (1 + contour * (i / n)) * r.r(0.92, 1.12);
        r.syllable(st, d, p, p * r.r(0.85, 1.05), VOWELS[(r.rnd() * VOWELS.length) | 0], beast ? 0.5 : 0.42, radio, rough);
        if (r.rnd() < 0.55) {
            // consonant: short fricative or plosive before the vowel
            const cf = r.rnd() < 0.5 ? r.r(3000, 5000) : r.r(1200, 2200);
            r.layer(r.noise(0.05, 'white', Math.max(0, st - 0.03)), [r.filt('bandpass', cf, 1.5)], [[Math.max(0, st - 0.03), 0], [Math.max(0, st - 0.028), 0.18], [st, 0.0001]], radio);
        }
    });
    if (beast) r.syllable(t, 0.18, f0 * 0.8, f0 * 0.55, VOWELS[4], 0.4, radio, 1.4); // closing growl
    // squelch tail "kssh"
    r.layer(r.noise(0.16, 'white', t), [r.filt('bandpass', 2000, 0.8)], [[t, 0], [t + 0.01, 0.22], [t + 0.15, 0.0001]], radio);
    return total + 0.12;
}

// sound -> [variants, reverb send, audible radius in tiles, max voices,
//           mix volume, render length in seconds]
// Every variant is peak-normalized after baking, so the mix volume alone
// sets how loud a sound is relative to the others.
const SOUND_DEFS = {
    gun_rifle: [5, 0.22, 26, 10, 0.42, 0.55],
    gun_hmg: [4, 0.25, 30, 8, 0.5, 0.75],
    gun_zap: [4, 0.2, 26, 8, 0.42, 0.45],
    cannon: [4, 0.35, 45, 6, 0.8, 1.85],
    plasma: [3, 0.3, 45, 6, 0.72, 1.25],
    artillery: [3, 0.4, 70, 4, 0.9, 3.05],
    shell_whistle: [3, 0.15, 30, 4, 0.32, 1.05],
    rocket: [3, 0.3, 36, 6, 0.6, 1.45],
    flame: [3, 0.15, 24, 6, 0.5, 0.85],
    explosion_small: [4, 0.4, 55, 8, 0.8, 1.75],
    explosion_large: [3, 0.45, 75, 5, 0.95, 3.25],
    building_collapse: [2, 0.45, 90, 3, 1.0, 4.05],
    impact_metal: [5, 0.12, 18, 8, 0.28, 0.3],
    impact_dirt: [5, 0.08, 16, 8, 0.24, 0.23],
    impact_flesh: [4, 0.05, 14, 6, 0.3, 0.17],
    ricochet: [4, 0.2, 18, 3, 0.22, 0.45],
    death_human: [5, 0.2, 22, 4, 0.4, 0.6],
    death_beast: [4, 0.2, 24, 4, 0.45, 0.75],
    death_robot: [3, 0.2, 24, 4, 0.38, 0.6],
    ui_click: [2, 0, 0, 4, 0.3, 0.13],
    radio_squelch: [2, 0, 0, 3, 0.28, 0.15],
    ack_move: [2, 0, 0, 2, 0.3, 0.15],
    ack_attack: [2, 0, 0, 2, 0.32, 0.17],
    unit_select: [2, 0, 0, 3, 0.26, 0.14],
    ui_build: [2, 0.1, 0, 2, 0.5, 0.75],
    construction_complete: [1, 0.15, 0, 2, 0.5, 0.95],
    unit_ready: [1, 0, 0, 2, 0.42, 0.35],
    research_complete: [1, 0.2, 0, 1, 0.45, 1.45],
    bonus: [1, 0.2, 0, 1, 0.45, 1.05],
    alert: [1, 0.1, 0, 1, 0.42, 1.25],
    warn: [1, 0, 0, 1, 0.38, 0.37],
    denied: [1, 0, 0, 2, 0.32, 0.27],
    victory: [1, 0.3, 0, 1, 0.6, 2.25],
    defeat: [1, 0.3, 0, 1, 0.6, 2.85],
    voice_survivors: [8, 0, 0, 1, 0.55, 1.6],
    voice_evolved: [8, 0, 0, 1, 0.55, 1.6],
    voice_series9: [8, 0, 0, 1, 0.5, 1.3],
    wind: [1, 0, 0, 1, 0.2, 11]
};

// legacy event names used across the engine -> new sound names
const SOUND_ALIASES = {
    shoot_light: 'gun_rifle', shoot_hmg: 'gun_hmg', shoot_zap: 'gun_zap',
    shoot_heavy: 'cannon', shoot_plasma: 'plasma', shoot_artillery: 'artillery',
    shoot_rocket: 'rocket', shoot_flame: 'flame'
};

// Outdoor impulse response: a few slap-back echoes off rock and
// structures, then a short, dark diffuse tail
function makeIR(ctx) {
    const len = Math.floor(SR * 1.8);
    const ir = ctx.createBuffer(2, len, SR);
    const rnd = makeRng(99);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
            const t = i / SR;
            const w = rnd() * 2 - 1;
            lp += (w - lp) * (0.35 - Math.min(0.3, t * 0.2));   // darker as it decays
            d[i] = lp * Math.exp(-t * 3.2) * 0.5;
        }
        for (const [t, a] of [[0.021 + ch * 0.004, 0.5], [0.047 + ch * 0.006, 0.35], [0.093 + ch * 0.003, 0.25], [0.16, 0.15]]) {
            const i = Math.floor(t * SR);
            for (let k = 0; k < 40; k++) d[i + k] += a * (1 - k / 40) * (rnd() * 2 - 1);
        }
    }
    return ir;
}

// ============================================
// SOUND MANAGER (public API used by the engine)
//   SoundManager.play(name, { x, y, volume, delay, rate })
// x/y in world tiles make the sound positional.
// ============================================
const SoundManager = {
    ctx: null,
    enabled: true,
    combatEnabled: true,
    volume: 1,
    bank: new Map(),        // name -> [AudioBuffer]
    rr: new Map(),          // round-robin index
    voices: new Map(),      // name -> [{ src, end }]
    ready: false,

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[SoundManager] Web Audio not supported');
            this.enabled = false;
            return;
        }
        const ctx = this.ctx;
        // master: compressor keeps 30 simultaneous explosions from clipping
        this.master = ctx.createDynamicsCompressor();
        this.master.threshold.value = -16;
        this.master.knee.value = 12;
        this.master.ratio.value = 5;
        this.master.attack.value = 0.003;
        this.master.release.value = 0.25;
        this.master.connect(ctx.destination);
        this.sfxGain = ctx.createGain();
        this.sfxGain.gain.value = 1;
        this.sfxGain.connect(this.master);
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = makeIR(ctx);
        this.reverbGain = ctx.createGain();
        this.reverbGain.gain.value = 0.9;
        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.sfxGain);
        this.ambGain = ctx.createGain();
        this.ambGain.gain.value = 0;
        this.ambGain.connect(this.sfxGain);

        if (typeof MusicEngine !== 'undefined') MusicEngine.init(ctx);
        if (typeof VoiceManager !== 'undefined') VoiceManager.init(ctx, this);
        this.bake();
    },

    // Render the whole bank offline, all variants in parallel
    async bake() {
        const t0 = performance.now();
        let seed = 7;
        const jobs = [];
        for (const [name, def] of Object.entries(SOUND_DEFS)) {
            const variants = def[0], len = def[5];
            const list = new Array(variants);
            this.bank.set(name, list);
            for (let v = 0; v < variants; v++) {
                const rnd = makeRng(seed += 7919);
                const oc = new OfflineAudioContext(1, Math.ceil(SR * len), SR);
                const dur = RECIPES[name](new Rec(oc, rnd));
                jobs.push(oc.startRendering().then(buf => {
                    list[v] = finishBuffer(this.ctx, buf, Math.min(len, dur + 0.05), name === 'wind');
                }));
            }
        }
        await Promise.all(jobs);
        this.ready = true;
        console.log(`[SoundManager] ${this.bank.size} sounds baked in ${Math.round(performance.now() - t0)} ms`);
        if (this._ambWanted) this.startAmbience();
    },

    setSfxVolume(v) {
        this.volume = v;
        if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    // Where is (x, y) relative to the listener (the camera)?
    _spatial(x, y, radius) {
        if (typeof canvas === 'undefined' || !canvas || typeof worldToScreen !== 'function') return { gain: 1, pan: 0, cutoff: 20000 };
        const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
        const s = worldToScreen(x, y);
        const c = screenToWorld(cw / 2, ch / 2);
        const zoom = typeof getZoom === 'function' ? getZoom() : 1;
        // listener hangs above the screen center: zoomed out = further away
        const d = Math.hypot(x - c.x, y - c.y) + 6 / zoom;
        const k = Math.max(0, 1 - d / radius);
        const gain = Math.pow(k, 1.6);
        const pan = Math.max(-1, Math.min(1, (s.x - cw / 2) / (cw * 0.65))) * 0.85;
        const cutoff = 900 + 19000 * k * k;   // air absorption: far away = muffled
        return { gain, pan, cutoff };
    },

    play(name, opts = {}) {
        if (!this.enabled || !this.ctx) return;
        name = SOUND_ALIASES[name] || name;
        const def = SOUND_DEFS[name];
        if (!def || !this.ready) return;
        const [, send, radius, maxVoices, baseVol] = def;
        const combat = radius > 0 && !name.startsWith('death') ? true : false;
        if (combat && !this.combatEnabled) return;
        this.resume();

        let gain = baseVol * (opts.volume ?? 1), pan = 0, cutoff = 20000;
        if (opts.x !== undefined && radius > 0) {
            const sp = this._spatial(opts.x, opts.y, radius);
            gain *= sp.gain; pan = sp.pan; cutoff = sp.cutoff;
            if (gain < 0.015) return;
        }

        // voice limit per sound: steal the oldest
        const now = this.ctx.currentTime;
        let vs = (this.voices.get(name) || []).filter(v => v.end > now);
        if (vs.length >= maxVoices) {
            const old = vs.shift();
            try { old.g.gain.setTargetAtTime(0, now, 0.01); old.src.stop(now + 0.05); } catch (e) { /* already stopped */ }
        }

        const list = this.bank.get(name);
        const i = (this.rr.get(name) || 0) % list.length;
        this.rr.set(name, i + 1 + ((Math.random() * (list.length - 1)) | 0));
        const buf = list[i];

        const ctx = this.ctx;
        const t = now + (opts.delay || 0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = (opts.rate || 1) * (radius > 0 ? 0.94 + Math.random() * 0.12 : 1);
        const g = ctx.createGain();
        g.gain.value = gain;
        let node = src;
        if (cutoff < 19000) {
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = cutoff;
            node.connect(lp);
            node = lp;
        }
        node.connect(g);
        let out = g;
        if (pan !== 0 && ctx.createStereoPanner) {
            const p = ctx.createStereoPanner();
            p.pan.value = pan;
            g.connect(p);
            out = p;
        }
        out.connect(opts.bus || this.sfxGain);
        if (send > 0) {
            const sg = ctx.createGain();
            // distant sounds are more reverberant (less direct, same tail)
            sg.gain.value = send * Math.min(1.5, 1 + (1 - Math.min(1, gain / baseVol)) * 0.8);
            out.connect(sg);
            sg.connect(this.reverb);
        }
        src.start(t);
        vs.push({ src, g, end: t + buf.duration / src.playbackRate.value });
        this.voices.set(name, vs);
    },

    // Looping desert wind under the battle
    startAmbience() {
        if (!this.ctx) return;
        this._ambWanted = true;
        if (!this.ready || this._amb) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.bank.get('wind')[0];
        src.loop = true;
        src.connect(this.ambGain);
        src.start();
        this._amb = src;
        this.ambGain.gain.setTargetAtTime(SOUND_DEFS.wind[4], this.ctx.currentTime, 1.5);
    },
    stopAmbience() {
        this._ambWanted = false;
        if (!this._amb) return;
        this.ambGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
        const s = this._amb;
        this._amb = null;
        setTimeout(() => { try { s.stop(); } catch (e) { /* ok */ } }, 2000);
    }
};

// Copy a rendered buffer into a right-sized one, peak-normalize it,
// declick the end; loops get a 1 s crossfade so the seam is inaudible
function finishBuffer(ctx, buf, dur, loop) {
    let len = Math.min(buf.length, Math.ceil(dur * SR));
    const src = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(src[i]));
    const norm = peak > 0 ? 0.95 / peak : 1;
    const xf = loop ? Math.floor(SR * 1.0) : 0;
    const out = ctx.createBuffer(1, len - xf, SR);
    const dst = out.getChannelData(0);
    for (let i = 0; i < len - xf; i++) dst[i] = src[i] * norm;
    if (loop) {
        for (let i = 0; i < xf; i++) {
            const k = i / xf;
            dst[i] = dst[i] * k + src[len - xf + i] * norm * (1 - k);
        }
    } else {
        const f = Math.min(256, dst.length);
        for (let i = 0; i < f; i++) dst[dst.length - 1 - i] *= i / f;
    }
    return out;
}

// ============================================
// VOICES: radio chatter per faction + spoken announcer
// ============================================
const VoiceManager = {
    ctx: null,
    voiceGain: null,
    volume: 0.55,
    lastPlayed: {},
    announcer: true,
    lastLine: {},

    init(ctx, sm) {
        this.ctx = ctx;
        this.sm = sm;
        this.voiceGain = ctx.createGain();
        this.voiceGain.gain.value = this.volume;
        this.voiceGain.connect(sm.master || ctx.destination);
        try { this.announcer = localStorage.getItem('xfire_announcer') !== 'off'; } catch (e) { /* default on */ }
    },

    setVolume(v) {
        this.volume = v;
        if (this.voiceGain) this.voiceGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    },

    // Unit radio reply. category: 'select' | 'move' | 'attack' | 'ready' | 'promote'
    play(category, faction) {
        if (!this.ctx || !this.sm) return;
        const now = performance.now();
        // throttle: one transmission at a time, short cooldown
        if (now - (this.lastPlayed.any || 0) < 1300) return;
        this.lastPlayed.any = now;
        const name = 'voice_' + (FACTIONS[faction] ? faction : 'survivors');
        this.sm.play(name, { bus: this.voiceGain, rate: category === 'attack' ? 1.08 : 1 });
    },

    // Spoken announcer (browser speech synthesis), throttled per line
    say(line, minGapMs = 8000) {
        if (!this.announcer || typeof speechSynthesis === 'undefined') return;
        const now = performance.now();
        if (now - (this.lastLine[line] || -1e9) < minGapMs) return;
        if (speechSynthesis.speaking && now - (this.lastLine._any || 0) < 1800) return;
        this.lastLine[line] = now;
        this.lastLine._any = now;
        try {
            const u = new SpeechSynthesisUtterance(line);
            const voices = speechSynthesis.getVoices();
            const pick = voices.find(v => /en-(US|GB)/i.test(v.lang) && /male|david|daniel|alex|guy|george/i.test(v.name)) ||
                voices.find(v => /^en/i.test(v.lang));
            if (pick) u.voice = pick;
            u.rate = 1.05;
            u.pitch = 0.8;
            u.volume = Math.min(1, this.volume * 1.4);
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
        } catch (e) { /* speech unavailable */ }
    },

    setAnnouncer(on) {
        this.announcer = on;
        try { localStorage.setItem('xfire_announcer', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
        if (!on && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    }
};

// Desert ambience runs whenever the in-game soundtrack does
if (typeof MusicEngine !== 'undefined') {
    const _start = MusicEngine.start.bind(MusicEngine), _stop = MusicEngine.stop.bind(MusicEngine);
    MusicEngine.start = function () { _start(); SoundManager.startAmbience(); };
    MusicEngine.stop = function () { _stop(); SoundManager.stopAmbience(); };
}
