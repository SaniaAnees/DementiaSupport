import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '../utils/ids';

export async function pickAndStoreMemoryImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const src = result.assets[0].uri;
  const base = FileSystem.documentDirectory;
  if (!base) return src;
  const dir = `${base}memories/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${newId()}.jpg`;
  await FileSystem.copyAsync({ from: src, to: dest });
  return dest;
}
