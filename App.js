import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { initI18n } from './app/lib/i18n';
import DishesScreen from './app/screens/DishesScreen';
import WeekScreen from './app/screens/WeekScreen';
import ShoppingScreen from './app/screens/ShoppingScreen';
import SettingsScreen from './app/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
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
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="settings-outline" size={22} color="#4CAF50" />
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen name="Dishes" component={DishesScreen} options={{ title: t('dishes') }} />
      <Tab.Screen name="Week" component={WeekScreen} options={{ title: t('week') }} />
      <Tab.Screen name="Shopping" component={ShoppingScreen} options={{ title: t('shopping') }} />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings'),
          headerTintColor: '#4CAF50',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}