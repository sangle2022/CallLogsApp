/**
 * AppNavigator.tsx
 *
 * Central navigation configuration.
 *
 * Also handles the private in-app deep link created by
 * Android ShareRecordingActivity.
 */

import React from 'react';

import { Pressable, StyleSheet, Text } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';

import type { LinkingOptions } from '@react-navigation/native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import CallLogsScreen from '../screens/CallLogsScreen';
import CallRecordingsScreen from '../screens/CallRecordingsScreen';
import RecordingSettingsScreen from '../screens/RecordingSettingsScreen';
import SharedRecordingScreen from '../screens/SharedRecordingScreen';

import { COLORS } from '../utils/constants';

export type RootStackParamList = {
  Home: undefined;

  CallLogs: undefined;

  CallRecordings: undefined;

  RecordingSettings: undefined;

  /**
   * Parameters supplied by Android ShareRecordingActivity.
   *
   * They arrive through the callmanager://shared-recording URL,
   * therefore numeric values arrive as strings.
   */
  SharedRecording: {
    importId: string;
    filePath: string;
    fileName: string;
    fileSize: string;
    recordingTime: string;
    extension: string;
    mimeType?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * This URL is created internally by ShareRecordingActivity:
 *
 * callmanager://shared-recording?...
 *
 * React Navigation converts it directly into SharedRecording route.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['callmanager://'],

  config: {
    screens: {
      SharedRecording: 'shared-recording',
    },
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },

          headerTintColor: '#fff',

          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Call Manager',
          }}
        />

        <Stack.Screen
          name="CallLogs"
          component={CallLogsScreen}
          options={{
            title: 'Call Logs',
          }}
        />

        <Stack.Screen
          name="CallRecordings"
          component={CallRecordingsScreen}
          options={({ navigation }) => ({
            title: 'Call Recordings',

            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Recording folder settings"
                hitSlop={10}
                onPress={() => navigation.navigate('RecordingSettings')}
              >
                <Text style={styles.headerAction}>Folder</Text>
              </Pressable>
            ),
          })}
        />

        <Stack.Screen
          name="RecordingSettings"
          component={RecordingSettingsScreen}
          options={{
            title: 'Recording Folder',
          }}
        />

        <Stack.Screen
          name="SharedRecording"
          component={SharedRecordingScreen}
          options={{
            title: 'Share Recording',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '700',
  },
});
