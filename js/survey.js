/* ==========================================================================
   NEUROSENSE — SURVEY / CONTRIBUTE PAGE SCRIPT
   Page-specific behavior only: FAQ accordion, animated statistic counters,
   button ripple effect, and a scoped scroll-reveal fallback. Loaded after
   script.js, which already handles the shared navbar toggle/scroll-spy —
   nothing here touches those elements.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  initScrollReveal();
  initFaqAccordion();
  initStatCounters();
  initButtonRipple();

  /* ------------------------------------------------------------------------
     SCROLL REVEAL
     script.js already reveals [data-reveal] elements site-wide; this is a
     defensive fallback scoped to <main> so the page still works correctly
     if script.js fails to load or a later refactor drops that behavior.
     ------------------------------------------------------------------------ */
  function initScrollReveal() {
    const targets = document.querySelectorAll('main [data-reveal]');
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    targets.forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------------------
     FAQ ACCORDION
     Keyboard accessible via native <button> semantics; toggles aria-expanded
     and the hidden attribute rather than relying on visual state alone.
     Only one answer is open at a time.
     ------------------------------------------------------------------------ */
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach((item) => {
      const question = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');
      if (!question || !answer) return;

      question.addEventListener('click', () => toggleFaqItem(question, answer, faqItems));
    });
  }

  function toggleFaqItem(question, answer, allItems) {
    const isOpen = question.getAttribute('aria-expanded') === 'true';

    // Close every other item first so only one is open at a time.
    allItems.forEach((item) => {
      const q = item.querySelector('.faq-question');
      const a = item.querySelector('.faq-answer');
      if (q !== question) {
        q.setAttribute('aria-expanded', 'false');
        a.hidden = true;
      }
    });

    question.setAttribute('aria-expanded', String(!isOpen));
    answer.hidden = isOpen;
  }

  /* ------------------------------------------------------------------------
     ANIMATED STATISTIC COUNTERS
     Reads each target value from data-count-to so the number stays easy to
     edit directly in the HTML. Counts up once, the first time the element
     scrolls into view.
     ------------------------------------------------------------------------ */
  function initStatCounters() {
    const counters = document.querySelectorAll('[data-count-to]');
    if (!counters.length) return;

    if (prefersReducedMotion) {
      counters.forEach((el) => {
        el.textContent = el.getAttribute('data-count-to');
      });
      return;
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    counters.forEach((el) => observer.observe(el));
  }

  function runCounter(el) {
    const target = parseInt(el.getAttribute('data-count-to'), 10);
    if (Number.isNaN(target)) return;

    const duration = 1100;
    let start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------------
     BUTTON RIPPLE EFFECT
     Adds a short-lived ripple span positioned at the click point on any
     .btn element. Purely decorative — never blocks the button's own click
     handling or default link navigation.
     ------------------------------------------------------------------------ */
  function initButtonRipple() {
    if (prefersReducedMotion) return;

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach((button) => {
      button.addEventListener('click', (event) => spawnRipple(button, event), { passive: true });
    });
  }

  function spawnRipple(button, event) {
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

});
