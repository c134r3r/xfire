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

    // calm layer
    padChords: [
        [0, 2, 4],   // A-D-G stack
        [1, 3, 5],   // C-E-A
        [0, 2, 4],
        [2, 4, 6]    // D-G-C
    ],
    calmBass: [0, -1, -1, -1, 0, -1, 4, -1, 1, -1, -1, -1, 2, -1, 1, -1],

    // combat layer
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    combatBass: [0, 0, -1, 0, 3, -1, 0, 0, 1, 1, -1, 1, 4, -1, 3, 2],
    lead: [-1, -1, 7, -1, 5, -1, 4, -1, -1, 7, -1, 8, -1, 5, 4, -1],

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
            this.step = (this.step + 1) % (this.STEPS * 4); // 4-bar loop
        }
    },

    _playStep(globalStep, t) {
        const s = globalStep % this.STEPS;
        const bar = Math.floor(globalStep / this.STEPS) % 4;

        // ---- calm layer ----
        // pad chord at the start of each bar
        if (s === 0) {
            for (const deg of this.padChords[bar]) {
                this._pad(this.SCALE[deg], t, this.STEP_TIME * this.STEPS * 0.95);
            }
        }
        // sparse bass
        const cb = this.calmBass[s];
        if (cb >= 0 && bar % 2 === 0) {
            this._bass(this.SCALE[cb] / 2, t, 0.28, this.calmGain, 0.18);
        }

        // ---- combat layer ----
        if (this.kick[s]) this._kick(t);
        if (this.snare[s]) this._snare(t);
        if (this.hat[s]) this._hat(t, s % 4 === 2 ? 0.05 : 0.03);
        const bb = this.combatBass[s];
        if (bb >= 0) this._bass(this.SCALE[bb] / 2, t, 0.14, this.combatGain, 0.22);
        const ld = this.lead[s];
        if (ld >= 0 && bar >= 1) this._lead(this.SCALE[ld] * 2, t, 0.16);
    },

    _env(gainNode, t, attack, peak, decay) {
        gainNode.gain.setValueAtTime(0.0001, t);
        gainNode.gain.linearRampToValueAtTime(peak, t + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    },

    _pad(freq, t, dur) {
        const ctx = this.ctx;
        for (const det of [-4, 4]) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            const f = ctx.createBiquadFilter();
            o.type = 'sawtooth';
            o.frequency.value = freq;
            o.detune.value = det;
            f.type = 'lowpass';
            f.frequency.value = 700;
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

// ---------------------------------------------
// VOICE MANAGER
// Wordless per-faction radio chatter: Survivors get
// band-passed radio babble with a squelch click,
// Evolved growl, Series 9 answer in data-link beeps.
// Throttled per category so fast clicking never spams.
// ---------------------------------------------
const VoiceManager = {
    ctx: null,
    voiceGain: null,
    volume: 0.55,
    lastPlayed: {},

    init(ctx) {
        this.ctx = ctx;
        this.voiceGain = ctx.createGain();
        this.voiceGain.gain.value = this.volume;
        this.voiceGain.connect(ctx.destination);
    },

    setVolume(v) {
        this.volume = v;
        if (this.voiceGain) {
            this.voiceGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    },

    // category: 'select' | 'move' | 'attack' | 'ready' | 'promote'
    play(category, faction) {
        if (!this.ctx) return;
        const now = performance.now();
        const key = category;
        if (this.lastPlayed[key] && now - this.lastPlayed[key] < 1500) return;
        this.lastPlayed[key] = now;

        // category flavors the pitch/urgency of the chatter
        const urgency = category === 'attack' ? 1.25 : category === 'promote' ? 1.1 : 1;
        if (faction === 'evolved') this._growl(urgency);
        else if (faction === 'series9') this._datalink(urgency);
        else this._radio(urgency);
    },

    // Survivors: garbled radio voice - a few pitched formant bursts
    // through a band-pass, ending on a squelch click
    _radio(urgency) {
        const ctx = this.ctx;
        const t0 = ctx.currentTime;
        const syllables = 2 + (Math.random() * 3 | 0);
        let t = t0;
        for (let i = 0; i < syllables; i++) {
            const dur = 0.07 + Math.random() * 0.08;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            const f = ctx.createBiquadFilter();
            o.type = 'sawtooth';
            const base = (140 + Math.random() * 80) * urgency;
            o.frequency.setValueAtTime(base, t);
            o.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.5), t + dur);
            f.type = 'bandpass';
            f.frequency.value = 1100;
            f.Q.value = 2.5;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.5, t + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            o.connect(f); f.connect(g); g.connect(this.voiceGain);
            o.start(t); o.stop(t + dur + 0.02);
            t += dur + 0.02 + Math.random() * 0.04;
        }
        // squelch click
        MusicEngine._noiseBurst && this._click(t);
    },

    _click(t) {
        const ctx = this.ctx;
        const len = (ctx.sampleRate * 0.03) | 0;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2500;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        src.connect(f); f.connect(g); g.connect(this.voiceGain);
        src.start(t);
    },

    // Evolved: low guttural growl with a pitch drop
    _growl(urgency) {
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const dur = 0.25 + Math.random() * 0.2;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = 'sawtooth';
        const base = (85 + Math.random() * 40) * urgency;
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 0.55, t + dur);
        f.type = 'lowpass';
        f.frequency.value = 500;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.55, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(f); f.connect(g); g.connect(this.voiceGain);
        o.start(t); o.stop(t + dur + 0.02);
        // breathy rasp on top
        const len = (ctx.sampleRate * dur) | 0;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.5;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const nf = ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.value = 350;
        const ng = ctx.createGain();
        ng.gain.value = 0.3;
        src.connect(nf); nf.connect(ng); ng.connect(this.voiceGain);
        src.start(t);
    },

    // Series 9: crisp data-link beep sequence
    _datalink(urgency) {
        const ctx = this.ctx;
        let t = ctx.currentTime;
        const beeps = 3 + (Math.random() * 3 | 0);
        for (let i = 0; i < beeps; i++) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'square';
            o.frequency.value = (700 + Math.random() * 900) * urgency;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            o.connect(g); g.connect(this.voiceGain);
            o.start(t); o.stop(t + 0.06);
            t += 0.055 + Math.random() * 0.03;
        }
    }
};
