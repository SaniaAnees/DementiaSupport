import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { memoryRepo, patientRepo, sessionRepo } from '@/src/db/repos';
import { buildEveningSession, buildMorningSession } from '@/src/sessions/engine';
import { useSessionStore } from '@/src/store/sessionStore';
import type { SessionType } from '@/src/types/models';
import { colors, spacing } from '@/src/theme/tokens';
import { newId, nowIso } from '@/src/utils/ids';

export default function SessionStart() {
  const params = useLocalSearchParams<{ type?: string; patientId?: string }>();
  const setSession = useSessionStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const type = (params.type === 'evening' ? 'evening' : 'morning') as SessionType;
        const patientId = params.patientId;
        if (!patientId) {
          setError('No patient selected.');
          return;
        }
        const patient = await patientRepo.get(patientId);
        if (!patient) {
          setError('Patient not found.');
          return;
        }
        const memories = await memoryRepo.listByPatient(patientId);
        if (type === 'morning' && memories.length < 1) {
          setError('Add at least one memory photo before starting the morning session.');
          return;
        }
        const items =
          type === 'morning' ? buildMorningSession(memories) : buildEveningSession(patient, memories);
        if (!items.length) {
          setError('Could not build session items. Check patient profile fields and memories.');
          return;
        }
        const sessionId = newId();
        const startedAt = nowIso();
        await sessionRepo.upsert({
          id: sessionId,
          patient_id: patientId,
          session_type: type,
          started_at: startedAt,
          ended_at: null,
          accuracy: null,
          avg_response_ms: null,
          hints_used: 0,
          repetitions: 0,
          composite_score: null,
          notes: null,
          created_at: startedAt,
          updated_at: startedAt,
          sync_status: 'pending',
        });
        await sessionRepo.insertItems(
          items.map((item, index) => ({
            id: item.id,
            session_id: sessionId,
            item_type: item.item_type,
            memory_id: item.memory_id,
            prompt_text: item.prompt_text,
            expected_answers: JSON.stringify(item.expected_answers),
            sort_order: index,
          }))
        );
        setSession({ patientId, sessionId, sessionType: type, items, startedAt });
        router.replace(
          type === 'morning'
            ? '/(patient)/session/morning/0'
            : '/(patient)/session/evening/0'
        );
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [params.type, params.patientId, setSession]);

  if (loading) {
    return (
      <Screen patient>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.patientAccent} size="large" />
          <Body patient style={{ marginTop: spacing.md }}>
            Preparing your session…
          </Body>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen patient>
        <Title patient>Almost ready</Title>
        <Body patient style={{ marginBottom: spacing.lg }}>
          {error}
        </Body>
        <PrimaryButton patient label="Back" onPress={() => router.replace('/(caregiver)/home')} />
      </Screen>
    );
  }

  return null;
}
