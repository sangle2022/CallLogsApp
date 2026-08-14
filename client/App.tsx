/**
 * App.tsx
 *
 * Root of the application.
 *
 * SafeAreaProvider is defined once here so every normal screen can
 * consume Android/iOS safe-area information.
 */

import React from 'react';

import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppNavigator />
    </SafeAreaProvider>
  );
}