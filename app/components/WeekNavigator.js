import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

function getWeekLabel(year, week) {
  const { t } = useTranslation();
  const jan1 = new Date(year, 0, 1);
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + (week - 1) * 7 - (jan1.getDay() || 7) + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toLocaleDateString(t('languageCode'), { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export default function WeekNavigator({
  year,
  week,
  currentYear,
  currentWeek,
  onPrev,
  onNext,
  onReset,
  disablePast = false,
}) {
  const { t } = useTranslation();
  const isCurrentWeek = year === currentYear && week === currentWeek;
  const isPast = year < currentYear || (year === currentYear && week < currentWeek);
  const canGoPrev = disablePast ? !isCurrentWeek && !isPast : true;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onPrev}
        style={styles.arrowButton}
        disabled={!canGoPrev}
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color={canGoPrev ? '#4CAF50' : '#ddd'}
        />
      </TouchableOpacity>

      <TouchableOpacity onPress={onReset} style={styles.weekLabel}>
        <Text style={styles.weekText}>{getWeekLabel(year, week)}</Text>
        <Text style={styles.weekBadge}>
          {isCurrentWeek ? t('thisWeekBadge') : t('tapToReset')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.arrowButton}>
        <Ionicons name="chevron-forward" size={22} color="#4CAF50" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  arrowButton: { padding: 6 },
  weekLabel: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 0.3 },
  weekBadge: { fontSize: 10, color: '#4CAF50', marginTop: 2 },
});