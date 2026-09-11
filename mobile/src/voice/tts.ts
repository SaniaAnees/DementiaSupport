import * as Speech from 'expo-speech';

export function speak(text: string, language = 'en-IN'): Promise<void> {
  return new Promise((resolve) => {
    Speech.stop();
    Speech.speak(text, {
      language,
      rate: 0.85,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking() {
  Speech.stop();
}
