'use strict';
// 16-hud.js - DOM-HUD (PLAN §5.7): Vital, Treuechip, Credits, Fahndung, Distrikt, Banner, Pager (Schreibmaschine), Lautstärke-Regler, Debug-Box.
// Radar, Vollkarte, Läden, Pause-Reiter folgen mit ihren Meilensteinen. Exportiert: $, HUD

const $ = id => document.getElementById(id);

const HUD = {
  bannerT: 0, pager: { q: [], cur: null, i: 0, hold: 0 },
  init() {
    // Lautstärke je Bus (Einstellungen) im Hauptmenü
    const names = { sfx: 'EFFEKTE', stimmen: 'STIMMEN', ambience: 'AMBIENTE', musik: 'MUSIK' };
    const box = $('volBox'); box.innerHTML = '';
    for (const b in names) {
      const l = document.createElement('label'), i = document.createElement('input');
      i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = Settings.d.vol[b];
      i.addEventListener('input', () => { Settings.d.vol[b] = +i.value; Settings.save(); if (Aud.ac) Aud.setVol(b, +i.value); });
      l.append(names[b], i); box.appendChild(l);
    }
    $('hint').textContent = STR.hint.play + (DEBUG ? '\n' + STR.hint.debug : '');
    $('hint').style.whiteSpace = 'pre-line';
    document.body.classList.toggle('debug', DEBUG);
  },
  banner(text, sub, ms = 2600) {
    const el = $('banner'); el.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); el.classList.add('on'); this.bannerT = ms / 1000 * 60;
  },
  // Pager (MANDAT magenta, VELA cyan, ??? weiß): Schreibmaschine 45 Zeichen/s, bleibt 2.5 s + 0.05 s/Zeichen (PLAN §5.7)
  say(who, text, color) { this.pager.q.push({ who, text, color: color || '#ff3fa4' }); },
  tick() {
    if (this.bannerT > 0 && --this.bannerT <= 0) $('banner').classList.remove('on');
    const P = this.pager, el = $('pager');
    if (!P.cur) {
      if (!P.q.length) { el.classList.remove('on'); return; }
      P.cur = P.q.shift(); P.i = 0; P.hold = 0; el.style.borderColor = P.cur.color; el.classList.add('on');
      el.innerHTML = `<span class="who" style="color:${P.cur.color}">${P.cur.who}</span><span id="pagerTxt"></span>`;
    }
    const full = P.cur.text.length;
    if (P.i < full) { P.i = Math.min(full, P.i + 45 / 60); $('pagerTxt').textContent = P.cur.text.slice(0, Math.floor(P.i)); }
    else if (++P.hold > (2.5 + 0.05 * full) * 60) P.cur = null;
  },
  update() {
    const p = G.player; if (!p) return;
    const f = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
    $('hpFill').style.width = f; $('hpGhost').style.width = f; $('hpFill').classList.toggle('low', p.hp < p.maxHp * 0.3);
    $('credVal').textContent = (G.credits || 0).toLocaleString('de-DE');
    const hs = $('heat').children; for (let i = 0; i < hs.length; i++) hs[i].classList.toggle('on', i < (G.heat || 0));
    $('chipTag').textContent = STR.chip.on; $('district').textContent = STR.district.test;
    if (DEBUG) {
      const tx = Math.floor(p.x / C.TILE), ty = Math.floor(p.y / C.TILE);
      $('debugBox').textContent = `rAF ${G.rafMs.toFixed(1)} ms · Q ${G.quality.toFixed(2)} · tick ${G.time}\nTeile ${G.parts.length} · Lichter ${Lights.list.length} · Stimmen ${Aud.active.length}\nKachel ${tx},${ty} · Pos ${p.x | 0},${p.y | 0}\nKlangbank ${Aud.bakeLog.n} Klänge${Aud.bakeLog.done ? ' (' + Aud.bakeLog.ms.toFixed(0) + ' ms)' : ' …'} · ${Aud.ac ? Aud.ac.state : 'kein Audio'}`;
    }
  }
};
