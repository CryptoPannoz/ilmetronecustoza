/**
 * ═══════════════════════════════════════════════════════════
 * 🌐 calendar.js — Booking Engine v2 (Il Metrone Custoza)
 * ═══════════════════════════════════════════════════════════
 *
 * Widget unificato: Calendario + Form ospiti + Policy + Conferma
 * Legge disponibilità da Google Calendar API,
 * evidenzia periodi liberi (min 2 notti),
 * invia richieste a BookingHandler.gs via doPost.
 *
 * Flusso: Calendar → Guests → Policy/Summary → Confirmation
 *
 * Fix inclusi:
 *   - CORS risolto con fetch/text-plain
 *   - Checkout day disponibile (checkout avviene la mattina)
 *   - Gap liberi evidenziati visivamente
 *   - i18n integrato (legge `window.i18n` se presente)
 * ═══════════════════════════════════════════════════════════
 */

// ── CONFIG (lato browser) ───────────────────────────────────
const BOOKING_CONFIG = {
  // Google Calendar pubblico — Il Metrone Custoza
  calendarId: '9cfddfe8fa84f5e592da10625ceb9f9a58629d23b47fe50d3fca97ed2fe6e798@group.calendar.google.com',
  // ⚠️ Sostituire con la propria API Key abilitata a Calendar API
  apiKey: 'REPLACE_WITH_GOOGLE_CALENDAR_API_KEY',
  // Web App URL del BookingHandler.gs di Il Metrone
  webAppUrl: 'REPLACE_WITH_APPS_SCRIPT_WEB_APP_URL',
  minNights: 2,
  maxNightsToShow: 29,
  maxGuests: 6,
  email: 'metronecustoza@gmail.com'
};

// Helper i18n — usa traduzioni se disponibili, fallback su stringa
function t(key, fallback) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    var v = window.i18n.t(key);
    if (v && v !== key) return v;
  }
  return fallback;
}

// Locale corrente (per formattazione date)
function currentLocale() {
  if (window.i18n && window.i18n.lang) {
    return { it: 'it-IT', en: 'en-US', de: 'de-DE' }[window.i18n.lang] || 'en-US';
  }
  return 'en-US';
}


// ── STATE ───────────────────────────────────────────────────

var state = {
  currentMonth: new Date(),
  checkInDate: null,
  checkOutDate: null,
  blockedDates: [],
  availableGaps: [],
  calendarLoaded: false,
  guestData: {
    name: '', email: '', phone: '',
    adults: 2, children: 0, pets: 'no', requests: ''
  }
};


// ── INIT ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  renderCalendar();
  setupEventListeners();
  loadBlockedDates();
  // Re-render se cambia lingua
  window.addEventListener('i18n:changed', function() { renderCalendar(); renderAvailableGapsList(); updateDateDisplay(); });
});


// ═══════════════════════════════════════════════════════════
// AVAILABLE GAPS
// ═══════════════════════════════════════════════════════════

function calculateAvailableGaps() {
  var today = new Date(); today.setHours(0,0,0,0);
  var endDate = new Date(today); endDate.setMonth(endDate.getMonth() + 12);

  state.availableGaps = [];
  var gapStart = null;
  var current = new Date(today);

  while (current <= endDate) {
    var dateStr = current.toISOString().split('T')[0];
    var blocked = state.blockedDates.indexOf(dateStr) >= 0;
    if (!blocked) {
      if (!gapStart) gapStart = new Date(current);
    } else {
      if (gapStart) {
        var gapEnd = new Date(current);
        var nights = Math.round((gapEnd - gapStart) / 86400000);
        if (nights >= BOOKING_CONFIG.minNights) {
          state.availableGaps.push({ start: new Date(gapStart), end: gapEnd, nights: nights });
        }
        gapStart = null;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  if (gapStart) {
    var nights2 = Math.round((endDate - gapStart) / 86400000);
    if (nights2 >= BOOKING_CONFIG.minNights) {
      state.availableGaps.push({ start: new Date(gapStart), end: new Date(endDate), nights: nights2 });
    }
  }
  renderAvailableGapsList();
}

function isInAvailableGap(date) {
  var d = new Date(date); d.setHours(0,0,0,0);
  for (var i = 0; i < state.availableGaps.length; i++) {
    var g = state.availableGaps[i];
    if (d >= g.start && d < g.end) return true;
  }
  return false;
}

function renderAvailableGapsList() {
  var container = document.getElementById('available-gaps');
  if (!container) return;
  if (state.availableGaps.length === 0) {
    container.innerHTML = '<p class="no-gaps">' + t('booking.noGaps', 'No available periods found. Please contact us directly.') + '</p>';
    return;
  }
  var suggestedNights = 4;
  var maxBlocks = 3;
  var blocks = [];
  var today = new Date(); today.setHours(0,0,0,0);

  for (var i = 0; i < state.availableGaps.length && blocks.length < maxBlocks; i++) {
    var gap = state.availableGaps[i];
    if (gap.end <= today) continue;
    var blockStart = gap.start < today ? new Date(today) : new Date(gap.start);
    while (blocks.length < maxBlocks) {
      var blockEnd = new Date(blockStart);
      blockEnd.setDate(blockEnd.getDate() + suggestedNights);
      if (blockEnd > gap.end) {
        var rem = Math.round((gap.end - blockStart) / 86400000);
        if (rem >= BOOKING_CONFIG.minNights) {
          blocks.push({ start: new Date(blockStart), end: new Date(gap.end), nights: rem, gapIndex: i });
        }
        break;
      }
      blocks.push({ start: new Date(blockStart), end: new Date(blockEnd), nights: suggestedNights, gapIndex: i });
      blockStart = new Date(blockEnd);
    }
  }

  var html = '';
  var nightsLabel = t('booking.nightsAvailable', 'nights available');
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    html += '<div class="gap-chip" data-gap-index="' + block.gapIndex + '" data-start="' + block.start.toISOString() + '">'
      + '<span class="gap-dates">' + formatDateShort(block.start) + ' → ' + formatDateShort(block.end) + '</span>'
      + '<span class="gap-nights">' + block.nights + ' ' + nightsLabel + '</span>'
      + '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.gap-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var startDate = new Date(this.dataset.start);
      state.currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      renderCalendar();
    });
  });
}


// ═══════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════

function renderCalendar() {
  var grid = document.getElementById('calendar-grid');
  var monthDisplay = document.getElementById('current-month');
  if (!grid || !monthDisplay) return;

  var year = state.currentMonth.getFullYear();
  var month = state.currentMonth.getMonth();
  monthDisplay.textContent = state.currentMonth.toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' });

  grid.innerHTML = '';
  var dayHeaders = {
    it: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],
    en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    de: ['So','Mo','Di','Mi','Do','Fr','Sa']
  };
  var lang = (window.i18n && window.i18n.lang) || 'en';
  (dayHeaders[lang] || dayHeaders.en).forEach(function(d) {
    var h = document.createElement('div'); h.className = 'calendar-day header'; h.textContent = d; grid.appendChild(h);
  });

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  for (var i = 0; i < firstDay; i++) {
    var e = document.createElement('div'); e.className = 'calendar-day empty'; grid.appendChild(e);
  }
  var today = new Date(); today.setHours(0,0,0,0);

  for (var day = 1; day <= daysInMonth; day++) {
    var date = new Date(year, month, day);
    var cell = document.createElement('div');
    cell.className = 'calendar-day'; cell.textContent = day;
    cell.dataset.date = date.toISOString().split('T')[0];
    var isPast = date < today;
    var isBlocked = isDateBlocked(date);
    if (isPast || isBlocked) cell.classList.add('blocked');
    else {
      cell.classList.add('available');
      if (state.calendarLoaded && isInAvailableGap(date)) cell.classList.add('in-gap');
      cell.addEventListener('click', (function(d){ return function(){ selectDate(d); }; })(new Date(date)));
    }
    if (date.toDateString() === today.toDateString()) cell.classList.add('today');
    if (state.checkInDate && date.toDateString() === state.checkInDate.toDateString()) cell.classList.add('selected','checkin-selected');
    if (state.checkOutDate && date.toDateString() === state.checkOutDate.toDateString()) cell.classList.add('selected','checkout-selected');
    if (state.checkInDate && state.checkOutDate && date > state.checkInDate && date < state.checkOutDate) cell.classList.add('in-range');
    grid.appendChild(cell);
  }
  if (state.calendarLoaded) {
    var loader = document.getElementById('calendar-loader');
    if (loader) loader.style.display = 'none';
  }
}


// ═══════════════════════════════════════════════════════════
// DATE SELECTION
// ═══════════════════════════════════════════════════════════

function selectDate(date) {
  var errorEl = document.getElementById('date-error');
  if (errorEl) errorEl.style.display = 'none';
  if (!state.checkInDate || (state.checkInDate && state.checkOutDate)) {
    state.checkInDate = date; state.checkOutDate = null;
  } else if (state.checkInDate && !state.checkOutDate) {
    if (date < state.checkInDate) { state.checkOutDate = state.checkInDate; state.checkInDate = date; }
    else if (date.toDateString() === state.checkInDate.toDateString()) {
      state.checkInDate = null; updateDateDisplay(); renderCalendar(); return;
    } else state.checkOutDate = date;
    var nights = calculateNights(state.checkInDate, state.checkOutDate);
    if (nights < BOOKING_CONFIG.minNights) {
      showDateError(t('booking.minStay','Minimum stay: ') + BOOKING_CONFIG.minNights + ' ' + t('booking.nights','nights') + '. ' + t('booking.youSelected','You selected ') + nights + '.');
      state.checkOutDate = null;
    }
    if (state.checkOutDate && hasBlockedDatesInRange(state.checkInDate, state.checkOutDate)) {
      showDateError(t('booking.rangeBlocked','Your selection includes unavailable dates. Please choose dates within the same available period.'));
      state.checkInDate = null; state.checkOutDate = null;
    }
  }
  updateDateDisplay(); renderCalendar();
}

function showDateError(msg) {
  var el = document.getElementById('date-error');
  if (el) { el.textContent = msg; el.style.display = 'flex'; setTimeout(function(){ el.style.display='none'; }, 5000); }
}

function updateDateDisplay() {
  var ci = document.getElementById('checkin-display');
  var co = document.getElementById('checkout-display');
  var nd = document.getElementById('nights-display');
  var nc = document.getElementById('nights-count');
  var btn = document.getElementById('continue-to-guests');
  if (!ci || !co || !btn) return;
  ci.textContent = state.checkInDate ? formatDateDisplay(state.checkInDate) : t('booking.selectDate','Select date');
  if (state.checkOutDate) {
    co.textContent = formatDateDisplay(state.checkOutDate);
    nc.textContent = calculateNights(state.checkInDate, state.checkOutDate);
    nd.style.display = 'block'; btn.disabled = false;
  } else {
    co.textContent = state.checkInDate ? t('booking.selectCheckout','Select checkout') : t('booking.selectDate','Select date');
    nd.style.display = 'none'; btn.disabled = true;
  }
  var hint = document.getElementById('selection-hint');
  if (hint) {
    if (!state.checkInDate) hint.textContent = t('booking.hintCheckin','Select your check-in date');
    else if (!state.checkOutDate) hint.textContent = t('booking.hintCheckout','Now select your check-out date');
    else hint.textContent = '';
  }
}


// ═══════════════════════════════════════════════════════════
// BLOCKED DATES (Google Calendar API)
// ═══════════════════════════════════════════════════════════

function loadBlockedDates() {
  var timeMin = new Date().toISOString();
  var timeMax = new Date(); timeMax.setMonth(timeMax.getMonth() + 12);
  var url = 'https://www.googleapis.com/calendar/v3/calendars/'
    + encodeURIComponent(BOOKING_CONFIG.calendarId)
    + '/events?key=' + BOOKING_CONFIG.apiKey
    + '&timeMin=' + timeMin + '&timeMax=' + timeMax.toISOString()
    + '&singleEvents=true&orderBy=startTime';

  var loader = document.getElementById('calendar-loader');
  if (loader) loader.style.display = 'flex';

  fetch(url).then(function(r){ return r.json(); }).then(function(data) {
    if (data.error) { console.error('Calendar API:', data.error); showCalendarError(t('booking.loadError','Unable to load availability. Please try again later.')); return; }
    if (data.items) data.items.forEach(function(ev) {
      var s, e;
      if (ev.start.date) { s = new Date(ev.start.date); e = new Date(ev.end.date); }
      else if (ev.start.dateTime) { s = new Date(ev.start.dateTime); e = new Date(ev.end.dateTime); }
      if (s && e) {
        s.setHours(0,0,0,0); e.setHours(0,0,0,0);
        var c = new Date(s);
        while (c < e) {
          var ds = c.toISOString().split('T')[0];
          if (state.blockedDates.indexOf(ds) === -1) state.blockedDates.push(ds);
          c.setDate(c.getDate() + 1);
        }
      }
    });
    state.calendarLoaded = true; calculateAvailableGaps(); renderCalendar();
  }).catch(function(err) {
    console.error(err); showCalendarError(t('booking.connectionError','Connection error. Please refresh the page.'));
  });
}

function showCalendarError(msg) {
  var l = document.getElementById('calendar-loader');
  if (l) l.innerHTML = '<span class="loader-error">' + msg + '</span>';
}


// ═══════════════════════════════════════════════════════════
// SEND REQUEST
// ═══════════════════════════════════════════════════════════

function sendBookingRequest() {
  var nights = calculateNights(state.checkInDate, state.checkOutDate);
  var totalGuests = state.guestData.adults + state.guestData.children;
  var btn = document.getElementById('send-request');
  var orig = btn.textContent;
  btn.textContent = t('booking.sending','Sending...'); btn.disabled = true;

  var payload = {
    guestName: state.guestData.name,
    guestEmail: state.guestData.email,
    guestPhone: state.guestData.phone,
    checkIn: formatDateForSheet(state.checkInDate),
    checkOut: formatDateForSheet(state.checkOutDate),
    nights: nights,
    adults: state.guestData.adults,
    children: state.guestData.children,
    totalGuests: totalGuests,
    pets: state.guestData.pets,
    specialRequests: state.guestData.requests || ''
  };

  fetch(BOOKING_CONFIG.webAppUrl, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
  .then(function() {
    document.getElementById('confirmation-email').textContent = state.guestData.email;
    goToStep('confirmation');
  })
  .catch(function(err) {
    console.error(err);
    alert(t('booking.sendError','Error sending request. Please contact us at ') + BOOKING_CONFIG.email);
    btn.textContent = orig; btn.disabled = false;
  });
}


// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

function setupEventListeners() {
  var prev = document.getElementById('prev-month');
  var next = document.getElementById('next-month');
  if (prev) prev.addEventListener('click', function(){ state.currentMonth.setMonth(state.currentMonth.getMonth()-1); renderCalendar(); });
  if (next) next.addEventListener('click', function(){ state.currentMonth.setMonth(state.currentMonth.getMonth()+1); renderCalendar(); });

  var contGuests = document.getElementById('continue-to-guests');
  if (contGuests) contGuests.addEventListener('click', function(){ goToStep('guests'); });

  var adults = document.getElementById('num-adults');
  var children = document.getElementById('num-children');
  var warn = document.getElementById('guest-limit-warning');
  function validateGuests() {
    var tot = (parseInt(adults.value)||0) + (parseInt(children.value)||0);
    if (warn) warn.style.display = tot > BOOKING_CONFIG.maxGuests ? 'flex' : 'none';
    return tot <= BOOKING_CONFIG.maxGuests;
  }
  if (adults) adults.addEventListener('change', validateGuests);
  if (children) children.addEventListener('change', validateGuests);

  var contPolicy = document.getElementById('continue-to-policy');
  if (contPolicy) contPolicy.addEventListener('click', function() {
    var form = document.getElementById('guest-form');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!validateGuests()) return;
    state.guestData = {
      name: document.getElementById('guest-name').value,
      email: document.getElementById('guest-email').value,
      phone: document.getElementById('guest-phone').value,
      adults: parseInt(document.getElementById('num-adults').value),
      children: parseInt(document.getElementById('num-children').value),
      pets: document.getElementById('pets').value,
      requests: document.getElementById('special-requests').value
    };
    updateSummary(); goToStep('policy');
  });

  var accept = document.getElementById('accept-policy');
  if (accept) accept.addEventListener('change', function(e){ document.getElementById('send-request').disabled = !e.target.checked; });
  var sendBtn = document.getElementById('send-request');
  if (sendBtn) sendBtn.addEventListener('click', sendBookingRequest);
}


// ═══════════════════════════════════════════════════════════
// STEP NAVIGATION
// ═══════════════════════════════════════════════════════════

function goToStep(name) {
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('active'); });
  var target = document.getElementById('step-' + name);
  if (target) target.classList.add('active');
  var steps = ['calendar','guests','policy','confirmation'];
  var idx = steps.indexOf(name);
  document.querySelectorAll('.progress-step').forEach(function(el, i){
    el.classList.remove('active','completed');
    if (i < idx) el.classList.add('completed');
    if (i === idx) el.classList.add('active');
  });
  var widget = document.querySelector('.booking-widget');
  if (widget) widget.scrollIntoView({ behavior:'smooth', block:'start' });
}

function updateSummary() {
  document.getElementById('summary-checkin').textContent = formatDateDisplay(state.checkInDate);
  document.getElementById('summary-checkout').textContent = formatDateDisplay(state.checkOutDate);
  var n = calculateNights(state.checkInDate, state.checkOutDate);
  document.getElementById('summary-nights').textContent = n + ' ' + (n>1 ? t('booking.nights','nights') : t('booking.night','night'));
  var gt = state.guestData.adults + ' ' + (state.guestData.adults>1 ? t('booking.adults','adults') : t('booking.adult','adult'));
  if (state.guestData.children > 0) gt += ', ' + state.guestData.children + ' ' + (state.guestData.children>1 ? t('booking.children','children') : t('booking.child','child'));
  document.getElementById('summary-guests').textContent = gt;
  document.getElementById('summary-name').textContent = state.guestData.name;
  document.getElementById('summary-email').textContent = state.guestData.email;
  document.getElementById('summary-pets').textContent = state.guestData.pets === 'yes' ? t('booking.petsYes','Yes') : t('booking.petsNo','No');
}

function resetWidget() {
  state.checkInDate = null; state.checkOutDate = null;
  state.guestData = { name:'', email:'', phone:'', adults:2, children:0, pets:'no', requests:'' };
  document.getElementById('guest-form').reset();
  document.getElementById('accept-policy').checked = false;
  document.getElementById('date-error').style.display = 'none';
  updateDateDisplay(); goToStep('calendar'); renderCalendar();
}


// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function formatDateDisplay(d) { return d.toLocaleDateString(currentLocale(), { month:'short', day:'numeric', year:'numeric' }); }
function formatDateShort(d)   { return d.toLocaleDateString(currentLocale(), { month:'short', day:'numeric' }); }
function formatDateForSheet(d) {
  var dd = String(d.getDate()).padStart(2,'0'); var mm = String(d.getMonth()+1).padStart(2,'0');
  return dd + '/' + mm + '/' + d.getFullYear();
}
function calculateNights(a,b) { return Math.ceil(Math.abs(b-a) / 86400000); }
function isDateBlocked(d) { return state.blockedDates.indexOf(d.toISOString().split('T')[0]) >= 0; }
function hasBlockedDatesInRange(s,e) {
  var c = new Date(s); c.setDate(c.getDate()+1);
  while (c < e) { if (isDateBlocked(c)) return true; c.setDate(c.getDate()+1); }
  return false;
}
