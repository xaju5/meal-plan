import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  Modal, StyleSheet, ScrollView, Alert, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClient } from '../lib/supabase';
import IngredientAutocomplete from './IngredientAutocomplete';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

export default function DishModal({ visible, dish, onClose }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      if (dish) {
        setName(dish.name);
        setIngredients(
          dish.dish_ingredients.map(di => ({
            ingredientId: di.ingredients.id,
            name: di.ingredients.name,
            isNew: false,
          }))
        );
      } else {
        setName('');
        setIngredients([]);
      }
    }
  }, [visible, dish]);

  function handleSelectIngredient(ingredient) {
    const alreadyAdded = ingredients.some(
      i => i.name.toLowerCase() === ingredient.name.toLowerCase()
    );
    if (alreadyAdded) return;
    setIngredients(prev => [...prev, ingredient]);
  }

  function removeIngredient(index) {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert(t('error'), t('dishNameRequired'));
      return;
    }
    setSaving(true);
    const client = await getClient();

    try {
      let dishId;

      if (dish) {
        const { error } = await client
          .from('dishes')
          .update({ name: name.trim() })
          .eq('id', dish.id);
        if (error) throw error;
        dishId = dish.id;
        await client.from('dish_ingredients').delete().eq('dish_id', dishId);
      } else {
        const { data, error } = await client
          .from('dishes')
          .insert({ name: name.trim() })
          .select('id')
          .single();
        if (error) throw error;
        dishId = data.id;
      }

      for (const ing of ingredients) {
        let ingredientId = ing.ingredientId;

        if (!ingredientId) {
          const { data: existing } = await client
            .from('ingredients')
            .select('id')
            .eq('name', ing.name.trim())
            .single();

          if (existing) {
            ingredientId = existing.id;
          } else {
            const { data: newIng, error } = await client
              .from('ingredients')
              .insert({ name: ing.name.trim() })
              .select('id')
              .single();
            if (error) throw error;
            ingredientId = newIng.id;
          }
        }

        const { error } = await client.from('dish_ingredients').insert({
          dish_id: dishId,
          ingredient_id: ingredientId,
        });
        if (error) throw error;
      }

      onClose();
    } catch (e) {
      Alert.alert(t('error'), t('couldNotSave', { message: e.message }));
    }

    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
              <Text style={styles.title}>{dish ? t('editDish') : t('newDish')}</Text>

              <Text style={styles.label}>{t('dishName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('dishNamePlaceholder')}
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <Text style={styles.label}>{t('ingredients')}</Text>
              <IngredientAutocomplete onSelect={handleSelectIngredient} />

              <ScrollView
                style={styles.tagList}
                keyboardShouldPersistTaps="handled"
              >
                {ingredients.length === 0 && (
                  <Text style={styles.noIngredients}>{t('noIngredients')}</Text>
                )}
                {ingredients.map((ing, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{ing.name}</Text>
                    {ing.isNew && <Text style={styles.tagNew}>new</Text>}
                    <TouchableOpacity
                      onPress={() => removeIngredient(index)}
                      style={styles.tagRemove}
                    >
                      <Ionicons name="close" size={14} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.disabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveText}>{saving ? t('saving') : t('save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: 'white', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, maxHeight: '90%',
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 13, color: 'gray', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 15, marginBottom: 4,
  },
  tagList: { maxHeight: 200, marginTop: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0faf0', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12,
    marginBottom: 6, gap: 8,
  },
  tagText: { flex: 1, fontSize: 14, color: '#2e7d32', fontWeight: '500' },
  tagNew: {
    fontSize: 10, color: '#4CAF50', fontWeight: '700',
    borderWidth: 1, borderColor: '#4CAF50',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  tagRemove: { padding: 2 },
  noIngredients: { fontSize: 13, color: '#bbb', fontStyle: 'italic', paddingVertical: 8 },
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