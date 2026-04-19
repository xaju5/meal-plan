import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  Modal, FlatList, StyleSheet, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLastUsedLabel } from '../hooks/useLastUsedLabel';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

export default function WeekDishPicker({ visible, dishes, onSelect, onClose }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { getWeeksAgoLabel } = useLastUsedLabel();

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

  function handleClose() {
    setSearchQuery('');
    onClose();
  }

  function handleSelect(dish) {
    setSearchQuery('');
    onSelect(dish);
  }

  const filteredDishes = dishes.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
              <View style={styles.handle} />
              <Text style={styles.title}>{t('selectDish')}</Text>

              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={16} color="#aaa" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('searchDishes')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#aaa" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredDishes}
                keyExtractor={d => d.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.empty}>
                    {searchQuery
                      ? t('noDisheSearch')
                      : t('noDishesYet')}
                  </Text>
                }
                renderItem={({ item }) => {
                  const { text, color } = getWeeksAgoLabel(item.weeksAgo);
                  return (
                    <TouchableOpacity
                      style={styles.item}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.itemContent}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={[styles.itemSub, { color }]}>{text}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color="#4CAF50" />
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: 'white', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, paddingTop: 12,
    paddingHorizontal: 20, paddingBottom: 32, maxHeight: '70%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 10,
    paddingHorizontal: 10, marginBottom: 12, gap: 6,
  },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  itemContent: { flex: 1 },
  itemName: { fontSize: 15, color: '#222' },
  itemSub: { fontSize: 11, marginTop: 2 },
  empty: {
    color: '#aaa', fontSize: 14, textAlign: 'center',
    paddingVertical: 32, fontStyle: 'italic',
  },
  cancelButton: {
    marginTop: 8, padding: 14, alignItems: 'center',
    borderRadius: 10, backgroundColor: '#f5f5f5',
  },
  cancelText: { fontSize: 15, color: '#888', fontWeight: '600' },
});