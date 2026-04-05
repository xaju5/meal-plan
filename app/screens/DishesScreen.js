import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
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
    const { data, error } = await client
      .from('dishes')
      .select(`id, name, dish_ingredients(id, quantity, unit, ingredients ( id, name ))`)
      .order('name');

    if (!error) setDishes(data || []);
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