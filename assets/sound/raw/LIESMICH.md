# Rohaufnahmen

Hier liegen die Takes als WAV oder FLAC (auch MP3/OGG möglich), ein Take pro Datei, benannt nach dem Schema
`<kategorie>_<sprecher>_<nr>.wav` – zum Beispiel `angst_m1_01.wav`, `stoehnen_f2_03.flac`, `ruf_a1_hilfe.wav`.

Kategorien: `angst`, `treffer`, `schmerz`, `stoehnen`, `ruf`, `brennen`, `keuchen`, `spieler`.
Jede Datei braucht eine Zeile in `../QUELLEN.md`. Danach: `python3 tools/sound-packer/pack.py`.
Anleitung: `docs/neon-regent/AUFNAHMEN.md`.
