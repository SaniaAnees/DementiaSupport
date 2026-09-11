import { useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Body, Card, Screen, Title } from '@/src/components/ui/primitives';
import { patientRepo, sessionRepo } from '@/src/db/repos';
import { classifyTrend, maybeCreateTrendAlert } from '@/src/insights/trends';
import { useAppStore } from '@/src/store/appStore';
import type { Session } from '@/src/types/models';
import { colors, spacing } from '@/src/theme/tokens';

export default function DashboardScreen() {
  const activePatientId = useAppStore((s) => s.activePatientId);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState('');
  const [insight, setInsight] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const patients = await patientRepo.list();
        const pid = activePatientId || patients[0]?.id;
        if (!pid) return;
        const p = await patientRepo.get(pid);
        setName(p?.preferred_name || p?.full_name || '');
        const list = await sessionRepo.listByPatient(pid);
        setSessions(list);
        const trend = await maybeCreateTrendAlert(pid, list);
        setInsight(`${trend.state}: ${trend.message}`);
      })();
    }, [activePatientId])
  );

  const chartData = useMemo(() => {
    return [...sessions]
      .filter((s) => s.composite_score != null)
      .sort((a, b) => (a.started_at < b.started_at ? -1 : 1))
      .slice(-7)
      .map((s) => ({ value: s.composite_score || 0 }));
  }, [sessions]);

  const today = sessions.filter((s) => s.started_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const latest = sessions[0];
  const trend = classifyTrend(sessions);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Title>Progress</Title>
        <Body muted style={{ marginBottom: spacing.md }}>
          {name || 'Patient'} · continuous monitoring
        </Body>

        <Card>
          <Text style={styles.metricLabel}>Trend</Text>
          <Text style={styles.metricValue}>{trend.state.replace('_', ' ')}</Text>
          <Body muted>{insight || trend.message}</Body>
        </Card>

        <Card>
          <Text style={styles.metricLabel}>Latest session</Text>
          {latest ? (
            <>
              <Body>
                {latest.session_type} · score {latest.composite_score ?? '—'} · accuracy{' '}
                {latest.accuracy != null ? `${Math.round(latest.accuracy * 100)}%` : '—'}
              </Body>
              <Body muted>
                Avg response {latest.avg_response_ms ?? '—'} ms · hints {latest.hints_used} ·
                repeats {latest.repetitions}
              </Body>
            </>
          ) : (
            <Body muted>No sessions yet.</Body>
          )}
        </Card>

        <Card>
          <Text style={styles.metricLabel}>Today</Text>
          <Body>{today.length} session(s) recorded today</Body>
        </Card>

        <Card>
          <Text style={styles.metricLabel}>7-day composite score</Text>
          {chartData.length > 1 ? (
            <View style={{ marginTop: 8 }}>
              <LineChart
                data={chartData}
                width={Dimensions.get('window').width - 80}
                height={160}
                color={colors.accent}
                thickness={3}
                hideDataPoints={false}
                yAxisColor={colors.border}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.inkMuted }}
                noOfSections={4}
                maxValue={100}
              />
            </View>
          ) : (
            <Body muted>Complete a few sessions to see the chart.</Body>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricLabel: {
    fontSize: 13,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'capitalize',
    marginBottom: 6,
  },
});
