import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export async function getClient() {
  const code = await AsyncStorage.getItem('house_code');
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: { 'x-house-code': code }
      }
    }
  );
}

export function generateHouseCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export async function getHouseCode() {
  return await AsyncStorage.getItem('house_code');
}

export async function saveHouseCode(code) {
  await AsyncStorage.setItem('house_code', code);
}

export { baseClient };