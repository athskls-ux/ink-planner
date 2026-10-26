# Ink Planner

A handwritten planner for pen tablets that turns your handwriting into searchable text, with Greek and English
recognition. It runs in the browser as an installable web app (PWA), with no account, server or cost.

- **Month, week and day pages** that you write on with a stylus; day pages have a 07:00–22:00 schedule.
- **Pen feel:** pressure-sensitive lines that calibrate to how hard you write, palm rejection (fingers scroll, the pen
  writes), stroke eraser, undo and redo.
- **Handwriting to text:** every word is recognised from the pen strokes, not from a picture of the page, and the
  result appears beside the page. It handles Greek and English mixed in one line.
- **Dictionary correction:** the recogniser's guesses are re-ranked with Greek and English word-frequency lists, missing
  Greek accents are restored (μετα → μετά), and every word you correct goes into a personal dictionary, so it
  learns your vocabulary.
- **Search** across everything you have written.
- **Works offline:** pages are stored on the device (IndexedDB) and recognised when you are back online. Backup and
  restore use a JSON file.

## Run it

It is a static site with no build step. Serve the folder with any web server, for example:

```bash
python -m http.server 8770
```

Then open `http://localhost:8770`. On Android, use **Add to Home screen** in Chrome to install it.

## How recognition works

1. Strokes are grouped into lines using the page ruling, and lines are split into words by horizontal gaps that scale
   with the size of your writing. Accents and dots are attached to the nearest word.
2. Each word is sent to Google's handwriting endpoint (the one behind Google Translate's handwriting input). It is free
   and fast, but it is **not an official, documented API** and may change or stop working.
3. The guesses are re-ranked by `js/lexicon.js`.

Words are sent one by one because the endpoint truncates whole lines after a few words.

## Roadmap

- On-device recognition with ML Kit Digital Ink (official, offline, supports Greek) in an Android wrapper.
- Two-way sync with Google Calendar.
- Sync of pages through the user's own Google Drive.
- More templates and collections (habit tracker, projects, lists).

## Credits

- Word lists in `data/` come from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
  (OpenSubtitles 2018), licensed CC BY-SA 4.0. See `NOTICE`.
- The planner layout is inspired by paper-style digital planners such as Remarkably Organized. No code or artwork was
  copied.

## License

MIT, see `LICENSE`. The word lists keep their own license (CC BY-SA 4.0).
