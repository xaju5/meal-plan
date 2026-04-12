import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DishesScreen from './app/screens/DishesScreen';
import WeekScreen from './app/screens/WeekScreen';
import ShoppingScreen from './app/screens/ShoppingScreen';

const Tab = createBottomTabNavigator();

export default function App() {
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