// First-time intro — always after splash when logged out
window.IntroPage = {
  ROTATE_MS: 2000,
  CTA_DELAY_MS: 1000,
  _timer: null,
  _onDone: null,
  _index: 0,

  lines: [
    { lang: 'as', text: 'আমাক ডাঙৰ-দীঘল কৰাসকলৰ বাবে অলপ সহায়।' },
    { lang: 'bn', text: 'যারা আমাদের বড় করেছেন তাদের জন্য একটু সাহায্য।' },
    { lang: 'mni', text: 'ঐখোইবু চাউখৎহনবীরম্বশিংগীদমক অপীকপা মতেং অমা।' },
    { lang: 'lus', text: 'Min enkawl seiliantute tana puihna tlem.' },
    { lang: 'ne', text: 'हामीलाई हुर्काउनेहरूका लागि सानो सहयोग।' },
    { lang: 'brx', text: 'जोंखौ देरगा-देरसिं खालामग्राफोरनिसिम एसेबाबो हेफाजाब।' },
  ],

  english: 'A little help for the ones who raised us.',

  start(onDone) {
    this.stop();
    this._onDone = onDone;
    this._index = 0;

    const screen = document.getElementById('intro-screen');
    const cta = document.getElementById('intro-cta');
    const rotateEl = document.getElementById('intro-rotate');
    const englishEl = document.getElementById('intro-english');

    if (!screen || !rotateEl || !englishEl || !cta) {
      console.error('IntroPage: missing DOM nodes');
      if (typeof onDone === 'function') onDone();
      return;
    }

    screen.classList.remove('hidden', 'intro-exit');
    // is-visible / is-active are toggled by the crossfade in app.js
    cta.classList.remove('is-ready');
    cta.replaceWith(cta.cloneNode(true));
    const freshCta = document.getElementById('intro-cta');

    this._renderEnglish(englishEl);
    this._paintLine(rotateEl, 0);

    window.setTimeout(() => {
      document.getElementById('intro-cta')?.classList.add('is-ready');
    }, this.CTA_DELAY_MS);

    this._timer = window.setInterval(() => {
      this._index = (this._index + 1) % this.lines.length;
      this._swapLine(rotateEl, this._index);
    }, this.ROTATE_MS);

    freshCta?.addEventListener(
      'click',
      () => {
        IntroPage.finish();
      },
      { once: true }
    );
  },

  _renderEnglish(el) {
    el.textContent = '';
    [...this.english].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = ch === ' ' ? 'ch is-space' : 'ch';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.animationDelay = `${100 + i * 26}ms`;
      el.appendChild(span);
    });
  },

  _paintLine(el, index) {
    const line = this.lines[index];
    if (!line) return;
    el.lang = line.lang;
    el.textContent = line.text;
    el.classList.remove('is-leaving', 'is-entering');
  },

  _swapLine(el, index) {
    const line = this.lines[index];
    if (!line || !el) return;

    el.classList.add('is-leaving');
    window.setTimeout(() => {
      el.lang = line.lang;
      el.textContent = line.text;
      el.classList.remove('is-leaving');
      el.classList.add('is-entering');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          el.classList.remove('is-entering');
        });
      });
    }, 280);
  },

  finish() {
    this.stop();
    const screen = document.getElementById('intro-screen');
    screen?.classList.add('intro-exit');
    screen?.classList.remove('is-active', 'is-visible');

    const done = this._onDone;
    this._onDone = null;

    window.setTimeout(() => {
      screen?.classList.add('hidden');
      screen?.classList.remove('intro-exit');
      if (typeof done === 'function') done();
    }, 480);
  },

  stop() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  },
};
