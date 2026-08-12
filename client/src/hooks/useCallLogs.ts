/**
 * useCallLogs.ts
 * CHANGE: now exposes `permanentlyDenied` so the screen can show an
 * "Open Settings" button instead of a "Grant Permission" button that
 * silently does nothing when Android has blocked the popup.
 */
import { useCallback, useEffect, useState } from 'react';
import { CallLogEntry } from '../types/CallLog.types';
import { CallLogService } from '../services/CallLogService';
import { PermissionManager } from '../permissions/PermissionManager';

interface UseCallLogsResult {
  callLogs: CallLogEntry[];
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  permanentlyDenied: boolean;
  refresh: () => Promise<void>;
}

export function useCallLogs(): UseCallLogsResult {
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const permissionResult = await PermissionManager.requestCallLogPermissions();
    console.log('[useCallLogs] permission result:', permissionResult);

    if (!permissionResult.granted) {
      setPermissionDenied(true);
      setPermanentlyDenied(permissionResult.permanentlyDenied);
      setLoading(false);
      return;
    }

    setPermissionDenied(false);
    setPermanentlyDenied(false);
    try {
      const logs = await CallLogService.fetchCallLogs();
      setCallLogs(logs);
    } catch (err) {
      setError('Failed to load call logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { callLogs, loading, error, permissionDenied, permanentlyDenied, refresh: load };
}