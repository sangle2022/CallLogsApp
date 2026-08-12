/**
 * useUploadFlow.ts
 * Generic hook that manages the upload popup's open/close state, applies
 * the selected date-range filter, runs the upload, and tracks progress.
 * Works for both call logs and recordings since the actual upload
 * function is supplied by the caller.
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { UploadRange, filterByRange } from '../utils/dateFilters';
import { UploadOutcome, UploadProgress } from '../services/ApiService';

interface UseUploadFlowOptions<T> {
  items: T[];
  getTimestamp: (item: T) => number;
  uploadFn: (items: T[], onProgress?: (progress: UploadProgress) => void) => Promise<UploadOutcome>;
}

interface UseUploadFlowResult {
  modalVisible: boolean;
  openModal: () => void;
  closeModal: () => void;
  uploading: boolean;
  progress: UploadProgress;
  confirmUpload: (range: UploadRange, customDays?: number) => Promise<void>;
}

export function useUploadFlow<T>({
  items,
  getTimestamp,
  uploadFn,
}: UseUploadFlowOptions<T>): UseUploadFlowResult {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ completed: 0, total: 0 });

  const openModal = useCallback(() => setModalVisible(true), []);

  const closeModal = useCallback(() => {
    // Prevent closing mid-upload so the user doesn't lose track of an
    // in-flight sync.
    if (!uploading) setModalVisible(false);
  }, [uploading]);

  const confirmUpload = useCallback(
    async (range: UploadRange, customDays?: number) => {
      const filtered = filterByRange(items, getTimestamp, range, customDays);

      if (filtered.length === 0) {
        Alert.alert('Nothing to upload', 'No records match the selected range.');
        return;
      }

      setUploading(true);
      setProgress({ completed: 0, total: filtered.length });

      try {
        const result = await uploadFn(filtered, setProgress);
        setUploading(false);
        setModalVisible(false);

        const message =
          result.failedCount > 0
            ? `${result.successCount} uploaded, ${result.failedCount} failed.\n\n${result.errors
                .slice(0, 3)
                .join('\n')}`
            : `${result.successCount} record(s) uploaded successfully.`;

        Alert.alert(result.failedCount > 0 ? 'Upload finished with errors' : 'Upload complete', message);
      } catch (err: any) {
        setUploading(false);
        Alert.alert('Upload failed', err?.message || 'Something went wrong while uploading.');
      }
    },
    [items, getTimestamp, uploadFn],
  );

  return { modalVisible, openModal, closeModal, uploading, progress, confirmUpload };
}