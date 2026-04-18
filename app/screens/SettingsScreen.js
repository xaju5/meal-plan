import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../lib/i18n';

const LANGUAGES = [
  { code: 'eu', labelKey: 'euskera' },
  { code: 'es', labelKey: 'castellano' },
  { code: 'en', labelKey: 'english' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('language')}</Text>
      <View style={styles.card}>
        {LANGUAGES.map((lang, index) => {
          const isSelected = i18n.language === lang.code;
          const isLast = index === LANGUAGES.length - 1;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.row, !isLast && styles.rowBorder]}
              onPress={() => changeLanguage(lang.code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                {t(lang.labelKey)}
              </Text>
              {isSelected && (
                <Text style={styles.check}>✓</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: 'white', borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowText: { fontSize: 16, color: '#333' },
  rowTextSelected: { color: '#4CAF50', fontWeight: '700' },
  check: { fontSize: 16, color: '#4CAF50', fontWeight: '700' },
});