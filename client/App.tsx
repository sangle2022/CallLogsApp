/**
 * App.tsx
 *
 * Root component.
 * Shows the initial application splash screen and then loads
 * the main application navigator.
 */

import React, {useEffect, useState} from 'react';

import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import AppSplashScreen from './src/components/AppSplashScreen';

const SPLASH_DURATION_MS = 3000;

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {showSplash ? (
        <AppSplashScreen />
      ) : (
        <AppNavigator />
      )}
    </SafeAreaProvider>
  );
}