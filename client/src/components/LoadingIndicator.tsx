/**
 * LoadingIndicator.tsx
 * Simple, reusable full-area loading spinner with an optional message.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../utils/constants';

interface Props {
  message?: string;
}

export default function LoadingIndicator({ message = 'Loading...' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
});
