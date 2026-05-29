# Il Metrone — Custoza, Verona

Sito ufficiale di **Il Metrone**, dimora di campagna nelle colline di Custoza (Verona).

> Anteprima sostitutiva del vecchio sito Weebly — modern stack, multilingua (IT/EN/DE), prenotazione diretta integrata con Google Calendar.

## Struttura

```
ilmetronecustoza/
├── index.html              # Home + tutte le sezioni (one-page)
├── book.html               # Pagina prenotazione (calendario + form)
├── 404.html
├── style.css               # Design system principale
├── i18n/
│   ├── it.json             # Italiano (default)
│   ├── en.json             # English
│   └── de.json             # Deutsch
├── js/
│   ├── i18n.js             # Loader traduzioni
│   └── main.js             # Nav, mobile menu, reveal, lightbox
├── booking-engine/
│   ├── calendar.js         # Widget calendario + form (port da Villa Volpe)
│   └── styles.css          # Stili widget (palette terracotta)
└── images/
    ├── favicon.svg
    ├── hero/               # Foto hero (hero-1.jpg ...)
    └── gallery/            # 01.jpg … 06.jpg per la galleria
```

## Tech stack

- HTML statico, CSS custom, Vanilla JS
- Font: **Cormorant Garamond** (display) + **Inter** (body)
- Palette: terracotta `#8E3A2A` + verde oliva `#6B7A4B` + crema `#FBF5EE`
- i18n via `data-i18n` attribute + JSON files
- Booking: legge Google Calendar pubblico, invia richieste a Apps Script

## Configurazione booking

In `booking-engine/calendar.js` aggiornare:

```js
const BOOKING_CONFIG = {
  calendarId: '9cfddfe8...@group.calendar.google.com',  // già impostato
  apiKey: 'REPLACE_WITH_GOOGLE_CALENDAR_API_KEY',       // ← generare
  webAppUrl: 'REPLACE_WITH_APPS_SCRIPT_WEB_APP_URL',    // ← deploy del BookingHandler.gs
  minNights: 2,
  maxGuests: 6,
  email: 'metronecustoza@gmail.com'
};
```

Lo script Google Apps `BookingHandler.gs` è quello già esistente nella cartella `metroni-custoza-calendar/`.

## Preview locale

```bash
python3 -m http.server 8000
# poi: http://localhost:8000
```

## Da fare

- [ ] Sostituire immagini placeholder con foto dal Drive del cliente
- [ ] Rifinire testi delle sezioni in base ai contenuti del sito Weebly originale
- [ ] Aggiungere API key Google Calendar
- [ ] Deploy del BookingHandler.gs come web app e incollare URL in `calendar.js`
- [ ] Verifica telefono/email reali del cliente nei `contact` blocks
- [ ] Aggiungere social link Instagram reale
- [ ] Privacy Policy + Termini

## Deploy

GitHub Pages: Settings → Pages → Branch `main` → `/ (root)` → Save.
URL preview: `https://CryptoPannoz.github.io/ilmetronecustoza/`
