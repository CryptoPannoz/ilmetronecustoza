/**
 * Il Metrone — main.js
 * Nav scroll, mobile menu, reveal-on-scroll, lightbox
 */
(function() {
  // Nav scroll state
  var nav = document.getElementById('nav');
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 8) nav.classList.add('nav--scrolled');
    else nav.classList.remove('nav--scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('mobileMenu');
  var close = document.getElementById('mobileClose');
  function openMenu() { if (menu) menu.classList.add('mobile-menu--open'); }
  function closeMenu() { if (menu) menu.classList.remove('mobile-menu--open'); }
  if (toggle) toggle.addEventListener('click', openMenu);
  if (close) close.addEventListener('click', closeMenu);
  if (menu) menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });

  // Reveal on scroll
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries) {
    entries.forEach(function(en) {
      if (en.isIntersecting) {
        en.target.classList.add(en.target.classList.contains('reveal-stagger') ? 'reveal-stagger--visible' : 'reveal--visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 }) : null;
  if (io) document.querySelectorAll('.reveal, .reveal-stagger').forEach(function(el){ io.observe(el); });
  else document.querySelectorAll('.reveal, .reveal-stagger').forEach(function(el){
    el.classList.add(el.classList.contains('reveal-stagger') ? 'reveal-stagger--visible' : 'reveal--visible');
  });

  // Year token in footer
  document.querySelectorAll('[data-year]').forEach(function(el) {
    el.textContent = new Date().getFullYear();
  });

  // Lightbox (gallery)
  var galleryItems = document.querySelectorAll('.gallery__item img');
  if (galleryItems.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<button class="lightbox__close" aria-label="Close">&times;</button>'
      + '<button class="lightbox__btn lightbox__btn--prev" aria-label="Previous">&#8249;</button>'
      + '<img class="lightbox__img" alt="">'
      + '<button class="lightbox__btn lightbox__btn--next" aria-label="Next">&#8250;</button>';
    document.body.appendChild(lb);
    var lbImg = lb.querySelector('.lightbox__img');
    var idx = 0;
    var srcs = Array.prototype.map.call(galleryItems, function(img){ return img.getAttribute('src'); });

    function show(i) { idx = (i + srcs.length) % srcs.length; lbImg.src = srcs[idx]; lb.classList.add('active'); }
    function hide() { lb.classList.remove('active'); }

    galleryItems.forEach(function(img, i) {
      img.parentElement.addEventListener('click', function(){ show(i); });
    });
    lb.querySelector('.lightbox__close').addEventListener('click', hide);
    lb.querySelector('.lightbox__btn--prev').addEventListener('click', function(e){ e.stopPropagation(); show(idx-1); });
    lb.querySelector('.lightbox__btn--next').addEventListener('click', function(e){ e.stopPropagation(); show(idx+1); });
    lb.addEventListener('click', function(e){ if (e.target === lb) hide(); });
    document.addEventListener('keydown', function(e) {
      if (!lb.classList.contains('active')) return;
      if (e.key === 'Escape') hide();
      if (e.key === 'ArrowRight') show(idx+1);
      if (e.key === 'ArrowLeft') show(idx-1);
    });
  }
})();
