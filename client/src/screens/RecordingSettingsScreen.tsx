/**
 * RecordingSettingsScreen.tsx
 *
 * Lets the user choose the folder where this device stores call recordings.
 * The selected physical path is saved in AsyncStorage and reused after the app
 * restarts.
 *
 * If the custom folder is cleared, the app immediately returns to the existing
 * automatic/default OEM folder list.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {CALL_RECORDING_DIRECTORIES, COLORS} from '../utils/constants';
import { RecordingPathService } from '../services/RecordingPathService';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordingSettings'>;

export default function RecordingSettingsScreen(_: Props) {
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSavedPath = useCallback(async () => {
    setLoading(true);
    const path = await RecordingPathService.getCustomDirectory();
    setSavedPath(path);
    setManualPath(path || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSavedPath();
  }, [loadSavedPath]);

  const chooseFolder = useCallback(async () => {
    try {
      setSaving(true);
      const path = await RecordingPathService.chooseCustomDirectory();

      if (!path) {
        return;
      }

      setSavedPath(path);
      setManualPath(path);

      Alert.alert(
        'Recording folder saved',
        'The Call Recordings screen will now scan this folder instead of the automatic folder list.',
      );
    } catch (error) {
      Alert.alert(
        'Could not use this folder',
        error instanceof Error
          ? error.message
          : 'Please select another accessible recording folder.',
      );
    } finally {
      setSaving(false);
    }
  }, []);

  const saveManualPath = useCallback(async () => {
    try {
      setSaving(true);
      const path = await RecordingPathService.saveCustomDirectory(manualPath);
      setSavedPath(path);
      setManualPath(path);

      Alert.alert(
        'Recording folder saved',
        'The Call Recordings screen will now scan this folder.',
      );
    } catch (error) {
      Alert.alert(
        'Invalid recording folder',
        error instanceof Error
          ? error.message
          : 'Please enter an accessible Android folder path.',
      );
    } finally {
      setSaving(false);
    }
  }, [manualPath]);

  const useAutomaticFolders = useCallback(() => {
    Alert.alert(
      'Use automatic recording folders?',
      'This removes the custom folder and restores the app\'s existing list of known Android recording locations.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Use Automatic',
          onPress: async () => {
            try {
              setSaving(true);
              await RecordingPathService.clearCustomDirectory();
              setSavedPath(null);
              setManualPath('');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Recording folder</Text>
        <Text style={styles.description}>
          Select the folder where this phone saves call recordings. The selected
          path is stored locally on this device and reused on future app opens.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.label}>Current mode</Text>
          <Text style={styles.modeText}>
            {loading
              ? 'Loading...'
              : savedPath
              ? 'Custom recording folder'
              : 'Automatic / known Android folders'}
          </Text>

          {savedPath ? (
            <>
              <Text style={[styles.label, styles.pathLabel]}>Saved path</Text>
              <Text selectable style={styles.pathText}>
                {savedPath}
              </Text>
            </>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={chooseFolder}
          disabled={saving || Platform.OS !== 'android'}
          activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>
            {saving ? 'Please wait...' : 'Select Recording Folder'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.orText}>or enter the exact Android path</Text>

        <TextInput
          value={manualPath}
          onChangeText={setManualPath}
          placeholder="/storage/emulated/0/CallRecordings"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.secondaryButton, saving && styles.disabledButton]}
          onPress={saveManualPath}
          disabled={saving || !manualPath.trim()}
          activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>Save This Path</Text>
        </TouchableOpacity>

        {savedPath ? (
          <TouchableOpacity
            style={[styles.resetButton, saving && styles.disabledButton]}
            onPress={useAutomaticFolders}
            disabled={saving}
            activeOpacity={0.8}>
            <Text style={styles.resetButtonText}>Use Automatic Paths</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Automatic paths</Text>
          <Text style={styles.infoText}>
            If no custom folder is selected, your existing recording scan logic
            remains unchanged and checks these folders:
          </Text>

          {CALL_RECORDING_DIRECTORIES.map(directory => (
            <Text selectable key={directory} style={styles.defaultPath}>
              {directory}
            </Text>
          ))}
        </View>

        {/* <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Important Android limitation</Text>
          <Text style={styles.warningText}>
            Selecting a folder only tells this app where to scan. It cannot force
            Google Phone or another dialer to save recordings there, and it does
            not bypass Android private-storage restrictions.
          </Text>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginBottom: 18,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  modeText: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pathLabel: {
    marginTop: 16,
  },
  pathText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  orText: {
    marginVertical: 14,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  resetButton: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  resetButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  infoCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  defaultPath: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 4,
  },
  warningCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },
});
