import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { patientRepo } from '@/src/db/repos';
import { colors, radii, spacing } from '@/src/theme/tokens';
import { nowIso } from '@/src/utils/ids';

export default function EditPatient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [age, setAge] = useState('');
  const [hometown, setHometown] = useState('');
  const [notes, setNotes] = useState('');
  const [recs, setRecs] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const p = await patientRepo.get(id);
      if (!p) return;
      setFullName(p.full_name);
      setPreferredName(p.preferred_name || '');
      setAge(p.age != null ? String(p.age) : '');
      setHometown(p.hometown || '');
      setNotes(p.dementia_notes || '');
      setRecs(p.medical_recommendations || '');
    })();
  }, [id]);

  const save = async () => {
    if (!id || !fullName.trim()) {
      Alert.alert('Name required');
      return;
    }
    const existing = await patientRepo.get(id);
    if (!existing) return;
    await patientRepo.upsert({
      ...existing,
      full_name: fullName.trim(),
      preferred_name: preferredName.trim() || null,
      age: age ? Number(age) : null,
      hometown: hometown.trim() || null,
      dementia_notes: notes.trim() || null,
      medical_recommendations: recs.trim() || null,
      updated_at: nowIso(),
      sync_status: 'pending',
    });
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Title>Edit patient</Title>
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field label="Preferred name" value={preferredName} onChangeText={setPreferredName} />
        <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Field label="Hometown" value={hometown} onChangeText={setHometown} />
        <Field label="Dementia notes" value={notes} onChangeText={setNotes} multiline />
        <Field label="Recommendations" value={recs} onChangeText={setRecs} multiline />
        <PrimaryButton label="Save changes" onPress={save} />
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Body muted style={{ marginBottom: 6 }}>
        {label}
      </Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
});
