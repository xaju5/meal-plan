import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClient } from '../lib/supabase';
import WeekDishPicker from '../components/WeekDishPicker';
import WeekNavigator from '../components/WeekNavigator';
import { getWeeksAgoLabel, computeWeeksAgo } from '../hooks/useLastUsedLabel';
import { useTranslation } from 'react-i18next';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKEND = ['saturday', 'sunday'];
const LUNCH_SLOTS = ['lunch_first', 'lunch_second'];
const DINNER_SLOTS = ['dinner_first', 'dinner_second'];


function getCurrentWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return {
    year: d.getFullYear(),
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  };
}

function isPastWeek(year, week, current) {
  return year < current.year || (year === current.year && week < current.week);
}

function SlotCell({ entry, onPress, isLunch, isPast }) {
  return (
    <TouchableOpacity
      style={[
        styles.slotCell,
        isPast ? styles.slotCellPast : (isLunch ? styles.slotCellLunch : styles.slotCellDinner),
        !isPast && entry?.dish_id && (isLunch ? styles.slotCellLunchFilled : styles.slotCellDinnerFilled)
      ]}
      onPress={onPress}
      activeOpacity={isPast ? 0.5 : 0.7}
    >
      <Text
        style={[
          styles.slotText,
          !entry?.dish_id && styles.slotEmpty,
          isPast && entry?.dish_id && styles.slotTextPast,
          !isPast && entry?.dish_id && (isLunch ? styles.slotTextLunch : styles.slotTextDinner)
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {entry?.dishes?.name || '—'}
      </Text>
    </TouchableOpacity>
  );
}

export default function WeekScreen() {
  const { t } = useTranslation();
  const current = getCurrentWeek();
  const [year, setYear] = useState(current.year);
  const [week, setWeek] = useState(current.week);
  const [weekId, setWeekId] = useState(null);
  const [weekPlan, setWeekPlan] = useState({});
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectingSlot, setSelectingSlot] = useState(null);
  const DAY_LABELS = {
    monday: t('mon'),
    tuesday: t('tue'),
    wednesday: t('wed'),
    thursday: t('thu'),
    friday: t('fri'),
    saturday: t('sat'),
    sunday: t('sun'),
  };

  const isCurrentWeek = year === current.year && week === current.week;
  const past = isPastWeek(year, week, current);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const client = await getClient();

    const [{ data: dishesData }, { data: weekData }, { data: allWeekPlan }] = await Promise.all([
      client.from('dishes').select('id, name').order('name'),
      client.from('weeks').select('id').eq('year', year).eq('week_number', week).single(),
      client.from('week_plan').select('dish_id, weeks(year, week_number)').not('dish_id', 'is', null)
    ]);
    
    const lastUsedMap = {};
    (allWeekPlan || []).forEach(entry => {
      const { dish_id, weeks: w } = entry;
      if (!w) return;
      const prev = lastUsedMap[dish_id];
      if (!prev || w.year > prev.year ||
        (w.year === prev.year && w.week_number > prev.week_number)) {
        lastUsedMap[dish_id] = w;
      }
    });

    const enrichedDishes = (dishesData || []).map(dish => ({
      ...dish,
      weeksAgo: computeWeeksAgo(lastUsedMap[dish.id], year, week)
    }));

    setDishes(enrichedDishes);

    if (!weekData) {
      setWeekId(null);
      setWeekPlan({});
      setLoading(false);
      return;
    }

    setWeekId(weekData.id);

    const { data: planData } = await client
      .from('week_plan')
      .select('id, day, slot, dish_id, dishes(name)')
      .eq('week_id', weekData.id);

    const map = {};
    (planData || []).forEach(p => { map[`${p.day}_${p.slot}`] = p; });
    setWeekPlan(map);
    setLoading(false);
  }, [year, week]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  async function getOrCreateWeekId(client) {
    if (weekId) return weekId;

    const { data: existing } = await client
      .from('weeks').select('id')
      .eq('year', year).eq('week_number', week).single();

    if (existing) { setWeekId(existing.id); return existing.id; }

    const { data, error } = await client
      .from('weeks')
      .insert({ year, week_number: week })
      .select('id').single();

    if (error) throw error;
    setWeekId(data.id);
    return data.id;
  }

  async function cleanupWeekIfEmpty(client, id) {
    const { count } = await client
      .from('week_plan')
      .select('id', { count: 'exact', head: true })
      .eq('week_id', id);
    if (count === 0) {
      await client.from('weeks').delete().eq('id', id);
      setWeekId(null);
    }
  }

  async function handleSlotPress(day, slot) {
    const existing = weekPlan[`${day}_${slot}`];
    if (existing?.dish_id) {
      Alert.alert(
        t('removeDish'),
        t('removeConfirm', { name: existing.dishes.name }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('remove'), style: 'destructive',
            onPress: async () => {
              const client = await getClient();
              await client.from('week_plan').delete().eq('id', existing.id);
              await cleanupWeekIfEmpty(client, weekId);
              loadWeek();
            }
          }
        ]
      );
    } else {
      setSelectingSlot({ day, slot });
    }
  }

  async function handleSelectDish(dish) {
    const { day, slot } = selectingSlot;
    setSelectingSlot(null);
    const client = await getClient();
    try {
      const id = await getOrCreateWeekId(client);
      const existing = weekPlan[`${day}_${slot}`];
      if (existing) {
        const { error } = await client.from('week_plan')
          .update({ dish_id: dish.id }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('week_plan')
          .insert({ week_id: id, day, slot, dish_id: dish.id });
        if (error) throw error;
      }
      await loadWeek();
    } catch (e) {
      Alert.alert(t('error'), `Could not assign dish: ${e.message}`);
    }
  }

  function goToPrevWeek() {
    if (week === 1) { setYear(y => y - 1); setWeek(52); }
    else setWeek(w => w - 1);
  }

  function goToNextWeek() {
    if (week === 52) { setYear(y => y + 1); setWeek(1); }
    else setWeek(w => w + 1);
  }

  return (
    <View style={styles.container}>
      <WeekNavigator
        year={year}
        week={week}
        currentYear={current.year}
        currentWeek={current.week}
        onPrev={goToPrevWeek}
        onNext={goToNextWeek}
        onReset={() => { setYear(current.year); setWeek(current.week); }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadWeek}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
        >
          <View style={styles.columnHeaders}>
            <View style={styles.dayLabelSpacer} />
            <View style={styles.mealIconSpacer} />
            <Text style={styles.columnHeader}>{t('first')}</Text>
            <Text style={styles.columnHeader}>{t('second')}</Text>
          </View>

          {DAYS.map(day => {
            const isWeekend = WEEKEND.includes(day);
            return (
              <View key={day} style={[
                styles.dayCard,
                isWeekend && !past && styles.dayCardWeekend,
                past && styles.dayCardPast,
              ]}>
                <View style={[
                  styles.dayLabelContainer,
                  isWeekend && !past && styles.dayLabelContainerWeekend,
                  past && styles.dayLabelContainerPast,
                ]}>
                  <Text style={[
                    styles.dayLabel,
                    isWeekend && !past && styles.dayLabelWeekend,
                    past && styles.dayLabelPast,
                  ]}>
                    {DAY_LABELS[day]}
                  </Text>
                </View>

                <View style={styles.slotsContainer}>
                  <View style={styles.mealRow}>
                    <Ionicons name="sunny" size={13}
                      color={past ? '#bbb' : '#f59f00'}
                      style={styles.mealIcon}
                    />
                    <View style={styles.slotPair}>
                      {LUNCH_SLOTS.map(slot => (
                        <SlotCell
                          key={slot}
                          entry={weekPlan[`${day}_${slot}`]}
                          onPress={() => handleSlotPress(day, slot)}
                          isLunch={true}
                          isPast={past}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.mealRow}>
                    <Ionicons name="moon" size={13}
                      color={past ? '#bbb' : '#7c5cbf'}
                      style={styles.mealIcon}
                    />
                    <View style={styles.slotPair}>
                      {DINNER_SLOTS.map(slot => (
                        <SlotCell
                          key={slot}
                          entry={weekPlan[`${day}_${slot}`]}
                          onPress={() => handleSlotPress(day, slot)}
                          isLunch={false}
                          isPast={past}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
      <WeekDishPicker
        visible={!!selectingSlot}
        dishes={dishes}
        onSelect={handleSelectDish}
        onClose={() => setSelectingSlot(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scroll: { padding: 8, paddingBottom: 16 },

  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  dayLabelSpacer: { width: 36 },
  mealIconSpacer: { width: 26 },
  columnHeader: {
    flex: 1, fontSize: 10, fontWeight: '700',
    color: '#aaa', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  dayCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  dayCardWeekend: { backgroundColor: '#fffdf5' },
  dayCardPast: { backgroundColor: '#f4f4f4' },

  dayLabelContainer: {
    width: 36, backgroundColor: '#f0faf0',
    justifyContent: 'center', alignItems: 'center',
    paddingVertical: 8,
  },
  dayLabelContainerWeekend: { backgroundColor: '#fff8e1' },
  dayLabelContainerPast: { backgroundColor: '#ebebeb' },

  dayLabel: {
    fontSize: 11, fontWeight: '800', color: '#2e7d32',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  dayLabelWeekend: { color: '#f59f00' },
  dayLabelPast: { color: '#aaa' },

  slotsContainer: {
    flex: 1, paddingVertical: 5,
    paddingHorizontal: 8, gap: 3,
  },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealIcon: { width: 14 },
  slotPair: { flex: 1, flexDirection: 'row', gap: 4 },

  slotCell: {
    flex: 1, borderRadius: 5,
    paddingVertical: 5, paddingHorizontal: 6,
    borderLeftWidth: 2,
  },
  slotCellLunch: { backgroundColor: '#f0faf0', borderLeftColor: '#81c784' },
  slotCellDinner: { backgroundColor: '#f0f0ff', borderLeftColor: '#9575cd' },
  slotCellLunchFilled: { backgroundColor: '#d4edda', borderLeftColor: '#4CAF50' },
  slotCellDinnerFilled: { backgroundColor: '#e8e4f8', borderLeftColor: '#673ab7' },
  slotCellPast: { backgroundColor: '#f0f0f0', borderLeftColor: '#ddd' },

  slotText: { fontSize: 12, color: '#333' },
  slotEmpty: { color: '#ccc', fontStyle: 'italic' },
  slotTextLunch: { color: '#2e7d32', fontWeight: '600' },
  slotTextDinner: { color: '#4527a0', fontWeight: '600' },
  slotTextPast: { color: '#999', fontWeight: '500' },

});