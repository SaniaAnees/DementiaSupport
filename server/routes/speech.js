const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function providerConfigured() {
  const p = String(process.env.SPEECH_PROVIDER || '').toLowerCase();
  if (p === 'gemini' || p === 'google') {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  }
  if (p === 'openai' || p === 'whisper') {
    return !!process.env.OPENAI_API_KEY;
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return true;
  if (process.env.OPENAI_API_KEY) return true;
  return false;
}

function activeProvider() {
  const p = String(process.env.SPEECH_PROVIDER || '').toLowerCase();
  if (p === 'gemini' || p === 'google') return 'gemini';
  if (p === 'openai' || p === 'whisper') return 'openai';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

/** Optional auth — demo / patient home may not always send bearer */
function softAuth(req, res, next) {
  if (process.env.DEMO_MODE === 'true') return next();
  return authMiddleware(req, res, next);
}

router.get('/status', softAuth, (req, res) => {
  const provider = activeProvider();
  res.json({
    available: !!provider,
    provider: provider || null,
    offlineFallback: 'webspeech',
    modelHint: process.env.GEMINI_STT_MODEL || 'gemini-3.6-flash',
  });
});

/**
 * Cloud STT — Gemini (audio understanding) or OpenAI Whisper.
 * Body: { audioBase64, mimeType?, languageHint? }
 */
router.post('/stt', softAuth, async (req, res) => {
  const provider = activeProvider();
  if (!provider) {
    return res.status(501).json({
      error: 'Speech provider not configured. Set GEMINI_API_KEY or OPENAI_API_KEY.',
      transcript: null,
    });
  }

  const { audioBase64, mimeType = 'audio/webm', languageHint } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'audioBase64 required', transcript: null });
  }
  if (audioBase64.length > 5_500_000) {
    return res.status(413).json({ error: 'Audio too large', transcript: null });
  }

  try {
    let transcript = null;
    let modelUsed = null;
    if (provider === 'gemini') {
      const out = await transcribeGemini(audioBase64, mimeType, languageHint);
      transcript = out.text;
      modelUsed = out.model;
    } else {
      transcript = await transcribeWhisper(audioBase64, mimeType, languageHint);
      modelUsed = 'whisper-1';
    }
    return res.json({
      transcript: transcript || null,
      provider,
      model: modelUsed,
      alternatives: transcript ? [transcript] : [],
    });
  } catch (err) {
    console.error('STT failed:', err?.message || err);
    return res.status(502).json({
      error: err?.message || 'STT failed',
      transcript: null,
    });
  }
});

function geminiModelCandidates() {
  const preferred = process.env.GEMINI_STT_MODEL || 'gemini-3.6-flash';
  const list = [
    preferred,
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];
  return [...new Set(list.filter(Boolean))];
}

/** Normalize browser mime so Gemini accepts the blob */
function geminiMime(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('wav')) return 'audio/wav';
  if (m.includes('mp3') || m.includes('mpeg')) return 'audio/mp3';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'audio/mp4';
  if (m.includes('ogg')) return 'audio/ogg';
  if (m.includes('flac')) return 'audio/flac';
  // Chrome MediaRecorder → webm/opus; Gemini accepts audio/webm
  if (m.includes('webm')) return 'audio/webm';
  return 'audio/webm';
}

async function transcribeGemini(audioBase64, mimeType, languageHint) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const rawB64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '');
  const mime = geminiMime(mimeType);
  const langNote = languageHint
    ? ` The speaker may use ${languageHint} (Indian English / Hindi / Assamese mix).`
    : ' The speaker may use Indian English or Hindi.';

  const prompt =
    'You are a speech-to-text engine for a dementia-care app. ' +
    'Transcribe the spoken audio exactly as said. ' +
    'Reply with ONLY the transcript text — no quotes, no punctuation commentary, no markdown.' +
    langNote;

  let lastErr = null;
  for (const model of geminiModelCandidates()) {
    try {
      const text = await callGeminiGenerate(key, model, prompt, mime, rawB64);
      if (text != null) return { text, model };
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      // Try next model if this one is retired / not found
      if (/no longer available|not found|NOT_FOUND|is not supported/i.test(msg)) {
        console.warn(`Gemini model ${model} failed, trying next:`, msg.slice(0, 120));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('All Gemini STT models failed');
}

async function callGeminiGenerate(key, model, prompt, mime, rawB64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mime,
              data: rawB64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Gemini STT HTTP ${resp.status}`);
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ') || '';
  return String(text)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^(transcript|transcription)\s*:\s*/i, '');
}

async function transcribeWhisper(audioBase64, mimeType, languageHint) {
  const key = process.env.OPENAI_API_KEY;
  const raw = Buffer.from(String(audioBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  const ext = (mimeType || '').includes('mp4')
    ? 'mp4'
    : (mimeType || '').includes('ogg')
      ? 'ogg'
      : (mimeType || '').includes('wav')
        ? 'wav'
        : 'webm';

  const form = new FormData();
  form.append('file', new Blob([raw], { type: mimeType || 'audio/webm' }), `speech.${ext}`);
  form.append('model', process.env.OPENAI_STT_MODEL || 'whisper-1');
  if (languageHint) {
    const lang = String(languageHint).slice(0, 2).toLowerCase();
    if (['en', 'hi', 'bn', 'as'].includes(lang)) form.append('language', lang === 'as' ? 'bn' : lang);
  }

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Whisper HTTP ${resp.status}`);
  }
  return String(data.text || '').trim();
}

module.exports = router;
