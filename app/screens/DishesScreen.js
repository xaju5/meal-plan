import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { getClient } from '../lib/supabase';
import DishCard from '../components/DishCard';
import DishModal from '../components/DishModal';

export default function DishesScreen() {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDish, setEditingDish] = useState(null);

  const loadDishes = useCallback(async () => {
  const client = await getClient();
  await AsyncStorage.clear();
  const [{ data: dishesData }, { data: weekPlanData }] = await Promise.all([
    client
      .from('dishes')
      .select(`id, name, dish_ingredients(id, quantity, unit, ingredients(id, name))`)
      .order('name'),
    client
      .from('week_plan')
      .select('dish_id, weeks(year, week_number)')
      .not('dish_id', 'is', null)
  ]);

  const lastUsedMap = {};
  (weekPlanData || []).forEach(entry => {
    const { dish_id, weeks } = entry;
    if (!weeks) return;
    const prev = lastUsedMap[dish_id];
    if (!prev || weeks.year > prev.year ||
      (weeks.year === prev.year && weeks.week_number > prev.week_number)) {
      lastUsedMap[dish_id] = weeks;
    }
  });

  const { year: currentYear, week: currentWeek } = getCurrentWeek();

  const enriched = (dishesData || []).map(dish => {
    const last = lastUsedMap[dish.id];
    let weeksAgo = null;
    if (last) {
      weeksAgo = (currentYear - last.year) * 52 + (currentWeek - last.week_number);
    }
    return { ...dish, weeksAgo };
  });

  setDishes(enriched);
  setLoading(false);
  }, []);
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

  useEffect(() => {
    loadDishes();
  }, [loadDishes]);

  function handleAdd() {
    setEditingDish(null);
    setModalVisible(true);
  }

  function handleEdit(dish) {
    setEditingDish(dish);
    setModalVisible(true);
  }

  async function handleDelete(dish) {
    Alert.alert(
      'Delete dish',
      `Are you sure you want to delete "${dish.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const client = await getClient();
            const { error } = await client
              .from('dishes')
              .delete()
              .eq('id', dish.id);
            if (error) {
              Alert.alert('Error', 'Could not delete dish');
            } else {
              loadDishes();
            }
          }
        }
      ]
    );
  }

  function handleModalClose() {
    setModalVisible(false);
    setEditingDish(null);
    loadDishes();
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
      <FlatList
        data={dishes}
        keyExtractor={d => d.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadDishes}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No dishes yet. Tap + to add one.</Text>
        }
        renderItem={({ item }) => (
          <DishCard
            dish={item}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={handleAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <DishModal
        visible={modalVisible}
        dish={editingDish}
        onClose={handleModalClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 80 },
  empty: { textAlign: 'center', color: 'gray', marginTop: 48, fontSize: 16 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center',
    elevation: 4,
  },
  fabText: { fontSize: 32, color: 'white', lineHeight: 36 },
});