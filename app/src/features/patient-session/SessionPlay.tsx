import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../shared/ui';
import {
  getSpeechSupport,
  langToBcp47,
  listenOnce,
  speak,
  stopSpeaking,
} from '../../shared/voice';
import { gradeAnswer } from './engine';
import { useSessionStore } from './store';

export function SessionPlay() {
  const nav = useNavigate();
  const {
    items,
    step,
    next,
    pushResult,
    sessionType,
    languageCode,
    maxMinutes,
    pauseBeforeHintMs,
    startedAtMs,
  } = useSessionStore();
  const item = items[step];
  const [hints, setHints] = useState(0);
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hintReady, setHintReady] = useState(false);
  const [remaining, setRemaining] = useState(maxMinutes * 60);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [sttAvailable, setSttAvailable] = useState(true);
  const started = useRef(Date.now());
  const locked = useRef(false);
  const lowConfidenceAsked = useRef(false);
  const listenGen = useRef(0);

  useEffect(() => {
    const support = getSpeechSupport();
    setSttAvailable(support.stt);
    if (!support.stt) setVoiceNote(support.reason || null);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const left = Math.max(0, maxMinutes * 60 - Math.floor((Date.now() - startedAtMs) / 1000));
      setRemaining(left);
      if (left <= 0) nav('/session/summary', { replace: true });
    }, 1000);
    return () => clearInterval(tick);
  }, [maxMinutes, startedAtMs, nav]);

  useEffect(() => {
    if (!item) {
      nav('/session/summary', { replace: true });
      return;
    }
    locked.current = false;
    lowConfidenceAsked.current = false;
    setHints(0);
    setReps(0);
    setFeedback(null);
    setHintReady(false);
    setListening(false);
    started.current = Date.now();
    const gen = ++listenGen.current;
    const lang = langToBcp47(languageCode);

    (async () => {
      await speak(item.spokenPrompt || item.promptText, lang);
      if (gen !== listenGen.current) return;
      if (item.itemType !== 'memory_teach' && getSpeechSupport().stt) {
        // Auto-listen after the prompt is spoken
        void startListen(gen);
      }
    })();

    const t = window.setTimeout(() => setHintReady(true), pauseBeforeHintMs);
    return () => {
      stopSpeaking();
      clearTimeout(t);
      listenGen.current += 1;
    };
  }, [item?.id, pauseBeforeHintMs, languageCode]);

  async function startListen(gen = listenGen.current) {
    if (!item || item.itemType === 'memory_teach' || locked.current) return;
    const support = getSpeechSupport();
    if (!support.stt) {
      setSttAvailable(false);
      setVoiceNote(support.reason || 'Voice not available — tap an answer below.');
      return;
    }
    setListening(true);
    setVoiceNote('Listening… speak your answer');
    const result = await listenOnce({ lang: langToBcp47(languageCode), timeoutMs: 9000 });
    if (gen !== listenGen.current) return;
    setListening(false);

    if (!result.ok) {
      if (result.unsupported) setSttAvailable(false);
      setVoiceNote(result.error);
      return;
    }

    setVoiceNote(`Heard: “${result.transcript}”`);
    handleSpoken(result.transcript, result.confidence);
  }

  function handleSpoken(transcript: string, confidence: number) {
    if (!item || locked.current) return;
    const { isCorrect, matchScore } = gradeAnswer(transcript, item.expectedAnswers);
    const soft = !isCorrect && (matchScore > 0.4 || confidence < 0.45);

    if (soft && !lowConfidenceAsked.current) {
      lowConfidenceAsked.current = true;
      setFeedback('One more try — take your time.');
      speak('One more try. Take your time.', langToBcp47(languageCode));
      return;
    }

    setFeedback(isCorrect ? 'Well remembered.' : 'That is okay.');
    setTimeout(
      () =>
        finish({
          outcome: isCorrect ? 'correct' : 'wrong',
          transcript,
        }),
      550
    );
  }

  if (!item) return null;

  function finish(payload: { outcome: 'correct' | 'wrong' | 'skipped'; transcript: string }) {
    if (locked.current) return;
    locked.current = true;
    listenGen.current += 1;
    setListening(false);
    if (item.itemType !== 'memory_teach') {
      pushResult({
        itemId: item.id,
        memoryId: item.memoryId,
        outcome: payload.outcome,
        responseMs: Date.now() - started.current,
        hintsUsed: hints,
        repetitions: reps,
        transcript: payload.transcript,
      });
    }
    if (step + 1 >= items.length) nav('/session/summary', { replace: true });
    else next();
  }

  function onChip(opt: string) {
    const { isCorrect, matchScore } = gradeAnswer(opt, item.expectedAnswers);
    if (!isCorrect && matchScore > 0.4 && matchScore < 0.72 && !lowConfidenceAsked.current) {
      lowConfidenceAsked.current = true;
      setFeedback('One more try — take your time.');
      speak('One more try. Take your time.', langToBcp47(languageCode));
      locked.current = false;
      return;
    }
    setFeedback(isCorrect ? 'Well remembered.' : 'That is okay.');
    setTimeout(
      () => finish({ outcome: isCorrect ? 'correct' : 'wrong', transcript: opt }),
      500
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const progress = ((step + 1) / items.length) * 100;

  return (
    <div className="patient-shell page-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--patient-muted)' }}>
          {sessionType === 'morning' ? 'Morning' : 'Evening'} · {step + 1}/{items.length}
        </span>
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
            color: remaining < 60 ? '#ffb4b4' : 'var(--patient-accent)',
            fontSize: 14,
          }}
        >
          {mm}:{ss}
        </span>
      </div>

      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 18 }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 99,
            background: 'linear-gradient(90deg, #3dd6c3, #2f80ed)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {item.localUri ? (
        <motion.img
          key={item.id + '-img'}
          initial={{ opacity: 0.2, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          src={item.localUri}
          alt=""
          style={{
            width: '100%',
            height: 280,
            objectFit: 'cover',
            borderRadius: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          }}
        />
      ) : (
        <div style={{ height: 140, borderRadius: 24, background: 'var(--patient-elevated)' }} />
      )}

      <motion.h1
        key={item.id + '-q'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          margin: '20px 0 12px',
        }}
      >
        {item.itemType === 'memory_teach' ? item.caption : item.promptText}
      </motion.h1>

      {item.itemType !== 'memory_teach' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            padding: '12px 14px',
            borderRadius: 14,
            background: listening ? 'rgba(61,214,195,0.12)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: listening ? 'var(--patient-accent)' : sttAvailable ? '#5b6573' : '#e8a317',
              boxShadow: listening ? '0 0 0 6px rgba(61,214,195,0.2)' : 'none',
            }}
          />
          <span style={{ color: 'var(--patient-muted)', fontSize: 14, flex: 1 }}>
            {voiceNote ||
              (sttAvailable
                ? 'Speak your answer, or tap a button below'
                : 'Voice not supported here — tap an answer below')}
          </span>
        </div>
      )}

      {feedback && (
        <p style={{ color: 'var(--patient-accent)', fontWeight: 650, marginTop: 0 }}>{feedback}</p>
      )}

      {item.itemType === 'memory_teach' ? (
        <Button variant="patient" large onClick={() => finish({ outcome: 'correct', transcript: '' })}>
          Continue
        </Button>
      ) : (
        <>
          {sttAvailable && (
            <Button
              variant="patient"
              large
              disabled={listening || locked.current}
              onClick={() => startListen()}
              style={{ marginBottom: 12 }}
            >
              {listening ? 'Listening…' : 'Tap to speak answer'}
            </Button>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {(item.chipOptions || item.expectedAnswers.slice(0, 1)).map((opt) => (
              <button
                key={opt}
                onClick={() => onChip(opt)}
                style={{
                  minHeight: 68,
                  borderRadius: 18,
                  border: '1px solid rgba(61,214,195,0.28)',
                  background: 'var(--patient-elevated)',
                  color: 'var(--patient-ink)',
                  fontSize: 20,
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
        <Button
          variant="secondary"
          style={{
            background: 'transparent',
            color: 'var(--patient-ink)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
          }}
          onClick={() => {
            setReps((r) => r + 1);
            speak(item.spokenPrompt || item.promptText, langToBcp47(languageCode));
          }}
        >
          Repeat
        </Button>
        {item.itemType !== 'memory_teach' ? (
          <Button
            variant="secondary"
            disabled={!hintReady}
            style={{
              background: 'transparent',
              color: 'var(--patient-ink)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              opacity: hintReady ? 1 : 0.4,
            }}
            onClick={() => {
              setHints((h) => h + 1);
              speak(item.hintText || 'Take your time.', langToBcp47(languageCode));
            }}
          >
            Hint
          </Button>
        ) : (
          <div />
        )}
        {item.itemType !== 'memory_teach' ? (
          <Button
            variant="ghost"
            style={{ color: 'var(--patient-muted)' }}
            onClick={() => finish({ outcome: 'skipped', transcript: '' })}
          >
            Skip
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
