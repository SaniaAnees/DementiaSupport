import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Body, Card, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { memoryRepo } from '@/src/db/repos';
import type { Memory, MemoryCategory } from '@/src/types/models';
import { colors, radii, spacing } from '@/src/theme/tokens';
import { pickAndStoreMemoryImage } from '@/src/utils/images';
import { newId, nowIso } from '@/src/utils/ids';

export default function MemoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [aliases, setAliases] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('person');

  const load = useCallback(async () => {
    if (!id) return;
    setMemories(await memoryRepo.listByPatient(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const add = async () => {
    if (!id) return;
    if (!uri || !caption.trim() || !shortLabel.trim()) {
      Alert.alert('Missing fields', 'Photo, caption, and short label are required.');
      return;
    }
    const ts = nowIso();
    await memoryRepo.upsert({
      id: newId(),
      patient_id: id,
      local_uri: uri,
      remote_url: null,
      caption: caption.trim(),
      short_label: shortLabel.trim(),
      aliases: JSON.stringify(
        aliases
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      category,
      sort_order: memories.length,
      created_at: ts,
      updated_at: ts,
      sync_status: 'pending',
    });
    setUri(null);
    setCaption('');
    setShortLabel('');
    setAliases('');
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Title>Family memories</Title>
        <Body muted style={{ marginBottom: spacing.md }}>
          Photos become the patient’s personalized session content.
        </Body>

        <Card>
          <PrimaryButton
            label={uri ? 'Change photo' : 'Pick photo'}
            variant="secondary"
            onPress={async () => {
              const picked = await pickAndStoreMemoryImage();
              if (picked) setUri(picked);
            }}
          />
          {uri ? <Image source={{ uri }} style={styles.preview} /> : null}
          <Field label="Caption" value={caption} onChangeText={setCaption} placeholder="This is your daughter, Meera" />
          <Field label="Short label" value={shortLabel} onChangeText={setShortLabel} placeholder="Meera" />
          <Field label="Aliases (comma-separated)" value={aliases} onChangeText={setAliases} placeholder="daughter, my daughter" />
          <View style={styles.cats}>
            {(['person', 'place', 'object'] as MemoryCategory[]).map((c) => (
              <PrimaryButton
                key={c}
                label={c}
                variant={category === c ? 'primary' : 'secondary'}
                onPress={() => setCategory(c)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
          <PrimaryButton label="Save memory" onPress={add} style={{ marginTop: spacing.sm }} />
        </Card>

        {memories.map((m) => (
          <Card key={m.id}>
            <Image source={{ uri: m.local_uri }} style={styles.thumb} />
            <Text style={styles.label}>{m.short_label}</Text>
            <Body muted>{m.caption}</Body>
            <PrimaryButton
              label="Delete"
              variant="ghost"
              onPress={async () => {
                await memoryRepo.remove(m.id);
                await load();
              }}
            />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Body muted style={{ marginBottom: 4 }}>
        {label}
      </Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 180, borderRadius: 12, marginTop: 12 },
  thumb: { width: '100%', height: 140, borderRadius: 12, marginBottom: 8 },
  label: { fontWeight: '700', fontSize: 18, color: colors.ink },
  cats: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.bgSoft,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
});
