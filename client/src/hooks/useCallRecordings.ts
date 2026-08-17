/**
 * useCallRecordings.ts
 *
 * Reads storage permission, scans recordings, and automatically refreshes when
 * the recording folder preference changes from the Settings screen.
 */
import {useCallback, useEffect, useState} from 'react';
import {CallRecordingFile} from '../types/Recording.types';
import {RecordingService} from '../services/RecordingService';
import {PermissionManager} from '../permissions/PermissionManager';
import { RecordingPathService } from '../services/RecordingPathService';

interface UseCallRecordingsResult {
  recordings: CallRecordingFile[];
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  permanentlyDenied: boolean;
  refresh: () => Promise<void>;
}

/**
 * `enabled` is optional so this remains compatible with both existing usage:
 *   useCallRecordings()
 * and the identity-guarded usage:
 *   useCallRecordings(Boolean(identity))
 */
export function useCallRecordings(
  enabled: boolean = true,
): UseCallRecordingsResult {
  const [recordings, setRecordings] = useState<CallRecordingFile[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [permanentlyDenied, setPermanentlyDenied] =
    useState<boolean>(false);

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

    const permissionResult =
      await PermissionManager.requestStoragePermissions();
    console.log('[useCallRecordings] permission result:', permissionResult);

    if (!permissionResult.granted) {
      setPermissionDenied(true);
      setPermanentlyDenied(permissionResult.permanentlyDenied);
      setLoading(false);
      return;
    }

    setPermissionDenied(false);
    setPermanentlyDenied(false);

    try {
      const files = await RecordingService.scanCallRecordings();
      setRecordings(files);
    } catch (err) {
      console.warn('[useCallRecordings] Recording scan failed:', err);
      setError('Failed to scan for call recordings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return RecordingPathService.subscribe(() => {
      void load();
    });
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
