// OTP authentication — single-page phone + code (splash aesthetic)
const OTPAuth = {
  currentPhone: null,
  RESEND_SECONDS: 30,
  _resendTimer: null,
  _resendLeft: 0,

  normalizePhone(raw) {
    // Indian mobile: exactly 10 digits → +91XXXXXXXXXX
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length > 10) {
      digits = digits.slice(-10);
    }
    digits = digits.slice(0, 10);
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    return '';
  },

  formatDisplayPhone(e164) {
    const d = String(e164 || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) {
      return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
    }
    return e164 || '';
  },

  async sendOtp(phone) {
    this.currentPhone = phone;
    Session.setPhone(phone);
    return API.sendOtp(phone);
  },

  async verifyOtp(otp) {
    const result = await API.verifyOtp(this.currentPhone, otp);
    if (result.token) {
      Session.setToken(result.token);
    }
    return result;
  },

  resendOtp() {
    if (this.currentPhone) {
      return this.sendOtp(this.currentPhone);
    }
    return Promise.reject(new Error('No phone number'));
  },

  showAuthPage() {
    const gate = document.getElementById('auth-gate');
    gate?.classList.remove('hidden', 'auth-exit');
    void gate?.offsetWidth;
    gate?.classList.add('is-visible');
    this.resetToPhone();
  },

  hideAuthPage() {
    const gate = document.getElementById('auth-gate');
    gate?.classList.add('auth-exit');
    gate?.classList.remove('is-visible');
    window.setTimeout(() => {
      gate?.classList.add('hidden');
      gate?.classList.remove('auth-exit');
    }, 500);
  },

  resetToPhone() {
    // Hide verified / OTP stages
    const verified = document.getElementById('auth-verified-stage');
    verified?.setAttribute('hidden', '');
    verified?.classList.remove('is-done');
    const msg = document.getElementById('auth-verified-msg');
    if (msg) msg.textContent = 'Checking…';

    const stage = document.getElementById('auth-code-stage');
    stage?.classList.remove('is-open');
    stage?.setAttribute('hidden', '');

    // Restore OTP chrome for next login
    document.getElementById('auth-help')?.removeAttribute('hidden');
    stage?.querySelector('.auth-code-label')?.removeAttribute('hidden');
    stage?.querySelector('.auth-otp-boxes')?.removeAttribute('hidden');
    const verifyBtn = document.getElementById('verify-otp-btn');
    if (verifyBtn) {
      verifyBtn.hidden = false;
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Continue';
    }

    document.getElementById('otp-status').textContent = '';
    document.getElementById('otp-status').className = 'auth-status';
    document.getElementById('verify-status').textContent = '';
    document.getElementById('verify-status').className = 'auth-status';
    document.getElementById('sms-help-tip')?.classList.remove('is-open');
    this.clearOtpBoxes();
    this.stopResendTimer();
    this.currentPhone = null;

    const heading = document.getElementById('auth-heading');
    const sub = document.getElementById('auth-sub');
    if (heading) heading.textContent = 'Enter your phone number.';
    if (sub) {
      sub.textContent = 'We’ll send a 6-digit code by SMS so only you can open this space.';
    }

    const phoneStep = document.getElementById('auth-phone-step');
    phoneStep?.classList.remove('hidden', 'is-code-sent');

    const phoneInput = document.getElementById('phone-input');
    if (phoneInput) {
      phoneInput.readOnly = false;
      phoneInput.classList.remove('is-locked');
      phoneInput.value = '';
    }

    const sendBtn = document.getElementById('send-otp-btn');
    if (sendBtn) {
      sendBtn.hidden = false;
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send code';
    }

    document.getElementById('otp-screen')?.classList.remove('hidden');
  },

  openCodeStage(phone) {
    const stage = document.getElementById('auth-code-stage');
    const phoneEl = document.getElementById('verify-phone');
    if (phoneEl) phoneEl.textContent = this.formatDisplayPhone(phone);

    const heading = document.getElementById('auth-heading');
    const sub = document.getElementById('auth-sub');
    if (heading) heading.textContent = 'Enter the code.';
    if (sub) {
      sub.textContent = 'Type the 6-digit code we sent to your phone.';
    }

    // Same page: hide Send code, keep number visible but locked
    const sendBtn = document.getElementById('send-otp-btn');
    if (sendBtn) sendBtn.hidden = true;
    document.getElementById('auth-phone-step')?.classList.add('is-code-sent');

    const phoneInput = document.getElementById('phone-input');
    if (phoneInput) {
      phoneInput.readOnly = true;
      phoneInput.classList.add('is-locked');
    }

    // Clear top status — demo note moves under OTP if needed
    const status = document.getElementById('otp-status');
    if (status) {
      status.textContent = '';
      status.className = 'auth-status';
    }

    stage?.removeAttribute('hidden');
    stage?.classList.add('is-open');
    this.clearOtpBoxes();
    this.startResendTimer();
    window.setTimeout(() => {
      document.querySelector('#otp-boxes input')?.focus();
    }, 80);
  },

  clearOtpBoxes() {
    document.querySelectorAll('#otp-boxes input').forEach((el) => {
      el.value = '';
    });
    const hidden = document.getElementById('otp-input');
    if (hidden) hidden.value = '';
  },

  readOtpCode() {
    const digits = [...document.querySelectorAll('#otp-boxes input')]
      .map((el) => el.value.replace(/\D/g, ''))
      .join('');
    const hidden = document.getElementById('otp-input');
    if (hidden) hidden.value = digits;
    return digits;
  },

  startResendTimer(seconds = this.RESEND_SECONDS) {
    this.stopResendTimer();
    this._resendLeft = seconds;
    const btn = document.getElementById('resend-otp-btn');
    const tick = () => {
      if (!btn) return;
      if (this._resendLeft <= 0) {
        btn.disabled = false;
        btn.textContent = 'Resend code';
        this.stopResendTimer();
        return;
      }
      btn.disabled = true;
      const m = Math.floor(this._resendLeft / 60);
      const s = String(this._resendLeft % 60).padStart(2, '0');
      btn.textContent = `Resend in ${m}:${s}`;
      this._resendLeft -= 1;
    };
    tick();
    this._resendTimer = window.setInterval(tick, 1000);
  },

  stopResendTimer() {
    if (this._resendTimer) {
      window.clearInterval(this._resendTimer);
      this._resendTimer = null;
    }
  },

  /** Collapse OTP chrome → brief load → verified → onboard or dashboard */
  async playVerifiedThenContinue() {
    const codeStage = document.getElementById('auth-code-stage');
    const help = document.getElementById('auth-help');
    const phoneStep = document.getElementById('auth-phone-step');
    const heading = document.getElementById('auth-heading');
    const sub = document.getElementById('auth-sub');
    const verified = document.getElementById('auth-verified-stage');
    const msg = document.getElementById('auth-verified-msg');
    const btn = document.getElementById('verify-otp-btn');

    help?.setAttribute('hidden', '');
    codeStage?.querySelector('.auth-code-label')?.setAttribute('hidden', '');
    codeStage?.querySelector('.auth-otp-boxes')?.setAttribute('hidden', '');
    if (btn) btn.hidden = true;
    document.getElementById('verify-status').textContent = '';
    phoneStep?.classList.add('hidden');
    if (heading) heading.textContent = '';
    if (sub) sub.textContent = '';

    verified?.removeAttribute('hidden');
    verified?.classList.remove('is-done');
    if (msg) msg.textContent = 'Checking…';

    await new Promise((r) => setTimeout(r, 420));

    verified?.classList.add('is-done');
    if (msg) msg.textContent = 'OTP verified ✓';

    await new Promise((r) => setTimeout(r, 700));

    const needsOnboard = await OnboardFlow.needsOnboarding?.();
    if (needsOnboard && typeof window.app?.crossfadeToOnboard === 'function') {
      await window.app.crossfadeToOnboard({ from: 'auth' });
    } else if (needsOnboard && typeof OnboardFlow !== 'undefined') {
      this.hideAuthPage();
      window.setTimeout(() => OnboardFlow.start(), 280);
    } else if (typeof window.app?.crossfadeToDashboard === 'function') {
      await window.app.crossfadeToDashboard({ from: 'auth' });
    } else {
      this.hideAuthPage();
      window.app?.showDashboard({ fadeIn: true });
    }
  },

  bindUi() {
    if (this._bound) return;
    this._bound = true;

    const boxes = document.querySelectorAll('#otp-boxes input');
    boxes.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const v = e.target.value.replace(/\D/g, '').slice(-1);
        e.target.value = v;
        if (v && index < boxes.length - 1) {
          boxes[index + 1].focus();
        }
        this.readOtpCode();
        if (this.readOtpCode().length === 6) {
          document.getElementById('verify-otp-btn')?.click();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          boxes[index - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        pasted.split('').forEach((ch, i) => {
          if (boxes[i]) boxes[i].value = ch;
        });
        this.readOtpCode();
        const focusIdx = Math.min(pasted.length, boxes.length - 1);
        boxes[focusIdx]?.focus();
        if (pasted.length === 6) {
          document.getElementById('verify-otp-btn')?.click();
        }
      });
    });

    document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
      const phoneInput = document.getElementById('phone-input');
      const status = document.getElementById('otp-status');
      const sendBtn = document.getElementById('send-otp-btn');
      const phone = this.normalizePhone(phoneInput?.value);

      if (!phone || phone.replace(/\D/g, '').length !== 12) {
        status.textContent = 'Enter a valid 10-digit mobile number';
        status.className = 'auth-status is-error';
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      status.textContent = '';
      status.className = 'auth-status';

      try {
        const result = await this.sendOtp(phone);
        this.openCodeStage(phone);
        const verifyStatus = document.getElementById('verify-status');
        if (verifyStatus) {
          verifyStatus.textContent = result.demo
            ? 'Demo mode — use any 6-digit code'
            : 'Code on its way';
          verifyStatus.className = 'auth-status is-success';
        }
      } catch (err) {
        status.textContent = err.message || 'Could not send code';
        status.className = 'auth-status is-error';
        sendBtn.hidden = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send code';
      }
    });

    document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
      const code = this.readOtpCode();
      const status = document.getElementById('verify-status');
      const btn = document.getElementById('verify-otp-btn');
      if (code.length !== 6) {
        status.textContent = 'Enter the 6-digit code';
        status.className = 'auth-status is-error';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Checking…';
      status.textContent = '';
      status.className = 'auth-status';

      try {
        await this.verifyOtp(code);
        await LocalDB.setMeta?.('hasSeenIntro', 'true');
        await this.playVerifiedThenContinue();
      } catch (err) {
        status.textContent = err.message || 'That code didn’t match. Try again.';
        status.className = 'auth-status is-error';
        this.clearOtpBoxes();
        document.querySelector('#otp-boxes input')?.focus();
        btn.disabled = false;
        btn.textContent = 'Continue';
      }
    });

    document.getElementById('change-phone-btn')?.addEventListener('click', () => {
      this.resetToPhone();
      document.getElementById('phone-input')?.focus();
    });

    document.getElementById('resend-otp-btn')?.addEventListener('click', async () => {
      const status = document.getElementById('verify-status');
      const btn = document.getElementById('resend-otp-btn');
      if (btn?.disabled) return;
      try {
        btn.disabled = true;
        const result = await this.resendOtp();
        this.startResendTimer();
        status.textContent = result.demo
          ? 'Demo mode — use any 6-digit code'
          : 'New code sent';
        status.className = 'auth-status is-success';
        this.clearOtpBoxes();
        document.querySelector('#otp-boxes input')?.focus();
      } catch (err) {
        status.textContent = err.message || 'Could not resend';
        status.className = 'auth-status is-error';
        btn.disabled = false;
        btn.textContent = 'Resend code';
      }
    });

    document.getElementById('sms-help-btn')?.addEventListener('click', () => {
      document.getElementById('sms-help-tip')?.classList.toggle('is-open');
    });

    // Enter on phone field sends code
    document.getElementById('phone-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('send-otp-btn')?.click();
      }
    });

    // Force Indian 10-digit numeric only
    document.getElementById('phone-input')?.addEventListener('input', (e) => {
      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (e.target.value !== cleaned) e.target.value = cleaned;
    });
  },
};
