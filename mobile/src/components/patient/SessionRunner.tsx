import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { BuiltSessionItem } from '../../types/models';
import { Body, Chip, PrimaryButton, Screen, Title } from '../ui/primitives';
import { colors, spacing } from '../../theme/tokens';
import { speak, stopSpeaking } from '../../voice/tts';
import { gradeAnswer } from '../../sessions/engine';
import { useSessionStore } from '../../store/sessionStore';

export function SessionRunner({
  mode,
}: {
  mode: 'morning' | 'evening';
}) {
  const { items, stepIndex, setStep, pushResult, sessionId } = useSessionStore();
  const item = items[stepIndex] as BuiltSessionItem | undefined;
  const [listeningPulse, setListeningPulse] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const startedRef = useRef<number>(Date.now());
  const advancing = useRef(false);

  useEffect(() => {
    if (!item) return;
    advancing.current = false;
    setFeedback(null);
    setHintsUsed(0);
    setRepetitions(0);
    startedRef.current = Date.now();
    const text =
      item.item_type === 'memory_teach'
        ? item.caption || item.prompt_text
        : item.prompt_text;
    speak(text);
    if (item.item_type !== 'memory_teach') {
      setListeningPulse(true);
    } else {
      setListeningPulse(false);
    }
    return () => {
      stopSpeaking();
      setListeningPulse(false);
    };
  }, [item?.id]);

  const progress = useMemo(
    () => `${stepIndex + 1} / ${items.length}`,
    [stepIndex, items.length]
  );

  if (!item || !sessionId) {
    return (
      <Screen patient>
        <ActivityIndicator color={colors.patientAccent} />
      </Screen>
    );
  }

  const finishOrNext = (payload: {
    isCorrect: boolean;
    transcript: string;
    hints: number;
    reps: number;
  }) => {
    if (advancing.current) return;
    advancing.current = true;
    const responseMs = Date.now() - startedRef.current;
    if (item.item_type !== 'memory_teach') {
      pushResult({
        itemId: item.id,
        isCorrect: payload.isCorrect,
        responseMs,
        hintsUsed: payload.hints,
        repetitions: payload.reps,
        transcript: payload.transcript,
      });
    }
    const next = stepIndex + 1;
    if (next >= items.length) {
      router.replace('/(patient)/session/summary');
    } else {
      setStep(next);
    }
  };

  const onChip = (label: string) => {
    const { isCorrect } = gradeAnswer(label, item.expected_answers);
    setFeedback(isCorrect ? 'Well done.' : 'That is okay. We will try again another day.');
    setTimeout(
      () =>
        finishOrNext({
          isCorrect,
          transcript: label,
          hints: hintsUsed,
          reps: repetitions,
        }),
      700
    );
  };

  return (
    <Screen patient style={{ paddingTop: spacing.xl }}>
      <Text style={styles.meta}>
        {mode === 'morning' ? 'Morning memories' : 'Evening orientation'} · {progress}
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {item.local_uri ? (
          <Image source={{ uri: item.local_uri }} style={styles.photo} accessibilityLabel="Memory photo" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={{ color: colors.patientInk, fontSize: 28 }}>?</Text>
          </View>
        )}

        <Title patient style={{ marginTop: spacing.lg }}>
          {item.item_type === 'memory_teach' ? item.caption : item.prompt_text}
        </Title>

        {listeningPulse && item.item_type !== 'memory_teach' ? (
          <View style={styles.listenRow}>
            <View style={styles.pulse} />
            <Body patient>Listening… or tap an answer below</Body>
          </View>
        ) : null}

        {feedback ? <Body patient style={{ marginVertical: spacing.sm }}>{feedback}</Body> : null}

        {item.item_type === 'memory_teach' ? (
          <PrimaryButton
            patient
            label="Next"
            onPress={() =>
              finishOrNext({ isCorrect: true, transcript: '', hints: 0, reps: 0 })
            }
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            {(item.chip_options || item.expected_answers.slice(0, 1)).map((opt) => (
              <Chip key={opt} label={opt} onPress={() => onChip(opt)} />
            ))}
          </View>
        )}

        <View style={styles.controls}>
          <PrimaryButton
            patient
            variant="secondary"
            label="Repeat"
            onPress={() => {
              setRepetitions((r) => r + 1);
              speak(item.item_type === 'memory_teach' ? item.caption || item.prompt_text : item.prompt_text);
            }}
            style={{ flex: 1 }}
          />
          {item.item_type !== 'memory_teach' ? (
            <PrimaryButton
              patient
              variant="secondary"
              label="Hint"
              onPress={() => {
                setHintsUsed((h) => h + 1);
                speak(item.hint_text || 'Take your time.');
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          {item.item_type !== 'memory_teach' ? (
            <PrimaryButton
              patient
              variant="ghost"
              label="Skip"
              onPress={() =>
                finishOrNext({
                  isCorrect: false,
                  transcript: '',
                  hints: hintsUsed,
                  reps: repetitions,
                })
              }
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: '#9AABB3',
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: 20,
    backgroundColor: colors.patientSurface,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.sm,
  },
  pulse: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.listening,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
  },
});
