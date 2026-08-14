import {useCallback, useEffect, useState} from 'react';
import {CallRecordingFile} from '../types/Recording.types';
import {RecordingService} from '../services/RecordingService';
import {PermissionManager} from '../permissions/PermissionManager';

interface UseCallRecordingsResult {
  recordings: CallRecordingFile[];
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  permanentlyDenied: boolean;
  refresh: () => Promise<void>;
}

/**
 * Scan local recordings only when enabled.
 * Home identity setup controls whether feature screens are allowed to proceed.
 */
export function useCallRecordings(
  enabled = true,
): UseCallRecordingsResult {
  const [recordings, setRecordings] = useState<CallRecordingFile[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setRecordings([]);
      setLoading(false);
      setError(null);
      setPermissionDenied(false);
      setPermanentlyDenied(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const permissionResult = await PermissionManager.requestStoragePermissions();
      console.log('[useCallRecordings] permission result:', permissionResult);

      if (!permissionResult.granted) {
        setPermissionDenied(true);
        setPermanentlyDenied(permissionResult.permanentlyDenied);
        setRecordings([]);
        return;
      }

      setPermissionDenied(false);
      setPermanentlyDenied(false);

      const files = await RecordingService.scanCallRecordings();
      setRecordings(files);
    } catch (err) {
      console.warn('[useCallRecordings] Failed to scan recordings:', err);
      setError('Failed to scan for call recordings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    recordings,
    loading,
    error,
    permissionDenied,
    permanentlyDenied,
    refresh: load,
  };
}
