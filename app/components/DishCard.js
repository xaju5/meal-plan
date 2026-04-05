import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation } from 'react-native';

export default function DishCard({ dish, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.arrow}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.name}>{dish.name}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {dish.dish_ingredients.length === 0 ? (
            <Text style={styles.noIngredients}>No ingredients added</Text>
          ) : (
            dish.dish_ingredients.map(di => (
              <View key={di.id} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{di.ingredients.name}</Text>
                <Text style={styles.ingredientQty}>
                  {di.quantity ? `${di.quantity}${di.unit ? ' ' + di.unit : ''}` : '—'}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  arrow: { fontSize: 16, color: 'gray', marginRight: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 4 },
  editButton: {
    padding: 6, borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  editIcon: { fontSize: 16 },
  deleteButton: {
    padding: 6, borderRadius: 8,
    backgroundColor: '#fdecea',
  },
  deleteIcon: { fontSize: 16 },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  ingredientName: { fontSize: 15, color: '#333' },
  ingredientQty: { fontSize: 15, color: 'gray' },
  noIngredients: { fontSize: 14, color: 'gray', fontStyle: 'italic', paddingVertical: 8 },
});