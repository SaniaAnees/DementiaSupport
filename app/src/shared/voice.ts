import type { LangCode } from './types';

export type SpeechSupport = {
  tts: boolean;
  stt: boolean;
  reason?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: { [index: number]: { [index: number]: { transcript: string; confidence: number }; isFinal: boolean }; length: number };
};

function RecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function langToBcp47(code: LangCode | string = 'en'): string {
  const map: Record<string, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    bn: 'bn-IN',
    as: 'as-IN',
  };
  return map[code] || 'en-IN';
}

export function getSpeechSupport(): SpeechSupport {
  const tts = typeof window !== 'undefined' && !!window.speechSynthesis;
  const stt = !!RecognitionCtor();
  if (!stt) {
    return {
      tts,
      stt: false,
      reason:
        'Voice answers need Chrome/Edge or an Android WebView with Google speech. Large answer buttons stay available.',
    };
  }
  return { tts, stt: true };
}

export function speak(text: string, lang = 'en-IN'): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export type ListenResult =
  | { ok: true; transcript: string; confidence: number }
  | { ok: false; error: string; unsupported?: boolean };

/** Listen once for a spoken answer. Never throws — returns structured failure. */
export function listenOnce(opts: {
  lang?: string;
  timeoutMs?: number;
}): Promise<ListenResult> {
  const Ctor = RecognitionCtor();
  if (!Ctor) {
    return Promise.resolve({
      ok: false,
      unsupported: true,
      error: 'Speech recognition is not available on this device/browser.',
    });
  }

  const timeoutMs = opts.timeoutMs ?? 10000;
  const lang = opts.lang || 'en-IN';

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ListenResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    const timer = window.setTimeout(() => {
      finish({ ok: false, error: 'No speech heard — try again or tap an answer.' });
    }, timeoutMs);

    rec.onresult = (ev) => {
      const alt = ev.results?.[0]?.[0];
      const transcript = (alt?.transcript || '').trim();
      const confidence = typeof alt?.confidence === 'number' ? alt.confidence : 0.7;
      if (!transcript) {
        finish({ ok: false, error: 'Could not understand — try again or tap an answer.' });
        return;
      }
      finish({ ok: true, transcript, confidence });
    };

    rec.onerror = (ev) => {
      const code = ev.error || 'error';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        finish({
          ok: false,
          error: 'Microphone permission denied. Allow mic access or use the answer buttons.',
        });
        return;
      }
      if (code === 'no-speech') {
        finish({ ok: false, error: 'No speech heard — try again or tap an answer.' });
        return;
      }
      if (code === 'language-not-supported') {
        finish({
          ok: false,
          error: 'This language is not supported for voice here. Tap an answer instead.',
        });
        return;
      }
      finish({ ok: false, error: `Voice listen failed (${code}). Tap an answer instead.` });
    };

    rec.onend = () => {
      if (!settled) {
        finish({ ok: false, error: 'Listening ended — try again or tap an answer.' });
      }
    };

    try {
      stopSpeaking();
      rec.start();
    } catch {
      finish({
        ok: false,
        unsupported: true,
        error: 'Could not start the microphone. Tap an answer instead.',
      });
    }
  });
}
