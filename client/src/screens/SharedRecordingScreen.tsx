/**
 * SharedRecordingScreen.tsx
 *
 * Handles ONE recording shared from another Android application.
 *
 * IMPORTANT:
 *
 * This screen is completely separate from the normal folder-scanning flow.
 *
 * Google Phone
 *      ↓
 * Android Share
 *      ↓
 * temporary cache file
 *      ↓
 * THIS SCREEN
 *      ↓
 * convert to existing CallRecordingFile
 *      ↓
 * reuse existing hash/check/upload code
 *
 * Cancel:
 * temporary file is deleted.
 *
 * Successful sync:
 * temporary file is deleted.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import RNFS from 'react-native-fs';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/AppNavigator';

import type { CallRecordingFile } from '../types/Recording.types';

import RecordingItem from '../components/RecordingItem';

import { RecordingService } from '../services/RecordingService';
import { ApiService } from '../services/ApiService';

import { buildDateRange } from '../utils/dateRange';
import { COLORS } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedRecording'>;

/**
 * Converts an epoch timestamp to device-local YYYY-MM-DD.
 *
 * Recording backend currently allows one recording day per request,
 * so the shared recording gets a one-day DateRange.
 */
function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);

  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

export default function SharedRecordingScreen({ navigation, route }: Props) {
  const [uploading, setUploading] = useState(false);
    console.log('routeeeeeeeeeee',route)

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  /**
   * Convert the Android share parameters into the SAME recording structure
   * already used by the existing application.
   *
   * From this point onward we can reuse existing code.
   */
  const recording = useMemo<CallRecordingFile>(() => {
    const parsedSize = Number(route.params.fileSize);

    const parsedRecordingTime = Number(route.params.recordingTime);

    return {
      id: `shared-${route.params.importId}`,

      fileName: route.params.fileName,

      filePath: route.params.filePath,

      fileSize: Number.isFinite(parsedSize) ? parsedSize : 0,

      recordingTime:
        Number.isFinite(parsedRecordingTime) && parsedRecordingTime > 0
          ? parsedRecordingTime
          : Date.now(),

      extension: String(route.params.extension || 'wav').toLowerCase(),
    };
  }, [
    route.params.extension,
    route.params.fileName,
    route.params.filePath,
    route.params.fileSize,
    route.params.importId,
    route.params.recordingTime,
  ]);

  /**
   * Shared files are temporary.
   *
   * They are never copied to the normal recording folder.
   */
  const deleteTemporaryFile = useCallback(async () => {
    try {
      const exists = await RNFS.exists(recording.filePath);

      if (exists) {
        await RNFS.unlink(recording.filePath);

        console.log(
          '[SharedRecording] Temporary file deleted:',
          recording.filePath,
        );
      }
    } catch (error) {
      /**
       * Cleanup failure should not crash the application.
       * Android cache can still remove the file later.
       */
      console.warn('[SharedRecording] Could not delete temporary file:', error);
    }
  }, [recording.filePath]);

  const leaveScreen = useCallback(
    async (destination: 'Home' | 'CallRecordings' = 'Home') => {
      await deleteTemporaryFile();

      /**
       * When the application was already open before Share,
       * there may be an existing screen behind this one.
       */
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }

      navigation.replace(destination);
    },
    [deleteTemporaryFile, navigation],
  );

  /**
   * Validate that Android successfully created our temporary cache file.
   */
  useEffect(() => {
    let mounted = true;

    const validate = async () => {
      const exists = await RNFS.exists(recording.filePath);

      if (mounted && !exists) {
        Alert.alert(
          'Recording unavailable',
          'The shared recording is no longer available.',
          [
            {
              text: 'OK',

              onPress: () => {
                navigation.replace('Home');
              },
            },
          ],
        );
      }
    };

    void validate();

    return () => {
      mounted = false;
    };
  }, [navigation, recording.filePath]);

  /**
   * If user presses Android back/header back without syncing,
   * remove the temporary file.
   *
   * While upload is running we prevent leaving the screen because fetch is
   * currently reading this file.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (uploading) {
        event.preventDefault();

        Alert.alert(
          'Upload in progress',
          'Please wait until the recording upload finishes.',
        );

        return;
      }

      void deleteTemporaryFile();
    });

    return unsubscribe;
  }, [deleteTemporaryFile, navigation, uploading]);

  const handleCancel = useCallback(async () => {
    if (uploading) {
      return;
    }

    await leaveScreen('Home');
  }, [leaveScreen, uploading]);

  /**
   * Reuse the EXISTING recording upload architecture.
   *
   * No new backend endpoint.
   * No CRM changes.
   * No call-log matching.
   */
  const handleSyncToCrm = useCallback(async () => {
    if (uploading) {
      return;
    }

    setUploading(true);

    setStatusMessage('Preparing recording...');

    try {
      const exists = await RNFS.exists(recording.filePath);

      if (!exists) {
        throw new Error('The temporary recording file is no longer available.');
      }

      /**
       * EXISTING SHA-256 logic.
       */
      setStatusMessage('Checking recording...');

      const recordingHash = await RecordingService.hashRecording(recording);

      /**
       * EXISTING CRM duplicate check.
       */
      const check = await ApiService.checkRecordings([recordingHash]);

      if (check.syncedHashes.includes(recordingHash)) {
        setStatusMessage('Recording already exists in CRM.');

        Alert.alert('Already synced', 'This recording already exists in CRM.', [
          {
            text: 'OK',

            onPress: () => {
              void leaveScreen('CallRecordings');
            },
          },
        ]);

        return;
      }

      /**
       * Backend recording range is one calendar day.
       *
       * We create that day directly from the recording timestamp.
       * No date-selection modal is required for a shared file.
       */
      const dateKey = toLocalDateKey(recording.recordingTime);

      const range = buildDateRange(dateKey, dateKey, 1);

      setStatusMessage('Uploading recording to CRM...');

      /**
       * EXISTING multipart upload method.
       */
      const summary = await ApiService.syncRecordings(
        [
          {
            recording,
            recordingHash,
          },
        ],
        range,
      );

      const successful =
        summary.uploadedHashes.includes(recordingHash) ||
        summary.repairedHashes.includes(recordingHash) ||
        summary.duplicateHashes.includes(recordingHash);

      if (!successful) {
        const failureReason =
          summary.failedItems?.[0]?.reason ||
          summary.errors?.[0] ||
          'CRM did not confirm the recording upload.';

        throw new Error(failureReason);
      }

      setStatusMessage('Recording synced successfully.');

      Alert.alert(
        'Synced to CRM',
        'The recording was successfully synced to CRM.',
        [
          {
            text: 'OK',

            onPress: () => {
              void leaveScreen('CallRecordings');
            },
          },
        ],
      );
    } catch (error: any) {
      console.warn('[SharedRecording] Sync failed:', error);

      setStatusMessage(null);

      Alert.alert(
        'Recording sync failed',
        error?.message || 'Unable to sync this recording to CRM.',
      );
    } finally {
      setUploading(false);
    }
  }, [leaveScreen, recording, uploading]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.introCard}>
          <Text style={styles.title}>Shared Recording</Text>

          <Text style={styles.description}>
            This recording was shared to Call Manager. It is temporary and will
            only be sent to CRM if you choose Sync to CRM.
          </Text>
        </View>

        <RecordingItem recording={recording} />

        {statusMessage ? (
          <View style={styles.statusContainer}>
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : null}

            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            disabled={uploading}
            activeOpacity={0.8}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.syncButton,
              uploading && styles.disabledButton,
            ]}
            disabled={uploading}
            activeOpacity={0.8}
            onPress={handleSyncToCrm}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.syncButtonText}>Sync to CRM</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    paddingTop: 12,
  },

  introCard: {
    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,

    borderRadius: 10,

    padding: 16,

    marginHorizontal: 16,
    marginBottom: 6,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  description: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    marginHorizontal: 16,
    marginTop: 12,

    padding: 12,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,

    borderRadius: 8,
  },

  statusText: {
    flex: 1,
    marginLeft: 10,

    fontSize: 13,
    color: COLORS.textSecondary,
  },

  spacer: {
    flex: 1,
  },

  actions: {
    flexDirection: 'row',

    gap: 12,

    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,

    backgroundColor: COLORS.card,

    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  button: {
    flex: 1,

    minHeight: 50,

    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButton: {
    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  syncButton: {
    backgroundColor: COLORS.primary,
  },

  syncButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  disabledButton: {
    opacity: 0.65,
  },
});
