import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import {CallLogEntry, LocalIdentity} from '../types/CallLog.types';
import {CallRecordingFile} from '../types/Recording.types';
import {DateRange, SyncProgress} from '../types/Sync.types';
import {isTimestampInRange} from '../utils/dateRange';
import {PermissionManager} from '../permissions/PermissionManager';
import {CallLogService} from '../services/CallLogService';
import {
  ApiService,
  RecordingUploadItem,
} from '../services/ApiService';
import {RecordingMatcher} from '../services/RecordingMatcher';

interface Options {
  recordings: CallRecordingFile[];
  identity: LocalIdentity | null;
}

export function useRecordingSync({recordings, identity}: Options) {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    completed: 0,
    total: 0,
  });

  const openModal = useCallback(() => {
    if (!identity) {
      Alert.alert(
        'User details required',
        'Please configure your name and phone number from Home first.',
      );
      return;
    }

    if (recordings.length === 0) {
      Alert.alert('Nothing to sync', 'No call recordings were found on this device.');
      return;
    }

    setModalVisible(true);
  }, [identity, recordings.length]);

  const closeModal = useCallback(() => {
    if (!uploading) {
      setModalVisible(false);
    }
  }, [uploading]);

  const syncRange = useCallback(
    async (range: DateRange) => {
      if (!identity) {
        Alert.alert(
          'User details required',
          'Please configure your name and phone number from Home first.',
        );
        return;
      }

      setUploading(true);
      setProgress({completed: 0, total: 0});

      try {
        // Recording -> CRM matching depends on the original Android call row.
        const permissionResult =
          await PermissionManager.requestCallLogPermissions();

        if (!permissionResult.granted) {
          Alert.alert(
            'Call log permission required',
            'Call log access is required to safely match each recording to the correct CRM call record.',
          );
          return;
        }

        const callLogs: CallLogEntry[] =
          await CallLogService.fetchCallLogs(identity);

        const selectedCalls = callLogs.filter(call =>
          isTimestampInRange(call.timestamp, range),
        );

        if (selectedCalls.length === 0) {
          Alert.alert(
            'Nothing to sync',
            'No calls exist in the selected date range.',
          );
          return;
        }

        const usedRecordingPaths = new Set<string>();
        const matched: RecordingUploadItem[] = [];

        for (const call of selectedCalls) {
          const recording = RecordingMatcher.findMatchForCall(
            call,
            recordings,
            usedRecordingPaths,
          );

          if (!recording) {
            continue;
          }

          usedRecordingPaths.add(recording.filePath);
          matched.push({call, recording});
        }

        const unmatchedCalls = selectedCalls.length - matched.length;

        if (matched.length === 0) {
          Alert.alert(
            'No safe matches found',
            'No recording could be matched confidently to calls in this date range. Nothing was uploaded.',
          );
          return;
        }

        setProgress({completed: 0, total: matched.length});

        const summary = await ApiService.syncRecordings(
          matched,
          range,
          setProgress,
        );

        setModalVisible(false);

        const lines = [
          `${summary.attached} recording(s) attached`,
          `${summary.alreadyAttached} already attached`,
          `${summary.notFound} CRM call record(s) not found`,
          `${summary.failed} failed`,
        ];

        if (unmatchedCalls > 0) {
          lines.push(
            `${unmatchedCalls} call(s) had no safe local recording match`,
          );
        }

        if (summary.notFound > 0) {
          lines.push('', 'Sync the corresponding call logs first, then retry recordings.');
        }

        if (summary.errors.length > 0) {
          lines.push('', ...summary.errors.slice(0, 2));
        }

        const hasProblems =
          summary.failed > 0 ||
          summary.notFound > 0 ||
          unmatchedCalls > 0;

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
    [identity, recordings],
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
