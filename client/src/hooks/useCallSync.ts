import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import {CallLogEntry} from '../types/CallLog.types';
import {DateRange, SyncProgress} from '../types/Sync.types';
import {isTimestampInRange} from '../utils/dateRange';
import {ApiService} from '../services/ApiService';
import {SyncStatusService} from '../services/SyncStatusService';

interface Options {
  callLogs: CallLogEntry[];
  onStatusChanged?: () => Promise<void> | void;
}

/**
 * Call Logs screen sync.
 *
 * IMPORTANT: this is metadata-only. It does not scan or upload recordings.
 * Recording attachments are handled by useRecordingSync on the Recordings screen.
 */
export function useCallSync({callLogs, onStatusChanged}: Options) {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    completed: 0,
    total: 0,
  });

  const openModal = useCallback(() => {
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    if (!uploading) {
      setModalVisible(false);
    }
  }, [uploading]);

  const syncRange = useCallback(
    async (range: DateRange) => {
      const selected = callLogs.filter(call =>
        isTimestampInRange(call.timestamp, range),
      );

      if (selected.length === 0) {
        Alert.alert(
          'Nothing to sync',
          'No calls exist in the selected date range.',
        );
        return;
      }

      setUploading(true);
      setProgress({completed: 0, total: selected.length});

      try {
        const summary = await ApiService.syncCalls(
          selected,
          range,
          setProgress,
        );

        // UI-only status. CRM is still the duplicate source of truth.
        await SyncStatusService.markAcknowledged([
          ...summary.uploadedIds,
          ...summary.duplicateIds,
        ]);

        await onStatusChanged?.();
        setModalVisible(false);

        const lines = [
          `${summary.uploaded} new call(s) saved`,
          `${summary.skippedDuplicates} already present in CRM`,
          `${summary.failed} failed`,
        ];

        if (summary.errors.length > 0) {
          lines.push('', ...summary.errors.slice(0, 2));
        }

        Alert.alert(
          summary.failed > 0 ? 'Sync finished with errors' : 'Upload complete',
          lines.join('\n'),
        );
      } catch (error: any) {
        Alert.alert(
          'Sync failed',
          error?.message || 'Unable to sync calls. Please try again.',
        );
      } finally {
        setUploading(false);
      }
    },
    [callLogs, onStatusChanged],
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
