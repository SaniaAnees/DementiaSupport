import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Body, Card, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { memoryRepo, patientRepo } from '@/src/db/repos';
import type { Memory, Patient } from '@/src/types/models';
import { spacing } from '@/src/theme/tokens';

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!id) return;
        setPatient(await patientRepo.get(id));
        setMemories(await memoryRepo.listByPatient(id));
      })();
    }, [id])
  );

  if (!patient) {
    return (
      <Screen>
        <Body>Patient not found.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <Title>{patient.preferred_name || patient.full_name}</Title>
        <Body muted style={{ marginBottom: spacing.md }}>
          {patient.full_name}
          {patient.age != null ? ` · ${patient.age}` : ''}
          {patient.hometown ? ` · ${patient.hometown}` : ''}
        </Body>
        {patient.dementia_notes ? (
          <Card>
            <Body>{patient.dementia_notes}</Body>
          </Card>
        ) : null}
        <Body style={{ marginBottom: spacing.sm }}>{memories.length} memories saved</Body>
        <PrimaryButton
          label="Edit profile"
          variant="secondary"
          onPress={() => router.push(`/(caregiver)/patient/${id}/edit`)}
        />
        <PrimaryButton
          label="Manage memories"
          onPress={() => router.push(`/(caregiver)/patient/${id}/memories`)}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </Screen>
  );
}
