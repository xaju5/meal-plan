import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { getClient } from '../lib/supabase';
import { getHouseCode } from '../lib/supabase';

export default function DishModal({ visible, dish, onClose }) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (dish) {
        setName(dish.name);
        setIngredients(
          dish.dish_ingredients.map(di => ({
            id: di.id,
            ingredientId: di.ingredients.id,
            name: di.ingredients.name,
            quantity: di.quantity ? String(di.quantity) : '',
            unit: di.unit || '',
          }))
        );
      } else {
        setName('');
        setIngredients([]);
      }
    }
  }, [visible, dish]);

  function addIngredient() {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
  }

  function updateIngredient(index, field, value) {
    setIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeIngredient(index) {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Error', 'Dish name is required');
      return;
    }
    setSaving(true);
    const client = await getClient();
    const houseCode = await getHouseCode();

    try {
      let dishId;

      if (dish) {
        // Edit existing Dish
        await client.from('dishes').update({ name: name.trim() }).eq('id', dish.id);
        dishId = dish.id;
        await client.from('dish_ingredients').delete().eq('dish_id', dishId);
      } else {
        // Create new Dish
        const { data, error } = await client
          .from('dishes')
          .insert({ name: name.trim(), house_code: houseCode })
          .select('id')
          .single();
        if (error) throw error;
        dishId = data.id;
      }

      // Save ingredients
      const validIngredients = ingredients.filter(i => i.name.trim() !== '');
      for (const ing of validIngredients) {
        let ingredientId = ing.ingredientId;
        if (!ingredientId) {
          const { data: existing } = await client
            .from('ingredients')
            .select('id')
            .eq('name', ing.name.trim())
            .eq('house_code', houseCode)
            .single();

          if (existing) {
            ingredientId = existing.id;
          } else {
            const { data: newIng } = await client
              .from('ingredients')
              .insert({ name: ing.name.trim(), house_code: houseCode })
              .select('id')
              .single();
            ingredientId = newIng.id;
          }
        }

        await client.from('dish_ingredients').insert({
          dish_id: dishId,
          ingredient_id: ingredientId,
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit.trim() || null,
        });
      }

      onClose();
    } catch (e) {
      Alert.alert('Error', 'Could not save dish');
    }

    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{dish ? 'Edit dish' : 'New dish'}</Text>

          {/* Dish */}
          <Text style={styles.label}>Dish name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Tortilla de patatas"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Ingredients */}
          <Text style={styles.label}>Ingredients</Text>
          <ScrollView style={styles.ingredientsList}>
            {ingredients.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  placeholder="Name"
                  value={ing.name}
                  onChangeText={v => updateIngredient(index, 'name', v)}
                />
                <TextInput
                  style={[styles.input, styles.qtyInput]}
                  placeholder="Qty"
                  value={ing.quantity}
                  onChangeText={v => updateIngredient(index, 'quantity', v)}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, styles.unitInput]}
                  placeholder="Unit"
                  value={ing.unit}
                  onChangeText={v => updateIngredient(index, 'unit', v)}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeIngredient(index)}
                >
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addIngredientButton} onPress={addIngredient}>
              <Text style={styles.addIngredientText}>+ Add ingredient</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.disabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: 'white', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24,
    maxHeight: '85%',
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 13, color: 'gray', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 15, marginBottom: 8,
  },
  ingredientsList: { maxHeight: 280 },
  ingredientRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  nameInput: { flex: 3 },
  qtyInput: { flex: 1.5 },
  unitInput: { flex: 1.5 },
  removeButton: { padding: 8 },
  removeText: { color: '#e53935', fontSize: 16 },
  addIngredientButton: { paddingVertical: 10 },
  addIngredientText: { color: '#4CAF50', fontSize: 15 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelButton: {
    flex: 1, padding: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  cancelText: { fontSize: 16, color: 'gray' },
  saveButton: {
    flex: 1, padding: 14, borderRadius: 8,
    backgroundColor: '#4CAF50', alignItems: 'center',
  },
  saveText: { fontSize: 16, color: 'white', fontWeight: 'bold' },
  disabled: { opacity: 0.5 },
});