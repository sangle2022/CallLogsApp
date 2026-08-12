/**
 * HomeScreen.tsx
 * Landing screen with two entry points: Call Logs and Call Recordings.
 * Pure navigation/UI - no data fetching happens here.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { COLORS } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Call Manager</Text>
      <Text style={styles.subheading}>
        View your call history and locate call recordings stored on this
        device.
      </Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CallLogs')}
        activeOpacity={0.8}
      >
        <Text style={styles.cardTitle}>📞 Call Logs</Text>
        <Text style={styles.cardDescription}>
          Browse incoming, outgoing, and missed calls with duration and time.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CallRecordings')}
        activeOpacity={0.8}
      >
        <Text style={styles.cardTitle}>🎙️ Call Recordings</Text>
        <Text style={styles.cardDescription}>
          Find recorded call audio files saved on your device.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 28,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
