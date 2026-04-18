import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function IngredientCard({ item, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const isChecked = item.checked;

  return (
    <View style={[styles.card, isChecked && styles.cardChecked]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          onPress={() => setExpanded(p => !p)}
          style={styles.cardLeft}
          activeOpacity={0.7}
        >
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={14} color="#aaa"
          />
          <View>
            <Text style={[styles.cardName, isChecked && styles.cardNameChecked]}>
              {item.ingredients.name} x {item.dishes.length}
            </Text>
            {/* <Text style={[styles.cardCount, isChecked && styles.cardCountChecked]}>
              {item.dishes.length} {item.dishes.length === 1 ? t('dish') : t('dishes')} {t('thisWeek')}
            </Text> */}
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

const styles = StyleSheet.create({
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
});