/**
 * CallLogsScreen.tsx
 *
 * Responsibilities:
 * - Read saved local identity
 * - Load Android call logs
 * - Display caller/receiver mapping
 * - Filter call types
 * - Show locally cached visual sync status
 * - Allow date-range CRM sync
 *
 * Identity is NOT edited from this screen.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import type {
  RootStackParamList,
} from '../navigation/AppNavigator';

import {useCallLogs} from '../hooks/useCallLogs';
import {useCallSync} from '../hooks/useCallSync';
import {useLocalIdentity} from '../hooks/useLocalIdentity';

import CallLogItem from '../components/CallLogItem';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import UploadFab from '../components/UploadFab';
import SyncDateRangeModal from '../components/SyncDateRangeModal';

import {COLORS} from '../utils/constants';

import {
  CallLogEntry,
  CallType,
} from '../types/CallLog.types';

import {PermissionManager} from '../permissions/PermissionManager';
import {SyncStatusService} from '../services/SyncStatusService';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'CallLogs'
>;

type CallLogFilter =
  | 'ALL'
  | CallType.INCOMING
  | CallType.OUTGOING
  | CallType.MISSED;

const FILTER_OPTIONS: {
  label: string;
  value: CallLogFilter;
}[] = [
  {
    label: 'All',
    value: 'ALL',
  },
  {
    label: 'Incoming',
    value: CallType.INCOMING,
  },
  {
    label: 'Outgoing',
    value: CallType.OUTGOING,
  },
  {
    label: 'Missed',
    value: CallType.MISSED,
  },
];

export default function CallLogsScreen({
  navigation,
}: Props) {
  /**
   * Read-only identity usage.
   *
   * promptIfMissing defaults to false,
   * therefore this screen NEVER opens
   * the identity modal.
   */
  const {
    identity,
    loadingIdentity,
    reloadIdentity,
  } = useLocalIdentity();

  /**
   * Reload identity whenever this screen receives focus.
   *
   * Important scenario:
   *
   * Logs
   *  ↓
   * Home
   *  ↓
   * Edit number
   *  ↓
   * Logs
   *
   * We want the new number immediately.
   */
  useFocusEffect(
    useCallback(() => {
      reloadIdentity();
    }, [reloadIdentity]),
  );

  /**
   * Call logs will only load after
   * identity is available.
   */
  const {
    callLogs,
    loading,
    error,
    permissionDenied,
    permanentlyDenied,
    refresh,
  } = useCallLogs(identity);

  const [activeFilter, setActiveFilter] =
    useState<CallLogFilter>('ALL');

  const [
    acknowledgedIds,
    setAcknowledgedIds,
  ] = useState<Set<string>>(new Set());

  /**
   * AsyncStorage state is visual-only.
   *
   * CRM remains the duplicate source of truth.
   */
  const refreshVisualStatuses =
    useCallback(async () => {
      if (callLogs.length === 0) {
        setAcknowledgedIds(new Set());
        return;
      }

      try {
        const status =
          await SyncStatusService.getAcknowledgedSet(
            callLogs.map(
              item => item.uniqueCallId,
            ),
          );

        setAcknowledgedIds(status);
      } catch (statusError) {
        console.warn(
          '[CallLogsScreen] Failed to load visual sync statuses:',
          statusError,
        );
      }
    }, [callLogs]);

  useEffect(() => {
    refreshVisualStatuses();
  }, [refreshVisualStatuses]);

  /**
   * Sync hook receives already-mapped call logs.
   */
  const sync = useCallSync({
    callLogs,
    onStatusChanged: refreshVisualStatuses,
  });

  /**
   * Local UI filter only.
   */
  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') {
      return callLogs;
    }

    return callLogs.filter(
      (entry: CallLogEntry) =>
        entry.callType === activeFilter,
    );
  }, [callLogs, activeFilter]);

  /**
   * First check local identity loading.
   */
  if (loadingIdentity) {
    return (
      <LoadingIndicator message="Loading user details..." />
    );
  }

  /**
   * Safety guard.
   *
   * Normally users should not reach this state,
   * because Home forces profile setup.
   */
  if (!identity) {
    return (
      <EmptyState
        title="User details required"
        description={
          'Your user name and phone number are not configured. Please configure them from the Home screen first.'
        }
        actionLabel="Go to Home"
        onAction={() =>
          navigation.navigate('Home')
        }
      />
    );
  }

  /**
   * Once identity exists we can safely
   * load/map Android call logs.
   */
  if (loading) {
    return (
      <LoadingIndicator message="Loading call logs..." />
    );
  }

  if (permissionDenied) {
    return (
      <EmptyState
        title="Permission required"
        description={
          permanentlyDenied
            ? "Call log access was denied and Android won't show the permission popup again. Enable Call logs and Contacts in Settings, then return and retry."
            : 'Call log access is needed to display your call history.'
        }
        actionLabel={
          permanentlyDenied
            ? 'Open Settings'
            : 'Grant Permission'
        }
        onAction={() =>
          permanentlyDenied
            ? PermissionManager.openAppSettings()
            : refresh()
        }
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Something went wrong"
        description={error}
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  }

  if (callLogs.length === 0) {
    return (
      <EmptyState
        title="No call logs found"
        description="Your call history is empty."
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* CALL TYPE FILTER */}
      <View style={styles.filterBar}>
        {FILTER_OPTIONS.map(option => {
          const active =
            activeFilter === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                active &&
                  styles.filterChipActive,
              ]}
              onPress={() =>
                setActiveFilter(option.value)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  active &&
                    styles.filterChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CALL LOG LIST */}
      <FlatList
        data={filteredLogs}
        keyExtractor={item =>
          item.uniqueCallId
        }
        renderItem={({item}) => (
          <CallLogItem
            entry={item}
            acknowledged={acknowledgedIds.has(
              item.uniqueCallId,
            )}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No matching calls"
            description="No call logs match this type filter."
            actionLabel="Show All"
            onAction={() =>
              setActiveFilter('ALL')
            }
          />
        }
        contentContainerStyle={
          styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            colors={[COLORS.primary]}
          />
        }
        initialNumToRender={20}
        windowSize={10}
      />

      {/* SYNC BUTTON */}
      <UploadFab
        onPress={sync.openModal}
        disabled={sync.uploading}
      />

      {/* DATE RANGE SYNC */}
      <SyncDateRangeModal
        visible={sync.modalVisible}
        uploading={sync.uploading}
        progress={sync.progress}
        onClose={sync.closeModal}
        onConfirm={sync.syncRange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  listContent: {
    paddingVertical: 10,
    paddingBottom: 90,
  },

  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  filterChipTextActive: {
    color: '#FFFFFF',
  },
});