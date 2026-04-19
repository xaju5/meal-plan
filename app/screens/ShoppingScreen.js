import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getClient } from '../lib/supabase';
import WeekNavigator from '../components/WeekNavigator';
import IngredientCard from '../components/IngredientCard';
import { useTranslation } from 'react-i18next';

function getWeekNumber(offsetWeeks = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetWeeks * 7);
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

async function fetchOrCreateWeekId(client, year, week) {
  const { data: existing } = await client
    .from('weeks')
    .select('id')
    .eq('year', year)
    .eq('week_number', week)
    .single();
  if (existing) return existing.id;

  const { data, error } = await client
    .from('weeks')
    .insert({ year, week_number: week })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function fetchDishIds(client, weekId) {
  const { data } = await client
    .from('week_plan')
    .select('dish_id')
    .eq('week_id', weekId)
    .not('dish_id', 'is', null);
  return [...new Set((data || []).map(p => p.dish_id))];
}

async function fetchIngredientIds(client, dishIds) {
  if (dishIds.length === 0) return [];
  const { data } = await client
    .from('dish_ingredients')
    .select('ingredient_id')
    .in('dish_id', dishIds);
  return [...new Set((data || []).map(d => d.ingredient_id))];
}

async function syncShoppingItems(client, weekId, ingredientIds) {
  const { data: existing } = await client
    .from('shopping_items')
    .select('id, ingredient_id')
    .eq('week_id', weekId);

  const existingMap = new Map((existing || []).map(e => [e.ingredient_id, e.id]));
  const incomingSet = new Set(ingredientIds);

  const toInsert = ingredientIds.filter(id => !existingMap.has(id));
  const toDelete = [...existingMap.entries()]
    .filter(([ingredient_id]) => !incomingSet.has(ingredient_id))
    .map(([, id]) => id);

  if (toDelete.length > 0) {
    const { error } = await client
      .from('shopping_items').delete().in('id', toDelete);
    if (error) console.error('syncShoppingItems delete error:', error.message);
  }

  if (toInsert.length > 0) {
    const { error } = await client.from('shopping_items').insert(
      toInsert.map(ingredient_id => ({ week_id: weekId, ingredient_id, checked: false }))
    );
    if (error) console.error('syncShoppingItems insert error:', error.message);
  }
}

async function buildEnrichedItems(client, weekId, dishIds) {
  const { data: shoppingData, error } = await client
    .from('shopping_items')
    .select('id, checked, ingredient_id, ingredients(name)')
    .eq('week_id', weekId);

  if (error) { console.error('buildEnrichedItems error:', error.message); return []; }
  if (!shoppingData || shoppingData.length === 0) return [];
  if (dishIds.length === 0) return shoppingData.map(i => ({ ...i, dishes: [] }));

  const { data: weekPlanData } = await client
    .from('week_plan')
    .select('dish_id, dishes(name)')
    .eq('week_id', weekId)
    .not('dish_id', 'is', null);

  const { data: dishIngredients } = await client
    .from('dish_ingredients')
    .select('ingredient_id, dish_id')
    .in('dish_id', dishIds);

  const dishNamesBySlot = (weekPlanData || []).map(wp => ({
    dish_id: wp.dish_id,
    name: wp.dishes.name,
  }));

  const dishesPerIngredient = {};
  (dishIngredients || []).forEach(di => {
    const key = di.ingredient_id;
    if (!dishesPerIngredient[key]) dishesPerIngredient[key] = [];
    const matchingSlots = dishNamesBySlot.filter(d => d.dish_id === di.dish_id);
    dishesPerIngredient[key].push(...matchingSlots.map(d => d.name));
  });

  return shoppingData
    .map(item => ({
      ...item,
      dishes: dishesPerIngredient[item.ingredient_id] || [],
    }))
    .sort((a, b) => a.ingredients.name.localeCompare(b.ingredients.name));
}

async function cleanupPastWeeks(client, currentYear, currentWeek) {
  const { data: allWeeks } = await client.from('weeks').select('id, year, week_number');
  if (!allWeeks) return;

  const pastWeeks = allWeeks.filter(w => isPastWeek(w.year, w.week_number, { year: currentYear, week: currentWeek }));

  for (const w of pastWeeks) {
    const { count: planCount } = await client
      .from('week_plan').select('id', { count: 'exact', head: true }).eq('week_id', w.id);
    const { count: shoppingCount } = await client
      .from('shopping_items').select('id', { count: 'exact', head: true }).eq('week_id', w.id);

    if (planCount === 0 && shoppingCount === 0) {
      await client.from('weeks').delete().eq('id', w.id);
    } else if (shoppingCount > 0) {
      await client.from('shopping_items').delete().eq('week_id', w.id);
      if (planCount === 0) await client.from('weeks').delete().eq('id', w.id);
    }
  }
}

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const current = getWeekNumber(0);
  const [year, setYear] = useState(current.year);
  const [week, setWeek] = useState(current.week);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isCurrentWeek = year === current.year && week === current.week;

  const loadShopping = useCallback(async () => {
    setLoading(true);
    try {
      const client = await getClient();

      await cleanupPastWeeks(client, current.year, current.week);

      const weekId = await fetchOrCreateWeekId(client, year, week);
      const dishIds = await fetchDishIds(client, weekId);
      const ingredientIds = await fetchIngredientIds(client, dishIds);

      await syncShoppingItems(client, weekId, ingredientIds);

      const enriched = await buildEnrichedItems(client, weekId, dishIds);
      setItems(enriched);
    } catch (e) {
      console.error('loadShopping error:', e.message);
      Alert.alert(t('error'), t('couldNotLoadShopping'));
    }
    setLoading(false);
  }, [year, week]);

  useEffect(() => { loadShopping(); }, [loadShopping]);

  useEffect(() => {
    let channel;
    (async () => {
      const client = await getClient();
      channel = client
        .channel('shopping_sync')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'shopping_items' },
          () => loadShopping()
        )
        .subscribe();
    })();
    return () => { if (channel) channel.unsubscribe(); };
  }, [loadShopping]);

  function goToPrevWeek() {
    if (isPastWeek(year, week - 1 || 52, current)) return;
    if (week === 1) { setYear(y => y - 1); setWeek(52); }
    else setWeek(w => w - 1);
  }

  function goToNextWeek() {
    if (week === 52) { setYear(y => y + 1); setWeek(1); }
    else setWeek(w => w + 1);
  }

  async function toggleItem(item) {
    const newChecked = !item.checked;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newChecked } : i));
    try {
      const client = await getClient();
      const { error } = await client
        .from('shopping_items').update({ checked: newChecked }).eq('id', item.id);
      if (error) throw error;
    } catch (e) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: item.checked } : i));
      Alert.alert(t('error'), t('couldNotUpdate'));
    }
  }

  async function exportToClipboard() {
    const pending = items.filter(i => !i.checked);
    if (pending.length === 0) {
      Alert.alert(t('error'), t('nothingToExport'));
      return;
    }
    const text = pending.map(i => `${i.ingredients.name} x${i.dishes.length}`).join('\n');
    await Clipboard.setStringAsync(text);
    Alert.alert(t('copied'), t('listCopied'));
  }

  const pending = items.filter(i => !i.checked);
  const done = items.filter(i => i.checked);
  const listData = [
    ...pending,
    ...(done.length > 0 ? [{ id: '__divider__' }] : []),
    ...done
  ];

  function renderItem({ item }) {
    if (item.id === '__divider__') {
      return (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('checked')}</Text>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    return <IngredientCard item={item} onToggle={toggleItem} />;
  }

  const canGoPrev = !isPastWeek(year, week, current) &&
    !(year === current.year && week === current.week);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
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
        disablePast={true}
      />

      <View style={styles.subHeader}>
        <Text style={styles.subHeaderTitle}>
          {t('itemsLeft', { count: pending.length.toString() })}
        </Text>
        <View style={styles.subHeaderActions}>
          {syncing && <ActivityIndicator size="small" color="#4CAF50" style={{ marginRight: 8 }} />}
          <TouchableOpacity onPress={exportToClipboard} style={styles.exportButton}>
            <Ionicons name="copy-outline" size={18} color="#4CAF50" />
            <Text style={styles.exportText}>{t('copyList')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadShopping}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
        >
          <Text style={styles.emptyTitle}>{t('noIngredientsWeek')}</Text>
          <Text style={styles.emptySubtitle}>{t('assignDishes')}</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadShopping}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyContainer: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
},
  subHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: 'white',
    paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  subHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  subHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  exportButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50',
  },
  exportText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },

  list: { padding: 12, paddingBottom: 32 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 10, gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: {
    fontSize: 11, color: '#bbb', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#555', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 20 },
});