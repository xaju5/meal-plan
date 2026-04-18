import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { getClient } from '../lib/supabase';
import DishCard from '../components/DishCard';
import DishModal from '../components/DishModal';
import { getWeeksAgoLabel, computeWeeksAgo } from '../hooks/useLastUsedLabel';
import { useTranslation } from 'react-i18next';

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


export default function DishesScreen() {
  const { t } = useTranslation();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDish, setEditingDish] = useState(null);

  const loadDishes = useCallback(async () => {
    setLoading(true);
    try {
      const client = await getClient();

      const [{ data: dishesData, error: dishesError }, { data: weekPlanData, error: weekPlanError }] =
        await Promise.all([
          client
            .from('dishes')
            .select('id, name, dish_ingredients(id, ingredients(id, name))')
            .order('name'),
          client
            .from('week_plan')
            .select('dish_id, weeks(year, week_number)')
            .not('dish_id', 'is', null)
        ]);

      if (dishesError) throw new Error(`Failed to load dishes: ${dishesError.message}`);
      if (weekPlanError) throw new Error(`Failed to load week plan: ${weekPlanError.message}`);

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

      const enriched = (dishesData || []).map(dish => ({
        ...dish,
        weeksAgo: computeWeeksAgo(lastUsedMap[dish.id], currentYear, currentWeek)
      }));

      setDishes(enriched);
    } catch (e) {
      console.error('loadDishes error:', e.message);
      Alert.alert('Error', 'Could not load dishes. Pull down to try again.');
    }
    setLoading(false);
  }, []);

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
      t('deleteDish'),
      t('deleteConfirm', { name: dish.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            const client = await getClient();
            const { error } = await client
              .from('dishes')
              .delete()
              .eq('id', dish.id);
            if (error) {
              Alert.alert(t('error'), t('couldNotDelete'));
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
          <Text style={styles.empty}>{t('noDishes')}</Text>
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