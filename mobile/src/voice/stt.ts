/**
 * STT is device-dependent. For Expo Go / emulators we rely on large answer chips.
 * This module documents the listening UX contract used by patient sessions.
 */
export type ListenState = 'idle' | 'listening' | 'unsupported';

export function isSttLikelyAvailable(): boolean {
  // Chip-first for reliable hackathon demos on Expo Go; native STT can be wired in a dev build.
  return false;
}
