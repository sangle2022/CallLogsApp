import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { CallLogEntry } from '../types/CallLog.types';
import { CallRecordingFile } from '../types/Recording.types';
import { DateRange, SyncProgress } from '../types/Sync.types';
import { isTimestampInRange } from '../utils/dateRange';
import { PermissionManager } from '../permissions/PermissionManager';
import { RecordingService } from '../services/RecordingService';
import { ApiService } from '../services/ApiService';
import { SyncStatusService } from '../services/SyncStatusService';

interface Options {
  callLogs: CallLogEntry[];
  onStatusChanged?: () => Promise<void> | void;
}

export function useCallSync({ callLogs, onStatusChanged }: Options) {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ completed: 0, total: 0 });

  const openModal = useCallback(() => setModalVisible(true), []);
  const closeModal = useCallback(() => {
    if (!uploading) setModalVisible(false);
  }, [uploading]);

  const syncRange = useCallback(async (range: DateRange) => {
    const selected = callLogs.filter(call => isTimestampInRange(call.timestamp, range));
    if (selected.length === 0) {
      Alert.alert('Nothing to sync', 'No calls exist in the selected date range.');
      return;
    }

    setUploading(true);
    setProgress({ completed: 0, total: selected.length });

    let recordings: CallRecordingFile[] = [];
    let audioPermissionUnavailable = false;
    try {
      const storagePermission = await PermissionManager.requestStoragePermissions();
      if (storagePermission.granted) {
        recordings = await RecordingService.scanCallRecordings();
      } else {
        audioPermissionUnavailable = true;
      }

      const summary = await ApiService.syncCalls(
        selected,
        range,
        recordings,
        setProgress,
      );

      // This status is UI-only. It never suppresses future uploads.
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

      if (summary.attachmentsUploaded > 0 || summary.attachmentFailed > 0) {
        lines.push(
          `Audio: ${summary.attachmentsUploaded} attached, ${summary.attachmentFailed} failed`,
        );
      }
      if (audioPermissionUnavailable) {
        lines.push('Audio storage permission was unavailable; metadata was still synced.');
      }
      if (summary.errors.length > 0) {
        lines.push('', ...summary.errors.slice(0, 2));
      }

      Alert.alert(
        summary.failed > 0 ? 'Sync finished with errors' : 'Upload complete',
        lines.join('\n'),
      );
    } catch (error: any) {
      Alert.alert('Sync failed', error?.message || 'Unexpected sync error.');
    } finally {
      setUploading(false);
    }
  }, [callLogs, onStatusChanged]);

  return {
    modalVisible,
    uploading,
    progress,
    openModal,
    closeModal,
    syncRange,
  };
}
