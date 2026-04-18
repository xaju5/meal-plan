import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet
} from 'react-native';
import { getClient } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function IngredientAutocomplete({ onSelect }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const client = await getClient();
      const { data } = await client
        .from('ingredients')
        .select('id, name')
        .order('name');
      setAllIngredients(data || []);
    })();
  }, []);

  useEffect(() => {
    if (query.trim() === '') {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const filtered = allIngredients.filter(i =>
      i.name.toLowerCase().includes(query.toLowerCase())
    );
    setSuggestions(filtered);
    setShowDropdown(true);
  }, [query, allIngredients]);

  function handleSelect(ingredient) {
    onSelect({ id: ingredient.id, name: ingredient.name, isNew: false });
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  }

  function handleConfirm() {
    const trimmed = query.trim();
    if (!trimmed) return;
    const exact = allIngredients.find(
      i => i.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) {
      onSelect({ id: exact.id, name: exact.name, isNew: false });
    } else {
      onSelect({ id: null, name: trimmed, isNew: true });
    }
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  }

  const showCreateOption =
    query.trim() !== '' &&
    !allIngredients.some(i => i.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t('searchIngredient')}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleConfirm}
          returnKeyType={t('done')}
          blurOnSubmit={false}
        />
        {query.trim() !== '' && (
          <TouchableOpacity style={styles.addButton} onPress={handleConfirm}>
            <Text style={styles.addButtonText}>{t('add')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (suggestions.length > 0 || showCreateOption) && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={suggestions.length > 4}
            style={{ maxHeight: 160 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.suggestionText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          {showCreateOption && (
            <TouchableOpacity
              style={[styles.suggestion, styles.createOption]}
              onPress={handleConfirm}
            >
              <Text style={styles.createText}>
                {t('createPrefix')} <Text style={styles.createHighlight}>"{query.trim()}"</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 10, fontSize: 15,
  },
  addButton: {
    backgroundColor: '#4CAF50', borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontWeight: '700', fontSize: 14 },
  dropdown: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    backgroundColor: 'white', marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  suggestion: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  suggestionText: { fontSize: 14, color: '#333' },
  createOption: { backgroundColor: '#f9fdf9' },
  createText: { fontSize: 14, color: '#888' },
  createHighlight: { color: '#4CAF50', fontWeight: '700' },
});