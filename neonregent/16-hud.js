'use strict';
// 16-hud.js - DOM-HUD (PLAN §5.7): Vital, Treuechip, Credits, Fahndung, Distrikt, Banner, Pager (Schreibmaschine), Lautstärke-Regler, Debug-Box.
// Radar, Vollkarte, Läden, Pause-Reiter folgen mit ihren Meilensteinen. Exportiert: $, HUD

const $ = id => document.getElementById(id);

function puText() { let t = ''; for (const k in G.pu) if (G.pu[k] > 0) t += ' · ' + POWERUPS[k].name + ' ' + Math.ceil(G.pu[k] / 60) + 's'; return t; }
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
  // Radar (unten rechts, Norden oben): Ausschnitt der vorgerenderten Minikarte, 2 px je Kachel (PLAN §5.8)
  // Pause: Sammlung der Fundstücke
  finds() {
    const el = $('findsList'), n = Object.keys(G.finds).length;
    el.innerHTML = `<b>FUNDSTÜCKE ${n}/${FUNDE.length}</b> · Credits gesamt aus Beute: ${G.stats.cr}<br>` + (n ? FUNDE.filter(f => G.finds[f.id]).map(f => `<i>${f.n}</i> ×${G.finds[f.id]} – ${f.t}`).join('<br>') : 'Noch nichts gefunden. Durchsuche Spinde, Schubladen und Kühlschränke in begehbaren Gebäuden (Türen leuchten warm).');
  },
  weaponFlash() { const c = $('wpnCard'); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 400); },
  track(name) { const el = $('nowPlaying'); el.textContent = '♪ ' + name; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 5000); },
  radar() {
    const p = G.player, cv = $('radar'); if (!p || !World.mini) return;
    const g = cv.getContext('2d'), S = cv.width, N = S / 2, tx = p.x / C.TILE, ty = p.y / C.TILE;
    g.imageSmoothingEnabled = false; g.fillStyle = '#060912'; g.fillRect(0, 0, S, S);
    g.drawImage(World.mini, tx - N / 2, ty - N / 2, N, N, 0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.0)';
    for (const gr in G.gates) if (!World.gateOpen(gr)) for (const r of G.gates[gr]) { g.fillStyle = '#ff3b4a'; g.fillRect(((r.x0 + r.x1) / 2 / C.TILE - tx + N / 2) * 2 - 2, ((r.y0 + r.y1) / 2 / C.TILE - ty + N / 2) * 2 - 2, 5, 5); }
    g.fillStyle = '#ffd84a'; for (const b of Interiors.list) { const d = b._door, dx = (d.x / C.TILE - tx + N / 2) * 2, dy = (d.y / C.TILE - ty + N / 2) * 2; if (dx > 2 && dx < S - 2 && dy > 2 && dy < S - 2) g.fillRect(dx - 1.5, dy - 1.5, 3, 3); }   // Türen begehbarer Gebäude
    const blink = (G.time >> 3) & 1, dot = (x, y, col) => { const dx = (x / C.TILE - tx + N / 2) * 2, dy = (y / C.TILE - ty + N / 2) * 2; if (dx > 2 && dx < S - 2 && dy > 2 && dy < S - 2) { g.fillStyle = col; g.fillRect(dx - 2, dy - 2, 4, 4); } };
    if (G.wanted && G.wanted.level > 0) { for (const q of G.peds) if (q.team === 'od' && q.state !== 'dead') dot(q.x, q.y, blink ? '#ff3b4a' : '#4a8cff'); for (const v of G.vehicles) if (v.od && !v.dead) dot(v.x, v.y, blink ? '#4a8cff' : '#ff3b4a'); for (const d of G.drones) dot(d.x, d.y, '#e8f4ff'); }
    g.save(); g.translate(S / 2, S / 2); g.rotate(p.a); g.fillStyle = '#5fd4e6'; g.strokeStyle = '#04121a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 5); g.lineTo(-3, 0); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke(); g.restore();
  },
  // Vollkarte (Tab): ganze Stadt, Distrikte, Dienste, Landmarken, Spieler, geschlossene Tore
  map() {
    const cv = $('mapCanvas'), g = cv.getContext('2d'), k = cv.width / World.W;
    g.imageSmoothingEnabled = false; g.drawImage(World.mini, 0, 0, cv.width, cv.height);
    g.font = '900 11px "Arial Black", "Arial Bold", Verdana, "DejaVu Sans", sans-serif'; g.textAlign = 'center';
    for (const d of DISTRICTS) { g.fillStyle = 'rgba(168,246,255,0.55)'; g.fillText(d.name, (d.c0 + d.c1 + 1) / 2 * C.CELL * k, 11); }
    for (const l in G.city.landmarks) { const m = G.city.landmarks[l]; if (LANDMARKS[l].kind === 'plaza') continue; g.fillStyle = '#ffd84a'; g.fillText('✦', m.center.x / C.TILE * k, m.center.y / C.TILE * k + 4); }
    g.fillStyle = '#ff3fa4'; for (const s of G.city.services) { const b = G.buildings[s.building]; g.fillRect((b.x0 + b.x1) / 2 / C.TILE * k - 2, (b.y0 + b.y1) / 2 / C.TILE * k - 2, 4, 4); }
    for (const gr in G.gates) if (!World.gateOpen(gr)) for (const r of G.gates[gr]) { g.fillStyle = '#ff3b4a'; g.fillRect((r.x0 + r.x1) / 2 / C.TILE * k - 2, (r.y0 + r.y1) / 2 / C.TILE * k - 5, 4, 10); }
    const p = G.player; if (p) { g.fillStyle = '#5fd4e6'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x / C.TILE * k, p.y / C.TILE * k, 4.5, 0, TAU); g.fill(); g.stroke(); }
  },
  update() {
    const p = G.player; if (!p) return;
    const f = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
    $('hpFill').style.width = f; $('hpGhost').style.width = f; $('hpFill').classList.toggle('low', p.hp < p.maxHp * 0.3);
    $('credVal').textContent = (G.credits || 0).toLocaleString('de-DE');
    const lvl = G.wanted ? G.wanted.level : 0, hs = $('heat').children; for (let i = 0; i < hs.length; i++) hs[i].classList.toggle('on', i < lvl); $('heat').classList.toggle('seen', lvl > 0 && G.wanted.seen); $('hiddenTag').textContent = lvl > 0 && !G.wanted.seen ? STR.police.hidden : '';
    $('chipTag').textContent = STR.chip.on; $('district').textContent = 'HALOGEN · ' + (G.district ? G.district.name : '');
    const v = p.veh, vc = $('vehCard'); vc.style.display = v ? 'flex' : 'none';
    if (v) { $('vehName').textContent = VEHICLES[v.cls].name; $('vehFill').style.width = clamp(v.hp / v.maxHp, 0, 1) * 100 + '%'; $('boostFill').style.width = v.boost + '%'; }
    $('tbEnter').textContent = v ? 'AUSSTEIGEN' : (G.nearVeh ? 'EINSTEIGEN' : 'EIN / AUS'); $('tbAct').textContent = v ? 'BREMSE' : 'ROLLE'; $('tbSprint').textContent = v ? 'BOOST' : 'SPRINT'; $('tbHorn').style.display = v ? '' : 'none';
    const W = WEAPONS[G.weapon]; $('wpnName').textContent = W.name; $('wpnAmmo').textContent = (W.melee ? (isTouch ? '' : '[LMB / J]') : '▮ ' + (G.ammo[G.weapon] || 0)) + (G.armor > 0 ? ' · WESTE ' + Math.ceil(G.armor) : '') + puText(); $('tbFire').textContent = W.melee ? 'SCHLAG' : 'FEUER'; $('tbSwap').style.display = Object.keys(G.own).length > 1 && isTouch ? 'flex' : 'none';
    const I = Interiors.cur; $('place').classList.toggle('on', !!I); if (I) $('placeName').textContent = I.name;
    const nf = Object.keys(G.finds).length; $('findVal').textContent = nf + '/' + FUNDE.length; $('tbUse').style.display = G.near && isTouch ? 'flex' : 'none';
    this.radar();
    if (DEBUG) {
      const tx = Math.floor(p.x / C.TILE), ty = Math.floor(p.y / C.TILE);
      $('debugBox').textContent = `rAF ${G.rafMs.toFixed(1)} ms · Q ${G.quality.toFixed(2)} · tick ${G.time}\nTeile ${G.parts.length} · Lichter ${Lights.list.length} · Stimmen ${Aud.active.length}\nKachel ${tx},${ty} · Pos ${p.x | 0},${p.y | 0}\nKlangbank ${Aud.bakeLog.n} Klänge${Aud.bakeLog.done ? ' (' + Aud.bakeLog.ms.toFixed(0) + ' ms)' : ' …'} · ${Aud.ac ? Aud.ac.state : 'kein Audio'}`;
    }
  }
};
