import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarActiveTintColor: '#4CAF50',
            tabBarInactiveTintColor: 'gray',
            tabBarIcon: ({ focused, color, size }) => {
              const icons = {
                Dishes: focused ? 'restaurant' : 'restaurant-outline',
                Week: focused ? 'calendar' : 'calendar-outline',
                Shopping: focused ? 'cart' : 'cart-outline',
              };
              return <Ionicons name={icons[route.name]} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Dishes" component={DishesScreen} />
          <Tab.Screen name="Week" component={WeekScreen} />
          <Tab.Screen name="Shopping" component={ShoppingScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}