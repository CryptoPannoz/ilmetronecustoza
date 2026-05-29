/**
 * Il Metrone — i18n loader (vanilla JS)
 * Switches between IT / EN / DE by replacing text in elements
 * marked with `data-i18n` (text content), `data-i18n-html` (innerHTML),
 * `data-i18n-attr-<name>` (attribute value), or `data-i18n-ph` (placeholder).
 */
(function() {
  var DEFAULT_LANG = 'it';
  var STORAGE_KEY = 'ilmetrone.lang';
  var SUPPORTED = ['it','en','de'];
  var translations = {};
  var current = null;

  function detect() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    var url = new URLSearchParams(window.location.search).get('lang');
    if (url && SUPPORTED.indexOf(url) !== -1) return url;
    var nav = (navigator.language || 'it').slice(0,2).toLowerCase();
    if (SUPPORTED.indexOf(nav) !== -1) return nav;
    return DEFAULT_LANG;
  }

  function get(key) {
    var dict = translations[current] || {};
    return (key in dict) ? dict[key] : key;
  }

  function applyTo(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function(el) {
      el.textContent = get(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      el.innerHTML = get(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
      el.setAttribute('placeholder', get(el.getAttribute('data-i18n-ph')));
    });
    // Per-attribute translation: data-i18n-attr-title="some.key"
    root.querySelectorAll('*').forEach(function(el) {
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-i18n-attr-') === 0) {
          var attr = a.name.replace('data-i18n-attr-', '');
          el.setAttribute(attr, get(a.value));
        }
      }
    });
  }

  function setLang(lang, persist) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    if (persist !== false) localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    if (translations[lang]) {
      current = lang;
      window.i18n.lang = current;
      applyTo();
      // Aggiorna stato pulsanti switcher
      document.querySelectorAll('.lang-switch button').forEach(function(b) {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
      window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang }}));
      return Promise.resolve();
    }
    return fetch('i18n/' + lang + '.json').then(function(r){ return r.json(); }).then(function(json) {
      translations[lang] = json;
      current = lang;
      window.i18n.lang = current;
      applyTo();
      document.querySelectorAll('.lang-switch button').forEach(function(b) {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
      window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang }}));
    }).catch(function(err) {
      console.error('i18n load failed:', err);
    });
  }

  // Public API
  window.i18n = {
    lang: null,
    t: get,
    setLang: setLang,
    apply: applyTo
  };

  document.addEventListener('DOMContentLoaded', function() {
    var lang = detect();
    setLang(lang, false);

    // Wire all language switch buttons
    document.querySelectorAll('.lang-switch button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setLang(btn.dataset.lang);
      });
    });
  });
})();
