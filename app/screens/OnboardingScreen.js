import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { generateHouseCode, saveHouseCode, baseClient } from '../lib/supabase';

export default function OnboardingScreen({ onComplete }) {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    const code = generateHouseCode();

    const { error } = await baseClient
      .from('houses')
      .insert({ code });

    if (error) {
      Alert.alert('Error', 'Could not create house. Try again.');
    } else {
      await saveHouseCode(code);
      onComplete(code);
    }
    setLoading(false);
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 8) {
      Alert.alert('Invalid code', 'The code must be 8 characters');
      return;
    }
    setLoading(true);

    const { data, error } = await baseClient
      .from('houses')
      .select('code')
      .eq('code', code)
      .single();

    if (error || !data) {
      Alert.alert('House not found', 'Check the code and try again');
    } else {
      await saveHouseCode(code);
      onComplete(code);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>meal-plan</Text>
      <Text style={styles.subtitle}>Plan your weekly meals & groceries</Text>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.disabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? 'Creating...' : 'Generate new code'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.divider}>or join an existing house</Text>

      <TextInput
        style={styles.codeInput}
        placeholder="Enter code"
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
        maxLength={8}
      />

      <TouchableOpacity
        style={[styles.secondaryButton, (!joinCode || loading) && styles.disabled]}
        onPress={handleJoin}
        disabled={!joinCode || loading}
      >
        <Text style={styles.secondaryButtonText}>
          {loading ? 'Joining...' : 'Join house'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'gray', marginBottom: 48 },
  divider: { textAlign: 'center', color: 'gray', marginVertical: 20, fontSize: 14 },
  codeInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 22, letterSpacing: 6,
    textAlign: 'center', marginBottom: 12
  },
  primaryButton: {
    backgroundColor: '#4CAF50', padding: 14,
    borderRadius: 8, alignItems: 'center', marginBottom: 4
  },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: {
    borderWidth: 1, borderColor: '#4CAF50', padding: 14,
    borderRadius: 8, alignItems: 'center'
  },
  secondaryButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  disabled: { opacity: 0.4 }
});