/**
 * SafeScreen.tsx
 *
 * Common wrapper for application screens.
 *
 * React Navigation normally handles the top/header area, so this wrapper
 * mainly protects content from:
 *
 * - Android navigation buttons
 * - Android gesture navigation
 * - iPhone home indicator
 * - left/right display cutouts
 */

import React, { ReactNode } from 'react';

import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function SafeScreen({ children, style }: Props) {
  return (
    <SafeAreaView
      style={[styles.container, style]}
      edges={['left', 'right', 'bottom']}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
