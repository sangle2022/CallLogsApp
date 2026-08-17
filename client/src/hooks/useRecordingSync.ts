import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import {
  CallRecordingFile,
  PreparedRecordingUpload,
} from '../types/Recording.types';
import {DateRange, SyncProgress} from '../types/Sync.types';
import {isTimestampInRange} from '../utils/dateRange';
import {ApiService} from '../services/ApiService';
import {RecordingService} from '../services/RecordingService';
import {RecordingSyncStatusService} from '../services/RecordingSyncStatusService';

interface Options {
  recordings: CallRecordingFile[];
  onStatusChanged?: () => Promise<void> | void;
}

/**
 * Independent recording sync.
 *
 * IMPORTANT:
 * - No call-log permission is requested here.
 * - No Android call rows are loaded here.
 * - No RecordingMatcher is used here.
 * - Every recording is deduplicated by SHA-256 of the actual audio file bytes.
 * - Local AsyncStorage status is visual-only. CRM remains the dedupe source.
 */
export function useRecordingSync({
  recordings,
  onStatusChanged,
}: Options) {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    completed: 0,
    total: 0,
  });

  const openModal = useCallback(() => {
    if (recordings.length === 0) {
      Alert.alert(
        'Nothing to sync',
        'No call recording files were found on this device.',
      );
      return;
    }

    setModalVisible(true);
  }, [recordings.length]);

  const closeModal = useCallback(() => {
    if (!uploading) {
      setModalVisible(false);
    }
  }, [uploading]);

  const syncRange = useCallback(
    async (range: DateRange) => {
      const selected = recordings.filter(recording => {
        return (
          recording.recordingTime > 0 &&
          isTimestampInRange(recording.recordingTime, range)
        );
      });

      if (selected.length === 0) {
        Alert.alert(
          'Nothing to sync',
          'No recording files exist in the selected date range.',
        );
        return;
      }

      setUploading(true);
      setProgress({completed: 0, total: selected.length});

      try {
        /**
         * Hash only selected files. RNFS calculates SHA-256 natively, so the
         * complete audio file is not loaded into JavaScript memory.
         */
        const prepared: PreparedRecordingUpload[] = [];
        const hashErrors: string[] = [];

        for (let index = 0; index < selected.length; index += 1) {
          const recording = selected[index];

          try {
            const recordingHash = await RecordingService.hashRecording(
              recording,
            );

            prepared.push({recording, recordingHash});
          } catch (error: any) {
            hashErrors.push(
              `${recording.fileName}: ${
                error?.message || 'Could not calculate file hash.'
              }`,
            );
          }

          setProgress({
            completed: index + 1,
            total: selected.length,
          });
        }

        if (prepared.length === 0) {
          Alert.alert(
            'Recording sync failed',
            hashErrors[0] || 'Unable to prepare the selected recording files.',
          );
          return;
        }

        /**
         * CRM preflight check remains the source of truth for duplicates.
         */
        const check = await ApiService.checkRecordings(
          prepared.map(item => item.recordingHash),
        );

        const alreadySyncedHashes = new Set(check.syncedHashes);
        const pendingHashes = new Set(check.pendingHashes);

        const alreadySyncedItems = prepared.filter(item =>
          alreadySyncedHashes.has(item.recordingHash),
        );

        /**
         * Persist the visual SYNCED state so it survives navigation and app
         * restarts. This does not affect upload/dedupe decisions.
         */
        if (alreadySyncedItems.length > 0) {
          await RecordingSyncStatusService.markAcknowledged(
            alreadySyncedItems.map(item => item.recording.id),
          );
          await onStatusChanged?.();
        }

        const pending = prepared.filter(item =>
          pendingHashes.has(item.recordingHash),
        );

        if (pending.length === 0) {
          setModalVisible(false);

          const lines = [
            `${alreadySyncedItems.length} recording(s) already exist in CRM`,
          ];

          if (hashErrors.length > 0) {
            lines.push(`${hashErrors.length} file(s) could not be prepared`);
          }

          Alert.alert('Nothing new to upload', lines.join('\n'));
          return;
        }

        setProgress({completed: 0, total: pending.length});

        const summary = await ApiService.syncRecordings(
          pending,
          range,
          setProgress,
        );

        const successfulHashes = new Set([
          ...summary.uploadedHashes,
          ...summary.repairedHashes,
          ...summary.duplicateHashes,
        ]);

        const newlyAcknowledgedIds = prepared
          .filter(item =>
            successfulHashes.has(item.recordingHash),
          )
          .map(item => item.recording.id);

        if (newlyAcknowledgedIds.length > 0) {
          await RecordingSyncStatusService.markAcknowledged(
            newlyAcknowledgedIds,
          );
          await onStatusChanged?.();
        }

        setModalVisible(false);

        const totalAlreadyInCrm =
          alreadySyncedItems.length + summary.skippedDuplicates;

        const lines = [
          `${summary.uploaded} new recording(s) uploaded`,
          `${summary.repaired} incomplete CRM recording(s) repaired`,
          `${totalAlreadyInCrm} duplicate recording(s) skipped`,
          `${summary.failed + hashErrors.length} failed`,
        ];

        if (summary.errors.length > 0) {
          lines.push('', ...summary.errors.slice(0, 2));
        } else if (hashErrors.length > 0) {
          lines.push('', ...hashErrors.slice(0, 2));
        }

        const hasProblems = summary.failed > 0 || hashErrors.length > 0;

        Alert.alert(
          hasProblems ? 'Recording sync finished' : 'Upload complete',
          lines.join('\n'),
        );
      } catch (error: any) {
        Alert.alert(
          'Recording sync failed',
          error?.message || 'Unable to upload recordings. Please try again.',
        );
      } finally {
        setUploading(false);
      }
    },
    [recordings, onStatusChanged],
  );

  return {
    modalVisible,
    uploading,
    progress,
    openModal,
    closeModal,
    syncRange,
  };
}
