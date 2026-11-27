'use strict';
// 13-story.js - Alle sichtbaren Texte (Deutsch, PLAN R6) und später MISSIONS (aus STORY.md), Ticker, Datenchips, Erben-Liste.
// Exportiert: STR (MS0: nur Oberfläche und Debug); MISSIONS folgt in MS8.

const STR = {
  title: 'NEON REGENT',
  chip: { on: '● TREUECHIP AKTIV', glitch: '◌ TREUECHIP GESTÖRT', off: '○ TREUECHIP STUMM' },
  district: { test: 'HALOGEN' },
  status: { baking: 'Klangbank wird gebacken …', ready: n => `Klangbank bereit (${n} Klänge)`, recs: s => `Aufnahmen: ${s}`, norecs: 'Keine Aufnahmen im Bundle – synthetischer Rückfall' },
  hint: {
    play: 'WASD laufen · Maus zielen · Shift sprinten · Leertaste Rolle · Tab Karte · P Pause · M Ton',
    debug: 'B Explosion · V Schrei · N Überfahren · Z Panik · X Vollstreckung · K MANDAT'
  },
  banner: { start: 'HALOGEN', startSub: 'Nacht · Regen', paused: 'PAUSE', scene: n => `SZENE ${n}` },
  gate: 'PASSIERSCHEIN ERFORDERLICH',
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
