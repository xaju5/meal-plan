import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DishesScreen from './app/screens/DishesScreen';
import WeekScreen from './app/screens/WeekScreen';
import ShoppingScreen from './app/screens/ShoppingScreen';
import OnboardingScreen from './app/screens/OnboardingScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [houseCode, setHouseCode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('house_code').then(code => {
      setHouseCode(code);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (!houseCode) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onComplete={(code) => setHouseCode(code)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#4CAF50' }}>
          <Tab.Screen name="Dishes" component={DishesScreen} />
          <Tab.Screen name="Week" component={WeekScreen} />
          <Tab.Screen name="Shopping" component={ShoppingScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}