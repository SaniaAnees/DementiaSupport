import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { caregiverRepo, patientRepo } from '@/src/db/repos';
import { useAppStore } from '@/src/store/appStore';
import { colors, radii, spacing } from '@/src/theme/tokens';
import { newId, nowIso } from '@/src/utils/ids';

export default function NewPatient() {
  const setActivePatientId = useAppStore((s) => s.setActivePatientId);
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [age, setAge] = useState('');
  const [hometown, setHometown] = useState('');
  const [notes, setNotes] = useState('');
  const [recs, setRecs] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter the patient’s full name.');
      return;
    }
    setSaving(true);
    try {
      let caregiver = await caregiverRepo.getPrimary();
      const ts = nowIso();
      if (!caregiver) {
        caregiver = {
          id: 'demo-caregiver',
          name: 'Demo Caregiver',
          email: null,
          created_at: ts,
          updated_at: ts,
          sync_status: 'pending',
        };
        await caregiverRepo.upsert(caregiver);
      }
      const id = newId();
      await patientRepo.upsert({
        id,
        caregiver_id: caregiver.id,
        full_name: fullName.trim(),
        preferred_name: preferredName.trim() || null,
        age: age ? Number(age) : null,
        hometown: hometown.trim() || null,
        dementia_notes: notes.trim() || null,
        medical_recommendations: recs.trim() || null,
        language_code: 'en-IN',
        created_at: ts,
        updated_at: ts,
        sync_status: 'pending',
      });
      setActivePatientId(id);
      router.replace(`/(caregiver)/patient/${id}/memories`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Title>Create patient</Title>
        <Body muted style={{ marginBottom: spacing.md }}>
          Works fully offline. Add memories next.
        </Body>
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field label="Preferred name" value={preferredName} onChangeText={setPreferredName} />
        <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Field label="Hometown" value={hometown} onChangeText={setHometown} />
        <Field label="Dementia notes" value={notes} onChangeText={setNotes} multiline />
        <Field label="Recommendations" value={recs} onChangeText={setRecs} multiline />
        <PrimaryButton label={saving ? 'Saving…' : 'Save patient'} onPress={save} disabled={saving} />
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
        placeholderTextColor={colors.inkMuted}
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
