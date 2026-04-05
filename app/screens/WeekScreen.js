import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClient, getHouseCode } from '../lib/supabase';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
};
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

function getWeekLabel(year, week) {
  const jan1 = new Date(year, 0, 1);
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + (week - 1) * 7 - (jan1.getDay() || 7) + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function SlotCell({ entry, onPress, isLunch }) {
  return (
    <TouchableOpacity
      style={[styles.slotCell, isLunch ? styles.slotCellLunch : styles.slotCellDinner,
        entry?.dish_id && (isLunch ? styles.slotCellLunchFilled : styles.slotCellDinnerFilled)
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.slotText, !entry?.dish_id && styles.slotEmpty,
          entry?.dish_id && (isLunch ? styles.slotTextLunch : styles.slotTextDinner)
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
  const current = getCurrentWeek();
  const [year, setYear] = useState(current.year);
  const [week, setWeek] = useState(current.week);
  const [weekId, setWeekId] = useState(null);
  const [weekPlan, setWeekPlan] = useState({});
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectingSlot, setSelectingSlot] = useState(null);

  const isCurrentWeek = year === current.year && week === current.week;

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const client = await getClient();

    const [{ data: dishesData }, { data: weekData }] = await Promise.all([
      client.from('dishes').select('id, name').order('name'),
      client.from('weeks').select('id').eq('year', year).eq('week_number', week).single()
    ]);

    setDishes(dishesData || []);

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

    const houseCode = await getHouseCode();
    const { data, error } = await client
      .from('weeks')
      .insert({ year, week_number: week, house_code: houseCode })
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
        'Remove dish',
        `Remove "${existing.dishes.name}" from this slot?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove', style: 'destructive',
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
      setSelectingSlot(null);
      await loadWeek();
    } catch (e) {
      Alert.alert('Error', `Could not assign dish: ${e.message}`);
      setSelectingSlot(null);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevWeek} style={styles.arrowButton}>
          <Ionicons name="chevron-back" size={22} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setYear(current.year); setWeek(current.week); }}
          style={styles.weekLabel}
        >
          <Text style={styles.weekText}>{getWeekLabel(year, week)}</Text>
          <Text style={styles.weekBadge}>
            {isCurrentWeek ? 'this week' : 'tap to go to current week'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextWeek} style={styles.arrowButton}>
          <Ionicons name="chevron-forward" size={22} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Column headers */}
          <View style={styles.columnHeaders}>
            <View style={styles.dayLabelSpacer} />
            <View style={styles.mealIconSpacer} />
            <Text style={styles.columnHeader}>1st</Text>
            <Text style={styles.columnHeader}>2nd</Text>
          </View>
          {DAYS.map(day => {
            const isWeekend = WEEKEND.includes(day);
            return (
              <View key={day} style={[styles.dayCard, isWeekend && styles.dayCardWeekend]}>

                {/* Day label */}
                <View style={[styles.dayLabelContainer, isWeekend && styles.dayLabelContainerWeekend]}>
                  <Text style={[styles.dayLabel, isWeekend && styles.dayLabelWeekend]}>
                    {DAY_LABELS[day]}
                  </Text>
                </View>

                {/* Slots */}
                <View style={styles.slotsContainer}>

                  {/* Lunch row */}
                  <View style={styles.mealRow}>
                    <Ionicons name="sunny" size={12} color="#f59f00" style={styles.mealIcon} />
                    <View style={styles.slotPair}>
                      {LUNCH_SLOTS.map(slot => (
                        <SlotCell
                          key={slot}
                          entry={weekPlan[`${day}_${slot}`]}
                          onPress={() => handleSlotPress(day, slot)}
                          isLunch={true}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Dinner row */}
                  <View style={styles.mealRow}>
                    <Ionicons name="moon" size={12} color="#7c5cbf" style={styles.mealIcon} />
                    <View style={styles.slotPair}>
                      {DINNER_SLOTS.map(slot => (
                        <SlotCell
                          key={slot}
                          entry={weekPlan[`${day}_${slot}`]}
                          onPress={() => handleSlotPress(day, slot)}
                          isLunch={false}
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

      <Modal visible={!!selectingSlot} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select a dish</Text>
            <FlatList
              data={dishes}
              keyExtractor={d => d.id}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No dishes yet. Add some in the Dishes tab.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectDish(item)}>
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  <Ionicons name="add-circle-outline" size={22} color="#4CAF50" />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setSelectingSlot(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  arrowButton: { padding: 6 },
  weekLabel: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 0.3 },
  weekBadge: { fontSize: 10, color: '#4CAF50', marginTop: 2 },

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
  dayCardWeekend: {
    backgroundColor: '#fffdf5',
  },

  dayLabelContainer: {
    width: 36,
    backgroundColor: '#f0faf0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayLabelContainerWeekend: {
    backgroundColor: '#fff8e1',
  },
  dayLabel: {
    fontSize: 10, fontWeight: '800',
    color: '#2e7d32', letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayLabelWeekend: {
    color: '#f59f00',
  },

  slotsContainer: {
    flex: 1, paddingVertical: 5,
    paddingHorizontal: 8, gap: 4,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealIcon: { width: 14 },
  slotPair: {
    flex: 1, flexDirection: 'row', gap: 4,
  },

  slotCell: {
    flex: 1, borderRadius: 5,
    paddingVertical: 4, paddingHorizontal: 6,
    borderLeftWidth: 2,
  },
  slotCellLunch: { backgroundColor: '#f0faf0', borderLeftColor: '#81c784' },
  slotCellDinner: { backgroundColor: '#f0f0ff', borderLeftColor: '#9575cd' },
  slotCellLunchFilled: { backgroundColor: '#d4edda', borderLeftColor: '#4CAF50' },
  slotCellDinnerFilled: { backgroundColor: '#e8e4f8', borderLeftColor: '#673ab7' },

  slotText: { fontSize: 11, color: '#333' },
  slotEmpty: { color: '#ccc', fontStyle: 'italic' },
  slotTextLunch: { color: '#2e7d32', fontWeight: '600' },
  slotTextDinner: { color: '#4527a0', fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: 'white', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, paddingTop: 12,
    paddingHorizontal: 20, paddingBottom: 32, maxHeight: '70%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  modalItemText: { fontSize: 15, color: '#222' },
  modalEmpty: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingVertical: 32, fontStyle: 'italic' },
  modalCancel: {
    marginTop: 8, padding: 14, alignItems: 'center',
    borderRadius: 10, backgroundColor: '#f5f5f5',
  },
  modalCancelText: { fontSize: 15, color: '#888', fontWeight: '600' },
});