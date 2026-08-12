/**
 * AppNavigator.tsx
 * Central navigation configuration using React Navigation's native stack.
 * Defining `RootStackParamList` here gives every screen full TypeScript
 * type-safety for navigation props and route params.
 *
 * Install:
 *   npm install @react-navigation/native @react-navigation/native-stack
 *   npm install react-native-screens react-native-safe-area-context
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CallLogsScreen from '../screens/CallLogsScreen';
import CallRecordingsScreen from '../screens/CallRecordingsScreen';
import { COLORS } from '../utils/constants';

export type RootStackParamList = {
  Home: undefined;
  CallLogs: undefined;
  CallRecordings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Call Manager' }}
        />
        <Stack.Screen
          name="CallLogs"
          component={CallLogsScreen}
          options={{ title: 'Call Logs' }}
        />
        <Stack.Screen
          name="CallRecordings"
          component={CallRecordingsScreen}
          options={{ title: 'Call Recordings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
