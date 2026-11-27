'use strict';
// 12-missions.js - Missions-Interpreter (PLAN §7.7): Mandate annehmen (Anruf, Markierungsauge, Terminal), Schritt-Typen, Ereignisse, Fristen,
// Marker + Navi-Route, Immunität, Checkpoint-Snapshot, Belohnung, Vollstreckung (Fehlschlag) mit Rückkehr zum Start.
// Daten: MISSIONS in 13-story.js. Exportiert: Missions, missionCtl
// Entscheidung D2: Scheitern = Vollstreckung, danach steht der Spieler wieder am Start und muss das Mandat von Hand neu annehmen.
// Tod im Mandat = AUSGELÖSCHT (normale Wiederbelebung), das Mandat liegt danach wieder am Startauge.

const MIS_COLOR = { MANDAT: '#ff3fa4', VELA: '#3fe8ff', '???': '#ffffff', SYS: '#9fb4d8' };

const Missions = {
  run: null, offerDef: null, exec: null, pushT: -1, pushDef: null, route: [], routeT: -99, routeKey: '', scripts: [], ambT: 0, active: false, startCd: 0,
  reset() {
    this.cleanup(); this.run = null; this.offerDef = null; this.exec = null; this.autoT = 0; this.pushT = -1; this.pushDef = null; this.route = []; this.scripts = []; this.ambT = 60 * 200; G.tags = {}; G.crimeMute = false;
    for (const k of Object.keys(G.flags)) if (/^M\d\d$/.test(k)) delete G.flags[k];
    this.hud(); this.setLetterbox(false);
  },
  def(id) { return MISSIONS[id]; },
  nextDef() { for (const id of MIS_ORDER) { const d = MISSIONS[id]; if (G.flags[id]) continue; if (d.requires.every(r => G.flags[r])) return d; } return null; },
  locked() { return !!this.exec || !!(this.run && this.run.step && this.run.step.t === 'cutscene' && this.run.step.lock !== false); },
  say(lines) { for (const [who, text] of lines || []) HUD.say(who, text, MIS_COLOR[who] || '#e8d8b0'); },
  // ---- Positionen ----
  pos(at, veh) {
    if (!at) return null;
    if (at.tag) { const e = G.tags[at.tag]; return e ? { x: e.x, y: e.y } : null; }
    if (at.lm) { const c = G.city.landmarks[at.lm].center; return World.freeSpot(c.x + (at.dx || 0) * C.TILE, c.y + (at.dy || 0) * C.TILE, veh ? 34 : C.PED_R); }
    if (at.near === 'player') {
      const p = G.player;
      for (let k = 0; k < 120; k++) {
        const a = rand(0, TAU), d = rand(at.min || 300, at.max || 600), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (at.onRoad) { const L = tileLane(x, y); if (!L || L.junction) continue; return { x: (L.tx + 0.5) * C.TILE, y: (L.ty + 0.5) * C.TILE, a: Math.atan2(L.dy, L.dx) }; }
        if (!World.blocked(x, y, veh ? 34 : C.PED_R)) return { x, y };
      }
      return World.freeSpot(p.x + 400, p.y, 34);
    }
    return null;
  },
  // ---- Entitäten erzeugen ----
  spawn(list, step) {
    for (const sp of list || []) for (let i = 0; i < (sp.count || 1); i++) this.spawnOne(sp, i);
  },
  spawnOne(sp, i) {
    const run = this.run, P = this.pos(sp.at, sp.kind === 'vehicle'); if (!P) return null; let e;
    const tag = sp.tag ? (sp.count > 1 ? sp.tag + i : sp.tag) : null;
    if (sp.kind === 'ped') {
      e = makePed(P.x + i * 14, P.y, {}); e.mis = run.def.id; e.role = sp.type; e.immune = !!sp.immune || !!run.step.immune; e.noDodge = false; e.cr = sp.type === 'haendler' ? 40 : e.cr;
      if (!sp.ai || sp.ai === 'stand') { e.wait = 999999; e.speed = 0; e.state = 'walk'; e.hasT = true; e.tx = e.x; e.ty = e.y; e.standing = true; }
      e.a = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    } else if (sp.kind === 'vehicle') {
      const a = sp.angle === 'road' ? (() => { const L = tileLane(P.x, P.y); return L ? Math.atan2(L.dy, L.dx) : P.a || 0; })() : (P.a || 0);
      e = spawnVehicle(sp.type, P.x + i * 40, P.y + i * 20, a, { paint: sp.paint }); e.mis = { id: run.def.id, mode: sp.ai || null, target: sp.target || null }; e.immune = !!sp.immune || !!run.step.immune;
      if (sp.ai === 'ram') { e.engine = true; e.vx = Math.cos(a) * 3; e.vy = Math.sin(a) * 3; }
      if (sp.crew === 'od') { e.od = { cargo: 0, stuck: 0, rev: 0, siren: false, block: true }; e.locked = true; }
      if (sp.ai === 'parked') e.locked = true;
      if (sp.tag === 'zuteilung') e.unlocked = true;
    } else if (sp.kind === 'prop') {
      e = { x: P.x, y: P.y, hp: sp.type === 'stand' ? 70 : 24, kind: sp.type, mis: run.def.id, immune: true }; G.props.push(e);
    } else if (sp.kind === 'pickup') { G.pickups.push({ x: P.x, y: P.y, type: 'cr', v: sp.v || 50, life: 3600, bob: 0 }); return null; }
    if (tag) G.tags[tag] = e; run.ents.push(e); return e;
  },
  cleanup() {
    const r = this.run; if (!r) return;
    for (const e of r.ents) {
      if (e.kind === 'ped' && G.peds.includes(e)) G.peds.splice(G.peds.indexOf(e), 1);
      else if (e.cls && G.vehicles.includes(e)) { if (G.player && G.player.veh === e) exitVehicle(G.player, true); G.vehicles.splice(G.vehicles.indexOf(e), 1); }
      else if (G.props.includes(e)) G.props.splice(G.props.indexOf(e), 1);
    }
    r.ents.length = 0; G.tags = {}; this.scripts = []; G.crimeMute = false;
  },
  // ---- Ablauf ----
  offer(def, withCall) {                                                           // Mandat anbieten: Anruf, Markierungsauge am Start, Route
    this.offerDef = def; this.pushT = -1; this.pushDef = null; this.route = []; this.routeKey = '';
    if (withCall !== false) { Aud.play('mandat_anruf', { gain: 0.9, cat: 'ui', bus: 'stimmen' }); Aud.duck(-6, 3); this.say(def.call); this.glitch(0.5); }
  },
  startPos(def) { const P = this.pos(def.start, false); return P; },
  accept(def) {
    if (this.run) return;
    const p = G.player; this.offerDef = null; this.pushT = -1;
    this.snap = { cr: G.credits || 0, own: Object.assign({}, G.own), ammo: Object.assign({}, G.ammo), armor: G.armor || 0, weapon: G.weapon, hp: p.hp, spawn: def.start ? this.pos(def.start, false) : null };
    this.run = { def, i: -1, step: null, sst: null, ents: [], tick: 0, left: def.deadline ? def.deadline * 60 : 0, warned: {}, cutscene: false }; G.tags = {};
    this.active = true; const onS = def.onStart; if (onS && onS.give) for (const w in onS.give) { giveWeapon(w, onS.give[w]); setWeapon(w); }
    if (def.intro) HUD.banner(def.intro.card[0], def.intro.card[1], 4200);
    else if (def.actCard) HUD.banner(def.actCard[0] + ' · ' + def.actCard[1], def.title.toUpperCase(), 3600);
    else HUD.banner(def.title.toUpperCase(), 'MANDAT ANGENOMMEN', 2200);
    Aud.play('sting_heat', { gain: 0.5, cat: 'ui', bus: 'ui', rate: 1.5 });
    this.startStep(0);
  },
  startStep(i) {
    const run = this.run, def = run.def; run.i = i; run.step = def.steps[i]; const st = run.step; run.sst = { t: 0, fired: {}, hold: 0, prog: 0, d0: 0, left: st.time ? st.time * 60 : 0 };
    G.crimeMute = !!st.immune; this.route = []; this.routeKey = '';
    this.spawn(st.spawn, st); if (st.say && st.t !== 'talk') this.say(st.say);
    if (st.t === 'cutscene') this.setLetterbox(st.letterbox !== false);
    this.hud();
  },
  targetPos() {
    const r = this.run; if (!r) return null; const st = r.step;
    if (st.t === 'goto' || st.t === 'deliver' || st.t === 'hold') return this.pos(st.at, false);
    if (st.t === 'enter' || st.t === 'chase' || st.t === 'talk') { const e = G.tags[st.tag]; return e && !(e.state === 'dead') ? { x: e.x, y: e.y } : null; }
    if (st.t === 'destroy') { for (const t of st.tags) { const e = G.tags[t]; if (e && !e.dead) return { x: e.x, y: e.y }; } }
    return null;
  },
  stepDone() {
    const run = this.run, st = run.step; if (st.onDone && st.onDone.cr) { G.credits = (G.credits || 0) + st.onDone.cr; floatText(G.player.x, G.player.y - 24, MIS_TEXT.reward(st.onDone.cr), '#ffd84a', 13); }
    if (run.i + 1 >= run.def.steps.length) this.complete(); else this.startStep(run.i + 1);
  },
  complete() {
    const run = this.run, def = run.def, p = G.player; G.crimeMute = false; 
    if (def.reward) { G.credits = (G.credits || 0) + (def.reward.cr || 0); for (const f of def.reward.flags || []) G.flags[f] = true; G.stats.cr += def.reward.cr || 0; }
    Aud.play('kasse', { gain: 0.9, cat: 'ui', bus: 'ui' }); Aud.play('sting_clear', { gain: 0.8, cat: 'ui', bus: 'ui' });
    if (def.id !== 'M00') { HUD.banner(MIS_TEXT.okTitle, def.reward && def.reward.cr ? MIS_TEXT.reward(def.reward.cr) + ' · ' + MIS_TEXT.ok[def.act % MIS_TEXT.ok.length] : '', 3200); floatText(p.x, p.y - 28, MIS_TEXT.reward(def.reward.cr), '#ffd84a', 14); }
    this.say(def.outro); this.cleanupSoft(); this.setLetterbox(false); this.run = null; this.active = false; this.route = [];
    const nx = this.nextDef(); if (nx) { this.pushDef = nx; this.pushT = nx.push && nx.push.after ? nx.push.after * 60 : 60 * 20; }
    this.hud();
  },
  cleanupSoft() {                                                                 // Mission-Entitäten bleiben stehen (Fahrzeug des Spielers nicht wegnehmen), Tags weg
    const r = this.run; if (!r) return; for (const e of r.ents) { if (e.mis && e.cls) { e.mis = null; if (e.ai) e.keep = false; } } G.tags = {}; this.scripts = []; G.crimeMute = false; r.ents.length = 0;
  },
  fail(reason) {
    const run = this.run; if (!run || this.exec) return;
    if (run.def.failMode === 'execute') { this.exec = { s: 0, reason, ph: 0 }; this.say([['MANDAT', MIS_TEXT.failLine]]); G.crimeMute = true; Aud.play('vollstreckung', { gain: 1.2, cat: 'sfx', bus: 'sfx' }); Aud.duck(-8, 4); this.setLetterbox(true); }
    else { HUD.banner('MANDAT NEU GESTARTET', '', 1800); this.abort(true); }
  },
  // Abbruch: Welt aufräumen, Snapshot zurück, Mandat wieder am Startauge anbieten
  abort(reoffer) {
    const run = this.run; if (!run) return; const def = run.def;
    this.cleanup(); const S = this.snap; if (S) { G.credits = S.cr; G.own = Object.assign({}, S.own); G.ammo = Object.assign({}, S.ammo); G.armor = S.armor; G.weapon = S.own[S.weapon] ? S.weapon : 'faust'; }
    this.run = null; this.active = false; G.crimeMute = false; this.route = []; this.setLetterbox(false);
    if (G.player) { G.player.hp = G.player.maxHp; }
    if (reoffer) this.offer(def, false);
    this.hud();
  },
  // Vollstreckung (D2): Eingaben gesperrt, drei Pieptöne, Funken, Sturz, Zeitlupe, Schwarz, zurück zum Start
  updateExec() {
    const e = this.exec, p = G.player; e.s += 1 / 60; const s = e.s, fx = document.getElementById('execFx'), black = document.getElementById('execBlack');
    const pulse = () => { fx.className = 'pulse'; setTimeout(() => { fx.className = 'fade'; }, 90); };
    if (e.ph === 0 && s > 0.15) { e.ph = 1; pulse(); G.trauma = Math.max(G.trauma, 0.15); }
    if (e.ph === 1 && s > 0.55) { e.ph = 2; pulse(); G.trauma = Math.max(G.trauma, 0.2); }
    if (e.ph === 2 && s > 0.95) { e.ph = 3; pulse(); G.trauma = Math.max(G.trauma, 0.25); }
    if (s > 0.15 && s < 1.4) p.a += Math.sin(s * 60) * 0.02;
    if (e.ph === 3 && s > 1.4) { e.ph = 4; fx.className = 'glitch'; setTimeout(() => { fx.className = 'fade'; }, 160); sparks(p.x, p.y - 4, 24, '#9fe8ff', 7); sparks(p.x, p.y - 4, 12, '#ffffff', 5); glow(p.x, p.y, 40, '#9fe8ff', 8); Lights.add(p.x, p.y, 140, '#9fe8ff', 1); addTrauma(0.5); G.freeze = 3; }
    if (e.ph === 4 && s > 2.0) { e.ph = 5; e.fell = true; if (p.veh) exitVehicle(p, true); Ground.decal && 0; }
    if (e.ph === 5 && s > 2.2) { e.ph = 6; HUD.banner(MIS_TEXT.execTitle, MIS_TEXT.execSub, 2600); }
    if (e.ph === 6 && s > 3.4) { e.ph = 7; }
    G.fadeA = 0; black.style.opacity = s < 3.4 ? 0 : s < 4.2 ? (s - 3.4) / 0.8 : s < 4.5 ? 1 : s < 5.4 ? 1 - (s - 4.5) / 0.9 : 0;
    if (e.ph === 7 && s > 4.4) {                                                   // unter Schwarz: zurück zum Start, Aufräumen, Snapshot
      e.ph = 8; const def = this.run.def, S = this.snap; this.abort(false); const f = S && S.spawn ? S.spawn : World.freeSpot(G.city.landmarks.t.center.x, G.city.landmarks.t.center.y);
      p.x = f.x; p.y = f.y; p.vx = p.vy = 0; p.hp = p.maxHp; p.dodge = 0; e.fell = false; G.cam.x = p.x; G.cam.y = p.y; Police.standDown(true); G.wanted.pts = 0; G.wanted.level = 0; G.hurtFlash = 0;
      this.offer(def, false); this.say([['MANDAT', MIS_TEXT.again[0]]]); this.exec.def = def;
    }
    if (s > 5.4) { this.exec = null; black.style.opacity = 0; fx.className = ''; this.setLetterbox(false); }
  },
  // Tod im Mandat: nach der Wiederbelebung (unter Schwarz) Mandat abbrechen und am Startauge neu anbieten
  onRespawn() { if (this.run && !this.exec) { const def = this.run.def; this.abort(false); this.offer(def, false); this.say([['MANDAT', MIS_TEXT.again[1]]]); } },
  setLetterbox(on) { const el = document.getElementById('letterbox'); if (el) el.classList.toggle('on', !!on); },
  glitch(sec) { const fx = document.getElementById('execFx'); if (!fx || this.exec) return; fx.className = 'glitch'; setTimeout(() => { if (!this.exec) fx.className = 'fade'; }, sec * 1000); },
  // ---- Skripte ----
  runScript(name, ev, step) {
    const tgt = G.tags[ev.target];
    if (name === 'ambientExecution' && tgt) this.scripts.push({ name, e: tgt, t: 0 });
    else if (name === 'fleeToVehicle' && tgt && G.tags[ev.vehicle]) this.scripts.push({ name, e: tgt, v: G.tags[ev.vehicle], t: 0 });
  },
  updateScripts() {
    for (let i = this.scripts.length - 1; i >= 0; i--) {
      const S = this.scripts[i], e = S.e; S.t++;
      if (S.name === 'ambientExecution') {                                          // Passant erstarrt, Piepen, Entladung, Sturz – ohne Fahndung
        if (S.t === 1) { e.frozen = 999; e.standing = true; Aud.play('vollstreckung', { x: e.x, y: e.y, gain: 0.9, cat: 'sfx' }); }
        if (S.t > 84 && S.t < 120) e.a += Math.sin(S.t * 2) * 0.1;
        if (S.t === 84) { sparks(e.x, e.y - 3, 18, '#9fe8ff', 6); glow(e.x, e.y, 30, '#9fe8ff', 8); Lights.add(e.x, e.y, 110, '#9fe8ff', 1); }
        if (S.t === 120) { e.state = 'dead'; e.hp = 0; e.deadT = G.time; e.frozen = 0; pedStopScream(e, 0.01); Ground.decal({ t: 'splat', x: e.x, y: e.y, rot: rand(0, TAU), s: 0.6, v: 0 }); this.scripts.splice(i, 1); }
      } else if (S.name === 'fleeToVehicle') {                                      // Händler rennt zum Van, steigt ein, Van fährt los
        const dx = S.v.x - e.x, dy = S.v.y - e.y, d = Math.hypot(dx, dy); e.state = 'flee'; e.frozen = 0; e.panic = 60; e.standing = false;
        if (d > 22 && S.t < 420) { e.x += dx / d * 2.1; e.y += dy / d * 2.1; e.a = Math.atan2(dy, dx); e.walk += 2; e.vx = e.vy = 0; if (S.t % 40 === 0) bark(e, 'Nicht mit mir!', 90); }
        else { const ix = G.peds.indexOf(e); if (ix >= 0) G.peds.splice(ix, 1); const v = S.v; v.ai = { fast: 0.9 }; v.keep = true; v.engine = true; v.locked = true; v.mis = Object.assign(v.mis || {}, { mode: 'flee' }); honk(v); this.scripts.splice(i, 1); }
      }
    }
  },
  // ---- Hauptschleife ----
  update() {
    const p = G.player; if (!p || G.state !== 'play') return;
    if (this.exec) { this.updateExec(); }
    if (G.respawn) return;
    if (this.autoT > 0 && --this.autoT === 0 && !this.run) this.accept(MISSIONS.M00);
    this.updateScripts(); if (this.startCd > 0) this.startCd--;
    const run = this.run;
    if (!run) { this.updateIdle(); return; }
    if (this.exec) { this.hud(); return; }
    run.tick++; const st = run.step, sst = run.sst; sst.t++; this.prompt(null);
    // Frist + Warnungen
    if (run.left > 0 && st.t !== 'cutscene') {
      run.left--; const sec = Math.ceil(run.left / 60);
      for (const w of [60, 30, 10]) if (sec === w && !run.warned[w]) { run.warned[w] = true; HUD.say('MANDAT', MIS_TEXT.frist[w], '#ff3fa4'); this.beep(w === 10 ? 1600 : 1200, 3); }
      if (sec <= 10 && run.left % 60 === 0) this.beep(1500, 1);
      if (run.left === 0) { this.fail('deadline'); return; }
    }
    if (sst.left > 0) { sst.left--; if (sst.left === 0) { this.fail('steptime'); return; } }
    this.stepLogic(run, st, sst); if (!this.run || this.exec) return;
    // Fehlerbedingungen
    for (const f of st.fail || []) { const m = /^destroyed:(.+)$/.exec(f); if (m) { const v = G.tags[m[1]]; if (v && (v.dead || (v.burn > 0 && v.hp <= 0))) { this.fail('destroyed'); return; } } }
    // Ereignisse
    for (let k = 0; k < (st.events || []).length; k++) {
      const ev = st.events[k]; if (sst.fired[k]) continue; const w = ev.when || {}; let go = false;
      if (w.progress !== undefined) go = sst.prog >= w.progress; else if (w.time !== undefined) go = sst.t >= w.time * 60 + 1;
      else if (w.near) { const e = G.tags[w.near]; go = !!e && Math.hypot(e.x - p.x, e.y - p.y) < (w.r || 300); }
      if (!go) continue; sst.fired[k] = true; if (ev.spawn) this.spawn(ev.spawn, st); if (ev.say) this.say(ev.say); if (ev.script) this.runScript(ev.script, ev, st);
    }
    if (G.time % 6 === 0) this.hud();
    if (G.time % 10 === 0 && st.t !== 'cutscene') this.navi();
  },
  stepLogic(run, st, sst) {
    const p = G.player, tp = this.targetPos();
    if (st.t === 'cutscene') { if (sst.t >= st.secs * 60) { this.setLetterbox(false); this.stepDone(); } return; }
    if (st.t === 'goto') {
      if (!tp) return; const d = Math.hypot(tp.x - p.x, tp.y - p.y); if (!sst.d0) sst.d0 = Math.max(1, d); sst.prog = clamp(1 - d / sst.d0, 0, 1);
      const okVeh = !st.vehicleTag || p.veh === G.tags[st.vehicleTag]; if (d < st.r && okVeh) this.stepDone();
    } else if (st.t === 'enter') { if (p.veh && p.veh === G.tags[st.tag]) this.stepDone(); }
    else if (st.t === 'deliver') {
      const v = G.tags[st.tag]; if (!tp || !v) return; const d = Math.hypot(tp.x - v.x, tp.y - v.y); if (!sst.d0) sst.d0 = Math.max(1, d); sst.prog = Math.max(sst.prog, clamp(1 - d / sst.d0, 0, 1));
      if (d < st.r) { if (st.minHp && v.hp < st.minHp * v.maxHp) { HUD.say('MANDAT', 'Die Ware ist beschädigt. Das ist nicht akzeptabel.', '#ff3fa4'); this.fail('damaged'); return; } this.stepDone(); }
    } else if (st.t === 'talk') {
      const e = G.tags[st.tag]; if (!e) return; const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (e.state === 'dead') { this.fail('killed'); return; }
      if (d < 60 && !p.veh) { this.prompt('[E] ' + (st.pay ? 'Kassieren' : 'Ansprechen')); if (G.in.interactP && this.startCd <= 0) { this.say(st.say); if (st.pay) { G.credits = (G.credits || 0) + st.pay; floatText(e.x, e.y - 24, MIS_TEXT.reward(st.pay), '#ffd84a', 13); Aud.play('kasse', { gain: 0.8, cat: 'ui', bus: 'ui' }); } this.stepDone(); } }
    } else if (st.t === 'destroy') { if (st.tags.every(t => { const e = G.tags[t]; return !e || e.dead || e.hp <= 0; })) this.stepDone(); }
    else if (st.t === 'chase') {
      const v = G.tags[st.tag]; if (!v) { this.stepDone(); return; } sst.prog = 1 - v.hp / v.maxHp;
      if (v.hp <= st.surrenderAt * v.maxHp || v.dead || (sst.t > 60 && Math.hypot(v.vx, v.vy) < 0.4 && Math.hypot(v.x - p.x, v.y - p.y) < 90)) { v.ai = null; v.keep = false; if (v.mis) v.mis.mode = null; v.vx *= 0.3; v.vy *= 0.3; this.stepDone(); }
    } else if (st.t === 'hold') {
      if (!tp) return; const d = Math.hypot(tp.x - p.x, tp.y - p.y); const inside = d < st.r && (!st.foot || !p.veh);
      if (st.foot && p.veh && d < st.r) this.prompt('[E] Aussteigen');
      if (inside) { if (++sst.hold >= st.secs * 60) this.stepDone(); } else sst.hold = Math.max(0, sst.hold - 2);
    }
  },
  // Leerlauf: Push-Timer, Anruf, Annehmen am Markierungsauge, Terminal, Sprüche
  updateIdle() {
    const p = G.player; let pr = false;
    if (!this.offerDef && this.pushDef && this.pushT > 0 && --this.pushT === 0 && !G.respawn && !G.inside) this.offer(this.pushDef);
    if (this.offerDef) {
      const P = this.startPos(this.offerDef); this.offerPos = P; if (P) { const d = Math.hypot(P.x - p.x, P.y - p.y); if (d < 90 && !p.veh) { this.prompt(MIS_TEXT.accept); pr = true; if (G.in.interactP) { this.startCd = 20; this.accept(this.offerDef); } } }
      if (G.time % 20 === 0) this.navi();
    } else {
      const nx = this.nextDef(), T = G.city.landmarks.t.center;
      if (nx && nx.push && !this.pushDef) { this.pushDef = nx; this.pushT = nx.push.after ? nx.push.after * 60 : 1; }
      if (nx && !p.veh && Math.hypot(T.x - p.x, T.y - p.y) < 150) { this.prompt(MIS_TEXT.terminalKey + ' · ' + MIS_TEXT.terminal); pr = true; if (G.in.interactP) { this.startCd = 20; this.offer(nx); } }
      if (!G.in.interactP && --this.ambT <= 0) { this.ambT = 60 * (180 + Math.floor(rand(0, 120))); HUD.say('MANDAT', pick(MIS_TEXT.ambient), '#ff3fa4'); }
    }
    if (!pr) this.prompt(null);
  },
  prompt(t) { const el = document.getElementById('misPrompt'); if (!el) return; if (t) { el.textContent = t; el.classList.add('on'); } else el.classList.remove('on'); this.promptOn = !!t; },
  beep(f, n) { if (!Aud.ac) return; for (let i = 0; i < n; i++) setTimeout(() => Aud.beep && Aud.beep(f, 0.09, 0.25), i * 160); },
  // ---- Navi-Route (BFS auf Kacheln, alle 0,5 s), Marker, HUD ----
  navigate(from, to) {
    const W = World.W, H = World.H, T = C.TILE, sx = Math.floor(from.x / T), sy = Math.floor(from.y / T), gx = Math.floor(to.x / T), gy = Math.floor(to.y / T);
    const prev = new Int32Array(W * H).fill(-1), q = [sy * W + sx]; prev[q[0]] = q[0]; const goal = gy * W + gx;
    for (let h = 0; h < q.length && prev[goal] < 0; h++) { const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (prev[j] >= 0) continue; const k = World.tiles[j]; if (k === TK.WATER || World.solid[j]) continue; prev[j] = i; q.push(j); } }
    if (prev[goal] < 0) return []; const out = []; for (let i = goal; i !== prev[i] && out.length < 800; i = prev[i]) out.push({ x: (i % W + 0.5) * T, y: ((i / W | 0) + 0.5) * T }); out.reverse();
    return out;
  },
  navi() {
    const p = G.player; let tgt = null; if (this.run) tgt = this.targetPos(); else if (this.offerDef) tgt = this.offerPos || this.startPos(this.offerDef);
    this.tgt = tgt; if (!tgt || (G.inside)) { this.route = []; return; }
    this.route = this.navigate(p, tgt);
  },
  hud() {
    const el = document.getElementById('mis'); if (!el) return; const r = this.run;
    if (!r && !this.offerDef) { el.classList.remove('on'); const hn0 = document.getElementById('hint'); if (hn0) hn0.textContent = STR.hint.play + (DEBUG ? '\n' + STR.hint.debug : ''); return; }
    el.classList.add('on'); const st = r ? r.step : null, def = r ? r.def : this.offerDef;
    document.getElementById('misTitle').textContent = (r ? 'MANDAT ▸ ' : 'MANDAT ANGEBOT ▸ ') + def.title.toUpperCase();
    document.getElementById('misGoal').textContent = r ? (st.hud || '') : MIS_TEXT.reoffer;
    const t = document.getElementById('misTime'); if (r && r.left > 0 && st.t !== 'cutscene') { const s = Math.ceil(r.left / 60); t.textContent = MIS_TEXT.deadlineLbl + ' ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); t.style.display = ''; t.classList.toggle('low', s <= 30); } else t.style.display = 'none';
    const p = G.player, tp = this.tgt || (r ? this.targetPos() : null), dEl = document.getElementById('misDist');
    if (tp && p) { const dx = tp.x - p.x, dy = tp.y - p.y; dEl.style.display = ''; document.getElementById('misArrow').style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`; document.getElementById('misMeters').textContent = Math.round(Math.hypot(dx, dy) / 8) + ' m'; } else dEl.style.display = 'none';
    const hn = document.getElementById('hint'); if (hn) hn.textContent = (r && r.step.hint ? r.step.hint : STR.hint.play) + (DEBUG ? '\n' + STR.hint.debug : '');
  },
  // Welt-Overlay (additiv): Zielring, Markierungsauge, Route
  drawWorld() {
    const p = G.player; if (!p || G.state !== 'play') return; const t = G.time;
    const tp = this.run ? this.targetPos() : this.offerDef ? (this.offerPos || this.startPos(this.offerDef)) : null; this.tgt = tp;
    if (this.route.length > 1 && !G.inside) {                                          // Route: Strichlinie 640 px voraus
      ctx.strokeStyle = '#ff3fa4'; ctx.globalAlpha = 0.55; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -(t * 0.6);
      let i0 = 0, bd = 1e12; for (let i = 0; i < this.route.length; i++) { const d = (this.route[i].x - p.x) ** 2 + (this.route[i].y - p.y) ** 2; if (d < bd) { bd = d; i0 = i; } }
      ctx.beginPath(); ctx.moveTo(p.x, p.y); for (let i = i0 + 1; i < Math.min(this.route.length, i0 + 14); i++) ctx.lineTo(this.route[i].x, this.route[i].y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (!tp) return; const eye = !this.run;
    const pul = 0.5 + 0.5 * Math.sin(t * 0.1), col = eye ? '#ff3fa4' : '#3fe8ff';
    ctx.globalAlpha = 0.5 + 0.3 * pul; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tp.x, tp.y, 38 + pul * 10, 0, TAU); ctx.stroke();
    ctx.drawImage(glowSprite(col), tp.x - 60, tp.y - 60, 120, 120); ctx.globalAlpha = 1; Lights.add(tp.x, tp.y, 150, col, 0.8);
    if (eye) {                                                                         // Markierungsauge: Mandat wartet
      ctx.save(); ctx.translate(tp.x, tp.y - 34 - pul * 4); ctx.fillStyle = '#12020c'; ctx.strokeStyle = '#ff3fa4'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(0, -16, 18, 0); ctx.quadraticCurveTo(0, 16, -18, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff3fa4'; ctx.beginPath(); ctx.arc(Math.sin(t * 0.03) * 3, 0, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#12020c'; ctx.beginPath(); ctx.arc(Math.sin(t * 0.03) * 3, 0, 2.4, 0, TAU); ctx.fill(); ctx.restore();
    } else { ctx.save(); ctx.translate(tp.x, tp.y - 54 - pul * 5); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-10, -4); ctx.lineTo(10, -4); ctx.closePath(); ctx.fill(); ctx.restore(); }
  },
  radarDot(dot) { const tp = this.tgt; if (tp) dot(tp.x, tp.y, (G.time >> 3) & 1 ? '#ff3fa4' : '#ffffff'); }
};

// Steuerung für Mandats-Fahrzeuge: 'ram' (Plünderer rammen das Ziel); 'flee' nutzt den Verkehrsregler (v.ai.fast) in 08-vehicles.js
function missionCtl(v) {
  if (v.mis.mode === 'flee') {                                                   // Flucht: auf der Straße dem Verkehrsregler folgen (schneller), sonst zur nächsten Fahrbahn lenken
    const L = tileLane(v.x, v.y), spd0 = Math.hypot(v.vx, v.vy);
    if (L && !(v.mfree > 0)) return trafficCtl(v);
    if (v.mfree === undefined || v.mfree <= 0) { let best = null, bd = 1e9; for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const x = v.x + dx * C.TILE, y = v.y + dy * C.TILE, Lk = tileLane(x, y); if (Lk && !Lk.junction && !World.blocked(x, y, 20, true)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x, y }; } } } v.mgo = best; v.mfree = 20; }
    v.mfree--; const tg = v.mgo || { x: v.x + Math.cos(v.a) * 100, y: v.y + Math.sin(v.a) * 100 }, e = angDiff(v.a, Math.atan2(tg.y - v.y, tg.x - v.x)); v.mstuck = spd0 < 0.4 ? (v.mstuck || 0) + 1 : 0;
    if (v.mstuck > 50) { v.mrev = 45; v.mstuck = 0; } if (v.mrev > 0) { v.mrev--; return { thr: -1, steer: e > 0 ? -1 : 1, hb: false, boost: false }; }
    return { thr: spd0 < 3.5 ? 0.9 : 0, steer: clamp(e * 2.2, -1, 1), hb: false, boost: false };
  }
  const m = v.mis, D = VEHICLES[v.cls], spd = Math.hypot(v.vx, v.vy), tgt0 = G.tags[m.target] || (G.player.veh || G.player), tgt = { x: tgt0.x + (tgt0.vx || 0) * 10, y: tgt0.y + (tgt0.vy || 0) * 10 };
  const dist = Math.hypot(tgt.x - v.x, tgt.y - v.y); v.mrev = v.mrev || 0; v.mstuck = v.mstuck || 0;
  if (G.time - Flow.t >= 15) Flow.build(G.player.x, G.player.y);
  let wp = dist > 240 ? Flow.next(v.x, v.y, true) : null; if (!wp) wp = tgt;
  if (v.mrev > 0) { v.mrev--; const e = angDiff(v.a, Math.atan2(wp.y - v.y, wp.x - v.x)); return { thr: -1, steer: e > 0 ? -1 : 1, hb: false, boost: false }; }
  const err = angDiff(v.a, Math.atan2(wp.y - v.y, wp.x - v.x)); v.mstuck = spd < 0.5 ? v.mstuck + 1 : 0; if (v.mstuck > 70) { v.mrev = 55; v.mstuck = 0; }
  const want = D.top * 0.92 * (1 - Math.min(0.5, Math.abs(err) * 0.35));
  return { thr: spd < want ? 1 : spd > want + 1 ? -0.5 : 0.1, steer: clamp(err * 2.4, -1, 1), hb: false, boost: false };
}
