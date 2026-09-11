import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { sessionRepo } from '@/src/db/repos';
import { computeSessionScores } from '@/src/sessions/engine';
import { maybeCreateTrendAlert } from '@/src/insights/trends';
import { useSessionStore } from '@/src/store/sessionStore';
import { spacing } from '@/src/theme/tokens';
import { newId, nowIso } from '@/src/utils/ids';

export default function SessionSummary() {
  const { sessionId, patientId, sessionType, results, reset } = useSessionStore();
  const [scores, setScores] = useState<ReturnType<typeof computeSessionScores> | null>(null);

  useEffect(() => {
    (async () => {
      if (!sessionId || !patientId) return;
      const computed = computeSessionScores({
        results: results.map((r) => ({
          isCorrect: r.isCorrect,
          responseMs: r.responseMs,
          hintsUsed: r.hintsUsed,
          repetitions: r.repetitions,
        })),
      });
      setScores(computed);
      const existing = await sessionRepo.get(sessionId);
      if (existing) {
        await sessionRepo.upsert({
          ...existing,
          ended_at: nowIso(),
          accuracy: computed.accuracy,
          avg_response_ms: computed.avg_response_ms,
          hints_used: computed.hints_used,
          repetitions: computed.repetitions,
          composite_score: computed.composite_score,
          updated_at: nowIso(),
          sync_status: 'pending',
        });
      }
      for (const r of results) {
        await sessionRepo.insertResponse({
          id: newId(),
          session_item_id: r.itemId,
          session_id: sessionId,
          transcript: r.transcript,
          is_correct: r.isCorrect ? 1 : 0,
          response_ms: r.responseMs,
          hints_used: r.hintsUsed,
          repetitions: r.repetitions,
          match_score: r.isCorrect ? 1 : 0,
          created_at: nowIso(),
          sync_status: 'pending',
        });
      }
      const all = await sessionRepo.listByPatient(patientId);
      await maybeCreateTrendAlert(patientId, all);
    })();
  }, [sessionId, patientId, results]);

  return (
    <Screen patient>
      <Title patient>Session complete</Title>
      <Body patient muted style={{ marginBottom: spacing.lg }}>
        {sessionType === 'morning' ? 'Morning memories' : 'Evening orientation'} saved on this device.
      </Body>
      {scores ? (
        <View style={{ gap: 8, marginBottom: spacing.xl }}>
          <Body patient>Score: {scores.composite_score}</Body>
          <Body patient>Accuracy: {Math.round(scores.accuracy * 100)}%</Body>
          <Body patient>Avg response: {scores.avg_response_ms} ms</Body>
          <Body patient>
            Hints: {scores.hints_used} · Repeats: {scores.repetitions}
          </Body>
        </View>
      ) : (
        <Body patient>Saving…</Body>
      )}
      <PrimaryButton
        patient
        label="Back to caregiver home"
        onPress={() => {
          reset();
          router.replace('/(caregiver)/home');
        }}
      />
    </Screen>
  );
}
