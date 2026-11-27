'use strict';
// 13-story.js - Alle sichtbaren Texte (Deutsch, PLAN R6) und später MISSIONS (aus STORY.md), Ticker, Datenchips, Erben-Liste.
// Exportiert: STR (MS0: nur Oberfläche und Debug); MISSIONS folgt in MS8.

const STR = {
  title: 'NEON REGENT',
  chip: { on: '● TREUECHIP AKTIV', glitch: '◌ TREUECHIP GESTÖRT', off: '○ TREUECHIP STUMM' },
  district: { test: 'HALOGEN' },
  status: { baking: 'Klangbank wird gebacken …', ready: n => `Klangbank bereit (${n} Klänge)`, recs: s => `Aufnahmen: ${s}`, norecs: 'Keine Aufnahmen im Bundle – synthetischer Rückfall' },
  hint: {
    play: 'WASD laufen · Maus zielen · LMB/J schlagen & schießen · Shift sprinten · Leertaste Rolle · Q Waffe · E Nehmen · Tab Karte',
    debug: 'B Explosion · V Schrei · N Überfahren · Z Panik · X Vollstreckung · K MANDAT'
  },
  banner: { start: 'HALOGEN', startSub: 'Nacht · Regen', paused: 'PAUSE', scene: n => `SZENE ${n}` },
  gate: 'PASSIERSCHEIN ERFORDERLICH',
  police: {
    levels: ['Der Ordnungsdienst ist informiert', 'Streifen rücken an – Waffen frei', 'Straßensperren und Drohnen', 'Sturmwagen im Anmarsch', 'Totale Ordnung'],
    radio: [
      ['Zentrale: Bürger 7741 hat die Ordnung gestört. Bitte höflich verhaften.', 'Zentrale: Ruhestörung mit Folgen. Verhaftung einleiten, Regenschirme bereithalten.'],
      ['Verdächtiger flüchtig. Streifen zu Position. Waffeneinsatz freigegeben.', 'Alle Streifen: Der Mandatsaugen-Treffer ist bestätigt. Zugriff.'],
      ['Straßensperren errichten. Drohne aufsteigen. Der Regent sieht alles.', 'Sperren voraus. Und bitte: nicht den Gegenverkehr erschießen. Nur diesen einen.'],
      ['Sturmwagen und Gunship angefordert. Papierkram folgt.', 'Verstärkung unterwegs. Mittagspause wurde gestrichen.'],
      ['Alle Einheiten: Tribunal-Protokoll. Aufgeben ist ab jetzt nicht mehr vorgesehen.']
    ],
    hidden: '◈ VERBORGEN', chipwash: ['Chip-Wäsche. Ihr Chip meldet: „Alles in Ordnung." Das tut er immer. Wir reiben ihn trotzdem ab.', 'Chip gereinigt. Sie waren nie hier. Wir waren nie hier. Niemand war irgendwo.']
  },
  // Passanten-Sprüche (Humor der Spielwelt): Alltag, Panik, Zeugen, Wiederaufstehen
  barks: {
    idle: ['Mein Treuechip juckt schon wieder.', 'Ich habe nichts getan! …Noch nicht.', 'Der Regent wacht. Der Regent wacht? Der Regent wacht.', 'Regen. Immer Regen. Danke, MANDAT.',
      'Dritte Woche, drittes Mandat. Ich werde zu gut.', 'Kennst du ein Nudelhaus ohne Chip-Rabatt?', 'Wenn ich schneller laufe, werde ich dann weniger nass?', 'Mein Schirm hat ein Abo. Der Regen auch.',
      'Haben die Laternen eigentlich Urlaub?', 'Ich schwöre, der Pfeil-Fahrer war gestern auch schon hier.', 'Heute Abend: Nudeln. Morgen: auch Nudeln. Übermorgen: Überraschung (Nudeln).', 'Pssst. Das Neonschild hört mit.',
      'Mein Chip piept. Ist das gut?', 'Ich bin kein Fan vom Regenten. Das darf ich laut sagen, oder?', 'Früher war mehr Lametta.', 'Wer hat die Nacht eigentlich so lang gemacht?'],
    panic: ['AAH!', 'Hilfe!', 'Nicht schon wieder!', 'Weg hier!', 'Mama!', 'Mein Schirm!', 'Ich zahle meine Steuern!', 'Das war nicht mein Mandat!'],
    witness: ['Das gibt Punktabzug!', 'Hat jemand das Kennzeichen?', 'Ich hab nichts gesehen. Ehrlich.', 'Der arme Kerl hatte noch Nudeln!', 'Das war ein Bürger! Mit Chip!'],
    getup: ['Autsch. Schon wieder.', 'Mein Rücken. Mein Schirm. Mein Tag.', 'Ich verklage … niemanden. Habe Angst.', 'Alles gut! Alles gut! Alles furchtbar.'],
    carjack: ['Hey! Mein Auto!', 'Ich zahle noch die Raten!', 'Das ist ein Leasing-Wagen!'],
    shop: ['Bitte keine Gewalt. Wir haben nur Nudeln.', 'Wir führen keine Waren, die Sie interessieren.', 'Ja? Nein. Doch. Nein.', 'Das Dach ist weg? Das war vorhin noch da.'],
    guest: ['Die Suppe ist Geschmackssache. Der Geschmack: Salz.', 'Psst. Der Wirt zählt dein Kleingeld.', 'Ich komme nur wegen der Musik. Und der Suppe. Und aus Angst.', 'Setz dich ruhig. Das ist nicht mein Hocker. Ehrlich.'],
    home: ['Der Fernseher läuft nur auf Kanal MANDAT.', 'Ich habe die Tür nicht abgeschlossen. Aus Prinzip. Und weil sie kaputt ist.', 'Ist das Dach nicht normalerweise … da?', 'Sprechen Sie leise. Die Wände haben Ohren. Und Chips.']
  },
  loot: { found: 'GEFUNDEN', empty: 'Leer. Nur Staub und ein Hauch Regent.', cr: n => `+${n} CR`, food: 'Fertignudeln: +VITAL' },
  place: 'INNENRAUM',
  voices: ['mann', 'frau', 'alt', 'jung']
};

// ------------------------------------------------------------------
// Missionen (STORY.md §5, Texte §6.1/6.2). t = Schritt-Typ; at = { lm, dx, dy } (Landmarke + Kacheln) | { tag } | { near:'player', min, max, onRoad }.
// failMode 'execute' = Vollstreckung, danach zurück zum Start (Mandat muss neu angenommen werden, Entscheidung D2); 'retry' = ohne Vollstreckung.
// ------------------------------------------------------------------
const MIS_TEXT = {
  header: 'MANDAT ▸ EINGEHEND', ok: ['Mandat erfüllt. Der Regent ist zufrieden.', 'Ihre Treue wurde vermerkt.', 'Ein erfülltes Mandat ist ein langes Leben.'],
  frist: { 60: 'Frist läuft ab: 60 Sekunden.', 30: '30 Sekunden.', 10: '10 Sekunden.' }, failLine: 'Mandat nicht erfüllt. Das Urteil wird vollstreckt.',
  execTitle: 'MANDAT NICHT ERFÜLLT', execSub: 'Nummer 7741 wurde vollstreckt.', okTitle: 'MANDAT ERFÜLLT', killed: 'AUSGELÖSCHT', killedSub: 'Das Mandat wurde nicht erfüllt',
  again: ['Nummer 7741. Ihr Mandat wurde neu aufgelegt. Bitte erscheinen Sie pünktlich.', 'Neue Ausgabe Ihres Chips: kostenlos. Ein zweites Mal ist nicht vorgesehen.'],
  reoffer: 'Mandat wartet. [E] am Markierungsauge annehmen.', accept: '[E] Mandat annehmen', terminal: 'MANDAT-TERMINAL – Nächstes Mandat anfordern?', terminalKey: '[E] Mandat anfordern', noMore: 'Derzeit liegen keine Mandate vor. Der Regent wacht.',
  ambient: ['Der Regent wacht.', 'Gehorsam ist Freiheit.', 'Melden Sie Unregelmäßigkeiten.', 'Treue zahlt sich aus.', 'Die Sperrstunde gilt für alle ohne Mandat.'],
  ambientExec: nr => `Bürger ${nr} – Mandat nicht erfüllt. Die Ordnung wurde wiederhergestellt.`, deadlineLbl: 'FRIST', reward: n => `+${n} CR`, acts: { 1: ['AKT I', 'GEHORSAM'] }
};
const MISSIONS = {
  M00: { id: 'M00', act: 0, title: 'Erwachen', giver: 'MANDAT', requires: [], push: false, start: { lm: 'k', dx: 0, dy: 6 }, deadline: 0, failMode: 'retry', auto: true,
    intro: { card: ['HALOGEN', '41 Jahre nach dem Feuertag'] },
    steps: [
      { t: 'cutscene', secs: 6, hud: 'Chip wird aktualisiert …',
        say: [['MANDAT', 'Guten Abend, Nummer 7741. Ihr Treuechip wurde aktualisiert.'], ['MANDAT', 'Der Regent hat Sie als Mandatsläufer ausgewählt. Das ist eine Ehre.']] },
      { t: 'goto', at: { lm: 'k', dx: 4, dy: 6 }, r: 60, hud: 'Geh zum markierten Wagen', hint: 'WASD laufen · Maus zielen',
        spawn: [{ kind: 'vehicle', type: 'kapsel', tag: 'zuteilung', at: { lm: 'k', dx: 5, dy: 6 }, paint: '#3fe8ff' }] },
      { t: 'enter', tag: 'zuteilung', hud: 'Steig ein', hint: 'F einsteigen' },
      { t: 'goto', at: { lm: 't' }, r: 110, vehicleTag: 'zuteilung', hud: 'Fahr zum MANDAT-Terminal', hint: 'W/S Gas/Bremse · A/D lenken · Leertaste Handbremse',
        spawn: [{ kind: 'ped', type: 'civ', tag: 'opfer', at: { lm: 't', dx: 1.5, dy: 1 }, ai: 'stand', immune: true }],
        events: [{ when: { near: 'opfer', r: 460 }, script: 'ambientExecution', target: 'opfer', say: [['MANDAT', 'Bürger 3390 – Mandat nicht erfüllt. Die Ordnung wurde wiederhergestellt.']] }] },
      { t: 'hold', at: { lm: 't' }, r: 70, secs: 1.5, foot: true, hud: 'Benutze das Terminal', hint: 'F aussteigen · am Terminal warten' },
      { t: 'cutscene', secs: 9, letterbox: false, hud: 'Einweisung',
        say: [['MANDAT', 'Jedes Mandat hat eine Frist. Erfüllen Sie es, und der Regent belohnt Sie.'], ['MANDAT', 'Scheitern Sie, und Ihr Treuechip vollstreckt das Urteil.'], ['MANDAT', 'Ihr erstes Mandat folgt in Kürze. Der Regent wacht.']] }
    ],
    reward: { cr: 200, flags: ['M00'] }, outro: [] },
  M01: { id: 'M01', act: 1, title: 'Lieferschein', giver: 'MANDAT', requires: ['M00'], push: { after: 60 }, start: { lm: 'a', dx: 0, dy: 5 }, deadline: 180, failMode: 'execute', actCard: ['AKT I', 'GEHORSAM'],
    call: [['MANDAT', 'Nummer 7741. Ein Container mit Medikamenten wartet an Dock 3.'], ['MANDAT', 'Bringen Sie ihn zur Chipklinik. Der Regent sorgt für seine Bürger.']],
    steps: [
      { t: 'enter', tag: 'laster', hud: 'Steig in den Laster', hint: 'F einsteigen', spawn: [{ kind: 'vehicle', type: 'laster', tag: 'laster', at: { lm: 'a', dx: 0, dy: 3 }, angle: 'road' }] },
      { t: 'deliver', tag: 'laster', at: { lm: 'k', dx: -6, dy: 0 }, r: 90, minHp: 0.5, time: 150, hud: 'Liefere den Container zur Chipklinik – mind. 50 % Zustand', hint: 'Der Laster ist schwer und träge. Vorsicht in den Kurven.', fail: ['destroyed:laster'],
        events: [{ when: { progress: 0.45 }, spawn: [{ kind: 'vehicle', type: 'pritsche', tag: 'pluenderer', count: 2, paint: '#6b6f3a', at: { near: 'player', min: 500, max: 700, onRoad: true }, ai: 'ram', target: 'laster' }], say: [['MANDAT', 'Plünderer. Fahren Sie weiter.']] }] },
      { t: 'cutscene', secs: 6, hud: 'Lieferung wird geprüft',
        say: [['ARBEITER', 'Medikamente? Auf den Kisten ist ein Schlüssel. „NOTARIAT · PRIVAT“ …'], ['MANDAT', 'Lieferung bestätigt. Fragen sind nicht Teil Ihres Mandats.']] }
    ],
    reward: { cr: 1000, flags: ['M01'] }, outro: [['MANDAT', 'Mandat erfüllt. Der Regent ist zufrieden.']] },
  M02: { id: 'M02', act: 1, title: 'Tributeintreibung', giver: 'MANDAT', requires: ['M01'], push: { after: 90 }, start: { lm: 'f', dx: 0, dy: 4 }, deadline: 180, failMode: 'execute',
    call: [['MANDAT', 'Nummer 7741. Drei Händler am Fischmarkt sind mit der Regentensteuer im Rückstand.'], ['MANDAT', 'Treiben Sie sie ein. Eine Dienstwaffe wurde Ihnen zugeteilt. Der Regent wacht.']],
    onStart: { give: { pistole: 120 } },
    steps: [
      { t: 'talk', tag: 'h1', hud: 'Kassiere bei Händler 1', hint: 'E sprechen',
        spawn: [{ kind: 'ped', type: 'haendler', tag: 'h1', at: { lm: 'f', dx: -3, dy: 0 }, ai: 'stand' }, { kind: 'ped', type: 'haendler', tag: 'h2', at: { lm: 'f', dx: 0, dy: -1 }, ai: 'stand' }, { kind: 'ped', type: 'haendler', tag: 'h3', at: { lm: 'f', dx: 3, dy: 0 }, ai: 'stand', immune: true },
          { kind: 'prop', type: 'stand', tag: 'stand3', at: { lm: 'f', dx: 3, dy: -1.6 } }, { kind: 'vehicle', type: 'kasten', tag: 'van3', at: { lm: 'f', dx: 4.5, dy: 2.5 }, paint: '#5a6a7a', immune: true },
          { kind: 'vehicle', type: 'od_streife', tag: 'zuschauer', at: { lm: 'f', dx: -4.5, dy: 3.5 }, ai: 'parked', crew: 'od' }],
        say: [['HÄNDLER', 'Hier … nimm. Sag ihnen, ich hab bezahlt.']], pay: 150 },
      { t: 'talk', tag: 'h2', hud: 'Kassiere bei Händlerin 2', say: [['HÄNDLERIN', 'Letztes Jahr waren es zweihundert. Jetzt sechshundert. Wer bekommt das alles?']], pay: 300 },
      { t: 'talk', tag: 'h3', hud: 'Kassiere bei Händler 3', say: [['HÄNDLER', 'Keinen Cent mehr! Sag deinem Regenten, er soll selbst kommen – wenn er kann!']], pay: 0 },
      { t: 'destroy', tags: ['stand3'], hud: 'Zerstöre seinen Stand', hint: 'LMB feuern', immune: true, say: [['MANDAT', 'Ein Exempel. Zerstören Sie seinen Stand.']], events: [{ when: { time: 0 }, script: 'fleeToVehicle', target: 'h3', vehicle: 'van3' }] },
      { t: 'chase', tag: 'van3', surrenderAt: 0.25, time: 120, immune: true, hud: 'Stell den Händler', hint: 'Rammen oder beschießen', say: [['MANDAT', 'Er flieht. Halten Sie ihn auf.'], ['SYS', 'Die Streife schaut weg.']] },
      { t: 'cutscene', secs: 6, hud: 'Tribut wird gebucht', say: [['HÄNDLER', 'Schon gut! Schon gut! Hier ist alles!'], ['MANDAT', 'Tribut eingezogen: 900 Credits. Ihr Anteil: 10 Prozent.']], onDone: { cr: 90 } }
    ],
    reward: { cr: 1500, flags: ['M02'] }, outro: [['MANDAT', 'Mandat erfüllt. Die Regentensteuer sichert unser aller Zukunft.']] }
};
const MIS_ORDER = ['M00', 'M01', 'M02'];
