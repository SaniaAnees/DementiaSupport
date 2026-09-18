// Grading engine — fuzzy matching for voice/stt answers
// Port of fuzzyMatch + gradeAnswer from existing code

function normalize(str) {
  return str.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
}

function gradeAnswer(transcript, expectedAnswers) {
  if (!transcript) return { match: false, score: 0 };

  const t = normalize(transcript);
  for (const exp of expectedAnswers) {
    const e = normalize(exp);
    if (e === '') continue;

    // Exact containment (either direction)
    if (t.includes(e) || e.includes(t)) {
      return { match: true, score: 1 };
    }

    // Partial word overlap
    const words = e.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const matched = words.filter((w) => t.includes(w)).length;
      if (matched / words.length >= 0.6) {
        return { match: true, score: matched / words.length };
      }
    }
  }
  return { match: false, score: 0 };
}

// Web Speech API wrapper for patient STT
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const Voice = {
  recognition: null,

  startRecognition(onResult, onEnd) {
    if (!SpeechRecognition) {
      onEnd && onEnd(false);
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-IN';

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      onEnd && onEnd(false);
    };

    this.recognition.onend = () => {
      onEnd && onEnd(true);
    };

    this.recognition.start();
    return true;
  },

  speak(text, callback) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 0.9;
      if (callback) utterance.onend = callback;
      speechSynthesis.speak(utterance);
      return true;
    }
    return false;
  },

  stopSpeaking() {
    speechSynthesis.cancel();
  },
};
