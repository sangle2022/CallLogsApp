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

interface Options {
  recordings: CallRecordingFile[];
}

/**
 * Independent recording sync.
 *
 * IMPORTANT:
 * - No call-log permission is requested here.
 * - No Android call rows are loaded here.
 * - No RecordingMatcher is used here.
 * - Every recording is deduplicated by SHA-256 of the actual audio file bytes.
 */
export function useRecordingSync({recordings}: Options) {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    completed: 0,
    total: 0,
  });

  /**
   * Visual-only state for the current app session.
   * CRM remains the authoritative dedupe source.
   */
  const [syncedLocalIds, setSyncedLocalIds] = useState<Set<string>>(
    () => new Set(),
  );

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
         * Hash only the selected files. RNFS performs SHA-256 natively so we
         * do not load entire audio files into JavaScript memory.
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
         * Preflight CRM dedupe check prevents re-uploading audio that is
         * already safely attached in the independent recording module.
         */
        const check = await ApiService.checkRecordings(
          prepared.map(item => item.recordingHash),
        );

        const alreadySyncedHashes = new Set(check.syncedHashes);
        const pendingHashes = new Set(check.pendingHashes);

        const alreadySyncedItems = prepared.filter(item =>
          alreadySyncedHashes.has(item.recordingHash),
        );

        if (alreadySyncedItems.length > 0) {
          setSyncedLocalIds(current => {
            const next = new Set(current);
            alreadySyncedItems.forEach(item => next.add(item.recording.id));
            return next;
          });
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
          setProgress,
        );

        const successfulHashes = new Set([
          ...summary.uploadedHashes,
          ...summary.repairedHashes,
          ...summary.duplicateHashes,
        ]);

        setSyncedLocalIds(current => {
          const next = new Set(current);

          prepared.forEach(item => {
            if (
              alreadySyncedHashes.has(item.recordingHash) ||
              successfulHashes.has(item.recordingHash)
            ) {
              next.add(item.recording.id);
            }
          });

          return next;
        });

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
    [recordings],
  );

  return {
    modalVisible,
    uploading,
    progress,
    syncedLocalIds,
    openModal,
    closeModal,
    syncRange,
  };
}
