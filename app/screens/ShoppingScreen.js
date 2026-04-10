import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard'; 
import { getClient, getHouseCode } from '../lib/supabase';

function getCurrentWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return {
    year: d.getFullYear(),
    week: Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  };
}

function formatQuantity(quantity, unit) {
  if (!quantity && !unit) return null;
  if (!quantity) return unit;
  const formattedQty = quantity % 1 === 0 ? quantity : quantity.toFixed(1);
  return `${formattedQty}${unit ? ' ' + unit : ''}`;
}

export default function ShoppingScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const client = await getClient();
      const houseCode = await getHouseCode();
      const { year, week } = getCurrentWeek();

      const { data: weekData } = await client
        .from('weeks')
        .select('id')
        .eq('year', year)
        .eq('week_number', week)
        .single();

      if (!weekData) {
        setItems([]);
        return;
      }

      const { data: planData } = await client
        .from('week_plan')
        .select('dish_id')
        .eq('week_id', weekData.id)
        .not('dish_id', 'is', null);

      const dishIds = [...new Set((planData || []).map(p => p.dish_id))];

      await syncShoppingList(client, houseCode, weekData.id, dishIds);
      await cleanupPastWeeks(client, houseCode, weekData.id);

      const { data } = await client
        .from('shopping_items')
        .select('id, checked, ingredient_id, ingredients(name)')
        .eq('week_id', weekData.id);

      const withMeta = await enrichWithDishCount(client, data || [], weekData.id, dishIds);
      setItems(withMeta);
    } catch (error) {
      console.error("Error loading shopping list:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let channel;
    const setupSubscription = async () => {
      const client = await getClient();
      const houseCode = await getHouseCode();
      
      channel = client
        .channel('shopping_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'shopping_items',
            filter: `house_code=eq.${houseCode}` 
          }, 
          () => load()
        )
        .subscribe();
    };

    setupSubscription();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [load]);


  async function syncShoppingList(client, houseCode, weekId, dishIds) {
    if (dishIds.length === 0) return;

    const { data: dishIngredients } = await client
      .from('dish_ingredients')
      .select('ingredient_id')
      .in('dish_id', dishIds);

    const ingredientIds = [...new Set((dishIngredients || []).map(d => d.ingredient_id))];

    const { data: existing } = await client
      .from('shopping_items')
      .select('ingredient_id')
      .eq('week_id', weekId);

    const existingIds = new Set((existing || []).map(e => e.ingredient_id));
    const toInsert = ingredientIds.filter(id => !existingIds.has(id));

    if (toInsert.length > 0) {
      await client.from('shopping_items').insert(
        toInsert.map(ingredient_id => ({
          house_code: houseCode,
          week_id: weekId,
          ingredient_id,
          checked: false,
        }))
      );
    }
  }

  async function enrichWithDishCount(client, items, weekId, dishIds) {
    if (items.length === 0 || dishIds.length === 0) return items;

    const { data: dishIngredients } = await client
      .from('dish_ingredients')
      .select('ingredient_id, quantity, unit')
      .in('dish_id', dishIds);

    const countMap = {};
    const qtyMap = {};
    const unitMap = {};

    (dishIngredients || []).forEach(di => {
      const id = di.ingredient_id;
      countMap[id] = (countMap[id] || 0) + 1;
      unitMap[id] = di.unit;
      if (di.quantity) qtyMap[id] = (qtyMap[id] || 0) + di.quantity;
    });

    return items.map(item => ({
      ...item,
      dishCount: countMap[item.ingredient_id] || 1,
      quantity: qtyMap[item.ingredient_id] || null,
      unit: unitMap[item.ingredient_id] || null,
    }));
  }

  async function cleanupPastWeeks(client, houseCode, currentWeekId) {
    const { data: oldWeeks } = await client
      .from('weeks')
      .select('id')
      .eq('house_code', houseCode)
      .neq('id', currentWeekId);

    if (!oldWeeks) return;

    for (const w of oldWeeks) {
      const { count } = await client
        .from('week_plan')
        .select('id', { count: 'exact', head: true })
        .eq('week_id', w.id);

      if (count === 0) {
        await client.from('weeks').delete().eq('id', w.id);
      }
    }
  }

  async function toggleItem(item) {
    setItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, checked: !i.checked } : i
    ));

    try {
      setSyncing(true);
      const client = await getClient();
      await client
        .from('shopping_items')
        .update({
          checked: !item.checked,
          checked_at: !item.checked ? new Date().toISOString() : null
        })
        .eq('id', item.id);
    } catch (error) {
      Alert.alert("Error", "Could not update item");
      load(); // Revert on error
    } finally {
      setSyncing(false);
    }
  }

  const exportToClipboard = async () => {
    const pending = items.filter(i => !i.checked);
    if (pending.length === 0) {
      Alert.alert('List empty', 'No pending items to copy.');
      return;
    }
    const text = pending
      .map(i => {
        const qty = formatQuantity(i.quantity, i.unit);
        return `- ${i.ingredients.name} ${qty ? `(${qty})` : ''} x${i.dishCount}`;
      })
      .join('\n');
    
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'The list has been copied to your clipboard.');
  };

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
          <Text style={styles.dividerText}>Completado</Text>
          <View style={styles.dividerLine} />
        </View>
      );
    }

    const isChecked = item.checked;
    const qty = formatQuantity(item.quantity, item.unit);

    return (
      <TouchableOpacity
        style={[styles.row, isChecked && styles.rowChecked]}
        onPress={() => toggleItem(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Ionicons name="checkmark" size={14} color="white" />}
        </View>
        <Text style={[styles.name, isChecked && styles.nameChecked]} numberOfLines={1}>
          {item.ingredients?.name || 'Unknown Item'}
        </Text>
        <View style={styles.meta}>
          {qty && (
            <Text style={[styles.quantity, isChecked && styles.metaChecked]}>{qty}</Text>
          )}
          <View style={[styles.badge, isChecked && styles.badgeChecked]}>
            <Text style={[styles.badgeText, isChecked && styles.metaChecked]}>
              x{item.dishCount}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading && items.length === 0) {
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
          {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.headerActions}>
          {syncing && <ActivityIndicator size="small" color="#4CAF50" style={{ marginRight: 8 }} />}
          <TouchableOpacity onPress={exportToClipboard} style={styles.exportButton}>
            <Ionicons name="copy-outline" size={18} color="#4CAF50" />
            <Text style={styles.exportText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cart-outline" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>Lista vacía</Text>
          <Text style={styles.emptySubtitle}>
            Añade platos al plan semanal para generar la lista.
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
              onRefresh={load}
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
    justifyContent: 'space-between',
    backgroundColor: 'white', paddingVertical: 12,
    paddingHorizontal: 16, borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  exportButton: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50',
  },
  exportText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  list: { padding: 12, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 6, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  rowChecked: { backgroundColor: '#f0f0f0', shadowOpacity: 0, elevation: 0 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  name: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  nameChecked: {
    color: '#aaa', fontStyle: 'italic',
    textDecorationLine: 'line-through', fontWeight: '400',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantity: { fontSize: 13, color: '#888', fontWeight: '500' },
  metaChecked: { color: '#bbb' },
  badge: { backgroundColor: '#e8f5e9', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeChecked: { backgroundColor: '#e8e8e8' },
  badgeText: { fontSize: 11, color: '#2e7d32', fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { fontSize: 11, color: '#bbb', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#555', marginTop: 12, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 20 },
});