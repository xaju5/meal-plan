import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation } from 'react-native';

export default function DishCard({ dish, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  function getLastUsedLabel(weeksAgo) {
    if (weeksAgo === null) return { text: 'never used', color: '#bbb' };
    if (weeksAgo === 0) return { text: 'this week', color: '#4CAF50' };
    if (weeksAgo === 1) return { text: '1 week ago', color: '#8bc34a' };
    if (weeksAgo <= 4) return { text: `${weeksAgo} weeks ago`, color: '#ff9800' };
    return { text: 'over a month ago', color: '#e53935' };
  }

  const { text, color } = getLastUsedLabel(dish.weeksAgo);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.arrow}>{expanded ? '▾' : '▸'}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{dish.name}</Text>
          <Text style={[styles.lastUsed, { color }]}>{text}</Text>
        </View>
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
  titleRow: {
    flex: 1, flexDirection: 'column', justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  lastUsed: { fontSize: 11, marginTop: 2 },});