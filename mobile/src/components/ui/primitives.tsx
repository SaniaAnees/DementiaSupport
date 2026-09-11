import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export function Screen({
  children,
  style,
  patient,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  patient?: boolean;
}) {
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: patient ? colors.patientBg : colors.bg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({
  children,
  patient,
  style,
}: {
  children: React.ReactNode;
  patient?: boolean;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        styles.title,
        { color: patient ? colors.patientInk : colors.ink },
        patient && { fontSize: typography.patientPrompt },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  patient,
  muted,
  style,
}: {
  children: React.ReactNode;
  patient?: boolean;
  muted?: boolean;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        styles.body,
        {
          color: patient
            ? muted
              ? '#B7C4BC'
              : colors.patientInk
            : muted
              ? colors.inkMuted
              : colors.ink,
          fontSize: patient ? typography.patientBody : typography.caregiverBody,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  patient,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  patient?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
} & Omit<PressableProps, 'onPress' | 'style'>) {
  const bg =
    variant === 'primary'
      ? patient
        ? colors.patientAccent
        : colors.accent
      : variant === 'secondary'
        ? patient
          ? colors.patientSurface
          : colors.accentSoft
        : 'transparent';
  const color =
    variant === 'primary'
      ? patient
        ? colors.patientBg
        : '#fff'
      : patient
        ? colors.patientInk
        : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, minHeight: patient ? 72 : 52 },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: colors.patientAccent, borderColor: colors.patientAccent },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          selected && { color: colors.patientBg, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.caregiverTitle,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  body: {
    lineHeight: 24,
  },
  button: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonLabel: {
    fontSize: typography.button,
    fontWeight: '700',
  },
  chip: {
    borderWidth: 2,
    borderColor: colors.patientAccent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 64,
    justifyContent: 'center',
    backgroundColor: colors.patientSurface,
  },
  chipLabel: {
    color: colors.patientInk,
    fontSize: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
});
