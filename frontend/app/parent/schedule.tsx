import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { colors, radius, shadow, spacing } from '@/src/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EVENTS = [
  { id: 1, day: 2, name: 'Mia', title: 'Math practice', time: '4:30 PM', accent: colors.orange },
  { id: 2, day: 2, name: 'Leo', title: 'Science reading', time: '6:00 PM', accent: colors.brand },
  { id: 3, day: 3, name: 'Ada', title: 'Story time', time: '7:15 PM', accent: colors.yellow },
  { id: 4, day: 4, name: 'Mia', title: 'Quiz: Fractions', time: '5:00 PM', accent: colors.orange },
];

export default function Schedule() {
  return (
    <ScreenShell greeting="THIS WEEK" title="Schedule" subtitle="A calm plan for your family." testID="parent-schedule">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {DAYS.map((d, i) => (
          <View key={d} style={[styles.dayChip, i === 2 && styles.dayChipActive]}>
            <Text style={[styles.dayChipLabel, i === 2 && styles.dayChipLabelActive]}>{d}</Text>
            <Text style={[styles.dayChipNum, i === 2 && styles.dayChipNumActive]}>{10 + i}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.section}>Wednesday · Today</Text>
      <View style={{ gap: spacing.sm }}>
        {EVENTS.map((e) => (
          <PressableCard key={e.id} style={styles.event} testID={`event-${e.id}`}>
            <View style={[styles.eventDot, { backgroundColor: e.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>{e.title}</Text>
              <Text style={styles.eventMeta}>{e.name} · {e.time}</Text>
            </View>
            <View style={styles.eventPill}>
              <Feather name="clock" size={12} color={colors.onSurface} />
              <Text style={styles.eventPillText}>25 min</Text>
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  days: { gap: spacing.sm, paddingRight: spacing.lg },
  dayChip: {
    width: 56, height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  dayChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayChipLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceMuted },
  dayChipLabelActive: { color: '#FFF' },
  dayChipNum: { marginTop: 4, fontSize: 18, fontWeight: '800', color: colors.onSurface },
  dayChipNumActive: { color: '#FFF' },
  section: { fontSize: 17, fontWeight: '800', color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.md },
  event: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  eventDot: { width: 10, height: 10, borderRadius: 999 },
  eventTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  eventMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  eventPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  eventPillText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
});
