// ============================================
// XFire Krossfire - Procedural Audio
// Everything is synthesized in code: a chiptune
// step-sequencer soundtrack that reacts to combat
// intensity, and per-faction radio-chatter voices.
// ============================================

// ---------------------------------------------
// MUSIC ENGINE
// A 16-step sequencer at ~100 BPM. The calm layer
// (pads + sparse bass) always plays in-game; the
// combat layer (drums + lead) fades in and out
// with the battle heat, staying in the same groove
// so the transition is seamless.
// ---------------------------------------------
const MusicEngine = {
    ctx: null,
    musicGain: null,
    calmGain: null,
    combatGain: null,
    playing: false,
    step: 0,
    nextStepTime: 0,
    timer: null,
    volume: 0.5,
    combat: false,
    _quietSince: 0,

    // Original patterns (composed for this game): A-minor-ish groove.
    // Frequencies are derived from a small scale table.
    SCALE: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63], // A C D E G A C D E
    STEPS: 16,
    STEP_TIME: 60 / 100 / 4, // 100 BPM, 16th notes

    // calm layer - two sections (A/B) that alternate every 4 bars, so the
    // ambience slowly breathes instead of looping one 4-bar phrase forever
    padChordsA: [
        [0, 2, 4],   // A-D-G stack
        [1, 3, 5],   // C-E-A
        [0, 2, 4],
        [2, 4, 6]    // D-G-C
    ],
    padChordsB: [
        [1, 3, 5],   // C-E-A
        [3, 5, 7],   // E-A-D
        [2, 4, 6],   // D-G-C
        [0, 2, 4]    // home again
    ],
    calmBassA: [0, -1, -1, -1, 0, -1, 4, -1, 1, -1, -1, -1, 2, -1, 1, -1],
    calmBassB: [1, -1, -1, -1, -1, -1, 3, -1, 2, -1, -1, 5, -1, -1, 0, -1],

    // combat layer - lead alternates between two phrases per cycle
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatA: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    hatB: [0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1],
    combatBass: [0, 0, -1, 0, 3, -1, 0, 0, 1, 1, -1, 1, 4, -1, 3, 2],
    leadA: [-1, -1, 7, -1, 5, -1, 4, -1, -1, 7, -1, 8, -1, 5, 4, -1],
    leadB: [-1, 4, -1, 5, -1, -1, 7, -1, 8, -1, 7, -1, 5, -1, -1, 4],

    init(ctx) {
        this.ctx = ctx;
        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = this.volume;
        this.musicGain.connect(ctx.destination);
        this.calmGain = ctx.createGain();
        this.calmGain.gain.value = 1;
        this.calmGain.connect(this.musicGain);
        this.combatGain = ctx.createGain();
        this.combatGain.gain.value = 0;
        this.combatGain.connect(this.musicGain);
    },

    setVolume(v) {
        this.volume = v;
        if (this.musicGain) {
            this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    },

    start() {
        if (!this.ctx || this.playing) return;
        this.playing = true;
        this.step = 0;
        this.nextStepTime = this.ctx.currentTime + 0.1;
        // lookahead scheduler: queue notes slightly ahead of time
        this.timer = setInterval(() => this._schedule(), 30);
    },

    stop() {
        this.playing = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    // Battle heat drives the layer crossfade with hysteresis
    setHeat(heat) {
        if (!this.ctx || !this.playing) return;
        const now = performance.now();
        if (!this.combat && heat > 0.35) {
            this.combat = true;
            this.combatGain.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
            this.calmGain.gain.setTargetAtTime(0.45, this.ctx.currentTime, 1.2);
        } else if (this.combat) {
            if (heat > 0.1) {
                this._quietSince = now;
            } else if (now - this._quietSince > 8000) {
                this.combat = false;
                this.combatGain.gain.setTargetAtTime(0, this.ctx.currentTime, 2.5);
                this.calmGain.gain.setTargetAtTime(1, this.ctx.currentTime, 2.5);
            }
        }
    },

    _schedule() {
        if (!this.playing) return;
        while (this.nextStepTime < this.ctx.currentTime + 0.12) {
            this._playStep(this.step, this.nextStepTime);
            this.nextStepTime += this.STEP_TIME;
            this.step = (this.step + 1) % (this.STEPS * 8); // 8-bar super-loop
        }
    },

    _playStep(globalStep, t) {
        const s = globalStep % this.STEPS;
        const bar8 = Math.floor(globalStep / this.STEPS) % 8; // position in the super-loop
        const bar = bar8 % 4;
        const sectionB = bar8 >= 4;

        // ---- calm layer ----
        // pad chord at the start of each bar; bar 7 rests (breathing space)
        const chords = sectionB ? this.padChordsB : this.padChordsA;
        if (s === 0 && bar8 !== 7) {
            for (const deg of chords[bar]) {
                this._pad(this.SCALE[deg], t, this.STEP_TIME * this.STEPS * 0.95,
                    sectionB ? 900 : 700); // section B opens the filter a touch
            }
        }
        // sparse bass
        const calmBass = sectionB ? this.calmBassB : this.calmBassA;
        const cb = calmBass[s];
        if (cb >= 0 && bar % 2 === 0) {
            this._bass(this.SCALE[cb] / 2, t, 0.28, this.calmGain, 0.18);
        }
        // occasional soft pluck from the current chord - rare and quiet,
        // just enough that two minutes of calm never sound identical
        if (s % 2 === 0 && Math.random() < 0.09) {
            const deg = chords[bar][(Math.random() * 3) | 0];
            this._pluck(this.SCALE[deg] * 2, t);
        }

        // ---- combat layer ----
        const fillBar = bar8 === 3 || bar8 === 7; // cycle turnaround
        if (this.kick[s]) this._kick(t);
        if (this.snare[s]) this._snare(t);
        // drum fill: extra snare stutter into the next cycle
        if (fillBar && s >= 12 && Math.random() < 0.55) this._snare(t);
        const hat = sectionB ? this.hatB : this.hatA;
        if (hat[s]) this._hat(t, s % 4 === 2 ? 0.05 : 0.03);
        const bb = this.combatBass[s];
        if (bb >= 0) this._bass(this.SCALE[bb] / 2, t, 0.14, this.combatGain, 0.22);
        const lead = sectionB ? this.leadB : this.leadA;
        const ld = lead[s];
        if (ld >= 0 && bar >= 1) this._lead(this.SCALE[ld] * 2, t, 0.16);
    },

    // soft triangle pluck for the calm layer's sparse ornaments
    _pluck(freq, t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = 'triangle';
        o.frequency.value = freq;
        f.type = 'lowpass';
        f.frequency.value = 1600;
        this._env(g, t, 0.005, 0.045, 0.5);
        o.connect(f); f.connect(g); g.connect(this.calmGain);
        o.start(t); o.stop(t + 0.6);
    },

    _env(gainNode, t, attack, peak, decay) {
        gainNode.gain.setValueAtTime(0.0001, t);
        gainNode.gain.linearRampToValueAtTime(peak, t + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    },

    _pad(freq, t, dur, cutoff = 700) {
        const ctx = this.ctx;
        for (const det of [-4, 4]) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            const f = ctx.createBiquadFilter();
            o.type = 'sawtooth';
            o.frequency.value = freq;
            o.detune.value = det;
            f.type = 'lowpass';
            f.frequency.value = cutoff;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            o.connect(f); f.connect(g); g.connect(this.calmGain);
            o.start(t); o.stop(t + dur + 0.05);
        }
    },

    _bass(freq, t, dur, dest, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        this._env(g, t, 0.01, vol, dur);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
    },

    _lead(freq, t, dur) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = 'square';
        o.frequency.value = freq;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2400, t);
        f.frequency.exponentialRampToValueAtTime(900, t + dur);
        this._env(g, t, 0.008, 0.07, dur);
        o.connect(f); f.connect(g); g.connect(this.combatGain);
        o.start(t); o.stop(t + dur + 0.05);
    },

    _kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        this._env(g, t, 0.003, 0.5, 0.13);
        o.connect(g); g.connect(this.combatGain);
        o.start(t); o.stop(t + 0.16);
    },

    _noiseBurst(t, dur, filterType, filterFreq, vol, dest) {
        const ctx = this.ctx;
        const len = Math.max(1, (ctx.sampleRate * dur) | 0);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = filterFreq;
        const g = ctx.createGain();
        g.gain.value = vol;
        src.connect(f); f.connect(g); g.connect(dest);
        src.start(t);
    },

    _snare(t) { this._noiseBurst(t, 0.12, 'highpass', 1400, 0.22, this.combatGain); },
    _hat(t, vol) { this._noiseBurst(t, 0.04, 'highpass', 6000, vol, this.combatGain); }
};

// Radio voices + announcer now live in sfx.js (VoiceManager)
