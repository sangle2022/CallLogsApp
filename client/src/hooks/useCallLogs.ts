import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  CallLogEntry,
  LocalIdentity,
} from '../types/CallLog.types';

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

export function useCallLogs(
  localIdentity: LocalIdentity | null,
): UseCallLogsResult {
  const [callLogs, setCallLogs] = useState<
    CallLogEntry[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    permissionDenied,
    setPermissionDenied,
  ] = useState(false);

  const [
    permanentlyDenied,
    setPermanentlyDenied,
  ] = useState(false);

  const load = useCallback(async () => {
    // User has not completed setup yet.
    if (!localIdentity) {
      setCallLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const permissionResult =
        await PermissionManager
          .requestCallLogPermissions();

      if (!permissionResult.granted) {
        setPermissionDenied(true);

        setPermanentlyDenied(
          permissionResult.permanentlyDenied,
        );

        return;
      }

      setPermissionDenied(false);
      setPermanentlyDenied(false);

      const logs =
        await CallLogService.fetchCallLogs(
          localIdentity,
        );

      setCallLogs(logs);
    } catch (err) {
      console.warn(
        '[useCallLogs] Failed:',
        err,
      );

      setError(
        'Failed to load call logs. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [localIdentity]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    callLogs,
    loading,
    error,
    permissionDenied,
    permanentlyDenied,
    refresh: load,
  };
}