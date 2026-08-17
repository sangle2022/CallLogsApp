/**
 * AppNavigator.tsx
 * Central navigation configuration using React Navigation's native stack.
 */
import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CallLogsScreen from '../screens/CallLogsScreen';
import CallRecordingsScreen from '../screens/CallRecordingsScreen';
import {COLORS} from '../utils/constants';
import RecordingSettingsScreen from '../screens/RecordingSettingsScreen';

export type RootStackParamList = {
  Home: undefined;
  CallLogs: undefined;
  CallRecordings: undefined;
  RecordingSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {backgroundColor: COLORS.primary},
          headerTintColor: '#fff',
          headerTitleStyle: {fontWeight: '700'},
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'Call Manager'}}
        />

        <Stack.Screen
          name="CallLogs"
          component={CallLogsScreen}
          options={{title: 'Call Logs'}}
        />

        <Stack.Screen
          name="CallRecordings"
          component={CallRecordingsScreen}
          options={({navigation}) => ({
            title: 'Call Recordings',
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Recording folder settings"
                hitSlop={10}
                onPress={() => navigation.navigate('RecordingSettings')}>
                <Text style={styles.headerAction}>Folder</Text>
              </Pressable>
            ),
          })}
        />

        <Stack.Screen
          name="RecordingSettings"
          component={RecordingSettingsScreen}
          options={{title: 'Recording Folder'}}
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
