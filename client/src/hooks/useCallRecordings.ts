/**
 * useCallRecordings.ts
 * CHANGE: exposes `permanentlyDenied` (storage/all-files-access can only
 * be granted via Settings, so the screen needs to know to send the user
 * there instead of retrying a popup that will never appear).
 */
import { useCallback, useEffect, useState } from 'react';
import { CallRecordingFile } from '../types/Recording.types';
import { RecordingService } from '../services/RecordingService';
import { PermissionManager } from '../permissions/PermissionManager';

interface UseCallRecordingsResult {
  recordings: CallRecordingFile[];
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  permanentlyDenied: boolean;
  refresh: () => Promise<void>;
}

export function useCallRecordings(): UseCallRecordingsResult {
  const [recordings, setRecordings] = useState<CallRecordingFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const permissionResult = await PermissionManager.requestStoragePermissions();
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
      setError('Failed to scan for call recordings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { recordings, loading, error, permissionDenied, permanentlyDenied, refresh: load };
}