import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getClient } from '../lib/supabase';

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

async function fetchCurrentWeekId(client, year, week) {
  const { data } = await client
    .from('weeks')
    .select('id')
    .eq('year', year)
    .eq('week_number', week)
    .single();
  return data?.id || null;
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
      .from('shopping_items')
      .delete()
      .in('id', toDelete);
    if (error) console.error('syncShoppingItems delete error:', error.message);
  }

  if (toInsert.length > 0) {
    const { error } = await client.from('shopping_items').insert(
      toInsert.map(ingredient_id => ({
        week_id: weekId,
        ingredient_id,
        checked: false,
      }))
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

async function cleanupPastWeeks(client, currentWeekId) {
  const { data: oldWeeks } = await client
    .from('weeks')
    .select('id')
    .neq('id', currentWeekId);

  if (!oldWeeks || oldWeeks.length === 0) return;

  for (const w of oldWeeks) {
    const { count } = await client
      .from('week_plan')
      .select('id', { count: 'exact', head: true })
      .eq('week_id', w.id);
    if (count === 0) await client.from('weeks').delete().eq('id', w.id);
  }
}

function IngredientCard({ item, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const isChecked = item.checked;

  function toggle() { setExpanded(prev => !prev); }

  return (
    <View style={[styles.card, isChecked && styles.cardChecked]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={toggle} style={styles.cardLeft} activeOpacity={0.7}>
          <Text style={styles.cardArrow}>{expanded ? '▾' : '▸'}</Text>
          <View>
            <Text style={[styles.cardName, isChecked && styles.cardNameChecked]}>
              {item.ingredients.name}
            </Text>
            <Text style={[styles.cardCount, isChecked && styles.cardCountChecked]}>
              {item.dishes.length} {item.dishes.length === 1 ? 'dish' : 'dishes'} this week
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.checkbox, isChecked && styles.checkboxChecked]}
          onPress={() => onToggle(item)}
          activeOpacity={0.7}
        >
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.cardBody}>
          {item.dishes.map((dish, i) => (
            <View key={i} style={styles.dishRow}>
              <Ionicons name="restaurant-outline" size={13} color="#888" />
              <Text style={[styles.dishName, isChecked && styles.dishNameChecked]}>
                {dish}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ShoppingScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadShopping = useCallback(async () => {
    setLoading(true);
    try {
      const client = await getClient();
      const { year, week } = getCurrentWeek();

      const weekId = await fetchCurrentWeekId(client, year, week);
      if (!weekId) { setItems([]); setLoading(false); return; }

      const dishIds = await fetchDishIds(client, weekId);
      const ingredientIds = await fetchIngredientIds(client, dishIds);

      await syncShoppingItems(client, weekId, ingredientIds);
      await cleanupPastWeeks(client, weekId);

      const enriched = await buildEnrichedItems(client, weekId, dishIds);
      setItems(enriched);
    } catch (e) {
      console.error('loadShopping error:', e.message);
      Alert.alert('Error', 'Could not load shopping list');
    }
    setLoading(false);
  }, []);

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

  async function toggleItem(item) {
    const newChecked = !item.checked;

    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, checked: newChecked } : i
    ));

    try {
      const client = await getClient();
      const { error } = await client
        .from('shopping_items')
        .update({ checked: newChecked })
        .eq('id', item.id);
      if (error) throw error;
    } catch (e) {
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, checked: item.checked } : i
      ));
      Alert.alert('Error', 'Could not update item');
    }
  }

  async function exportToClipboard() {
    const pending = items.filter(i => !i.checked);
    if (pending.length === 0) {
      Alert.alert('Nothing to export', 'All items are already checked.');
      return;
    }
    const text = pending
      .map(i => `${i.ingredients.name} x${i.dishes.length}`)
      .join('\n');
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'Shopping list copied to clipboard.');
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
          <Text style={styles.dividerText}>checked</Text>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    return <IngredientCard item={item} onToggle={toggleItem} />;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {pending.length} item{pending.length !== 1 ? 's' : ''} left
        </Text>
        <View style={styles.headerActions}>
          {syncing && (
            <ActivityIndicator size="small" color="#4CAF50" style={{ marginRight: 8 }} />
          )}
          <TouchableOpacity onPress={exportToClipboard} style={styles.exportButton}>
            <Ionicons name="copy-outline" size={18} color="#4CAF50" />
            <Text style={styles.exportText}>Copy list</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No ingredients this week</Text>
          <Text style={styles.emptySubtitle}>
            Assign dishes to the current week to build your shopping list
          </Text>
        </View>
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

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: 'white',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  exportButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50',
  },
  exportText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },

  list: { padding: 12, paddingBottom: 32 },

  card: {
    backgroundColor: 'white', borderRadius: 10,
    marginBottom: 6, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardChecked: { backgroundColor: '#f4f4f4', shadowOpacity: 0, elevation: 0 },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 12,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardArrow: { fontSize: 14, color: '#aaa' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  cardNameChecked: {
    color: '#aaa', fontStyle: 'italic',
    textDecorationLine: 'line-through', fontWeight: '400',
  },
  cardCount: { fontSize: 11, color: '#888', marginTop: 2 },
  cardCountChecked: { color: '#bbb' },

  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  checkmark: { fontSize: 13, color: 'white', fontWeight: '700' },

  cardBody: {
    paddingHorizontal: 16, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 6,
  },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dishName: { fontSize: 13, color: '#555' },
  dishNameChecked: { color: '#bbb', fontStyle: 'italic' },

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