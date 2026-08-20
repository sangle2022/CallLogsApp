import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';

import { useCallLogs } from '../hooks/useCallLogs';

import { useCallSync } from '../hooks/useCallSync';

import { useLocalIdentity } from '../hooks/useLocalIdentity';

import CallLogItem from '../components/CallLogItem';

import LoadingIndicator from '../components/LoadingIndicator';

import EmptyState from '../components/EmptyState';

import UploadFab from '../components/UploadFab';

import SyncDateRangeModal from '../components/SyncDateRangeModal';

import SafeScreen from '../components/SafeScreen';

import { COLORS } from '../utils/constants';

import { CallLogEntry, CallType } from '../types/CallLog.types';

import { PermissionManager } from '../permissions/PermissionManager';

import { SyncStatusService } from '../services/SyncStatusService';

type Props = NativeStackScreenProps<RootStackParamList, 'CallLogs'>;

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

export default function CallLogsScreen({ navigation }: Props) {
  const { identity, loadingIdentity, reloadIdentity } = useLocalIdentity();

  useFocusEffect(
    useCallback(() => {
      reloadIdentity();
    }, [reloadIdentity]),
  );

  const {
    callLogs,
    loading,
    error,
    permissionDenied,
    permanentlyDenied,
    refresh,
  } = useCallLogs(identity);

  const [activeFilter, setActiveFilter] = useState<CallLogFilter>('ALL');


  const [isFilterPending, startFilterTransition] = useTransition();

  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    new Set(),
  );

  const handleFilterChange = useCallback(
    (newFilter: CallLogFilter) => {
      if (newFilter === activeFilter) {
        return;
      }

      startFilterTransition(() => {
        setActiveFilter(newFilter);
      });
    },
    [activeFilter],
  );

  const refreshVisualStatuses = useCallback(async () => {
    if (callLogs.length === 0) {
      setAcknowledgedIds(new Set());

      return;
    }

    try {
      const status = await SyncStatusService.getAcknowledgedSet(
        callLogs.map(item => item.uniqueCallId),
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

  const sync = useCallSync({
    callLogs,

    onStatusChanged: refreshVisualStatuses,
  });

  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') {
      return callLogs;
    }

    return callLogs.filter(
      (entry: CallLogEntry) => entry.callType === activeFilter,
    );
  }, [callLogs, activeFilter]);

  let content: React.ReactNode;

  if (loadingIdentity) {
    content = <LoadingIndicator message="Loading user details..." />;
  } else if (!identity) {
    content = (
      <EmptyState
        title="User details required"
        description="Your user name and phone number are not configured. Please configure them from the Home screen first."
        actionLabel="Go to Home"
        onAction={() => navigation.navigate('Home')}
      />
    );
  } else if (loading) {
    content = <LoadingIndicator message="Loading call logs..." />;
  } else if (permissionDenied) {
    content = (
      <EmptyState
        title="Permission required"
        description={
          permanentlyDenied
            ? "Call log access was denied and Android won't show the permission popup again. Enable Call logs and Contacts in Settings, then return and retry."
            : 'Call log access is needed to display your call history.'
        }
        actionLabel={permanentlyDenied ? 'Open Settings' : 'Grant Permission'}
        onAction={() =>
          permanentlyDenied ? PermissionManager.openAppSettings() : refresh()
        }
      />
    );
  } else if (error) {
    content = (
      <EmptyState
        title="Something went wrong"
        description={error}
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  } else if (callLogs.length === 0) {
    content = (
      <EmptyState
        title="No call logs found"
        description="Your call history is empty."
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  } else {
    content = (
      <View style={styles.content}>
        <View style={styles.filterBar}>
          {FILTER_OPTIONS.map(option => {
            const active = activeFilter === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,

                  active && styles.filterChipActive,
                ]}
                onPress={() => handleFilterChange(option.value)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterChipText,

                    active && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isFilterPending ? (
          <View style={styles.filterLoader}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text style={styles.filterLoaderText}>
              Filtering calls...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredLogs}
            keyExtractor={item => item.uniqueCallId}
            renderItem={({ item }) => (
              <CallLogItem
                entry={item}
                acknowledged={acknowledgedIds.has(item.uniqueCallId)}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                title="No matching calls"
                description="No call logs match this type filter."
                actionLabel="Show All"
                onAction={() => handleFilterChange('ALL')}
              />
            }
            contentContainerStyle={styles.listContent}
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
        )}

        <UploadFab
          onPress={sync.openModal}
          disabled={sync.uploading}
          accessibilityLabel="Upload call logs to CRM"
        />

        <SyncDateRangeModal
          visible={sync.modalVisible}
          uploading={sync.uploading}
          progress={sync.progress}
          onClose={sync.closeModal}
          onConfirm={sync.syncRange}
          title="Sync calls to CRM"
          confirmLabel="Sync selected range"
          progressLabel="calls"
        />
      </View>
    );
  }

  return <SafeScreen style={styles.container}>{content}</SafeScreen>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
  },

  content: {
    flex: 1,
  },

  listContent: {
    paddingTop: 10,

    /**
     * Enough room for the floating
     * action button.
     */
    paddingBottom: 110,

    flexGrow: 1,
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
  filterLoader: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingBottom: 80,
  },

  filterLoaderText: {
    marginTop: 12,

    fontSize: 14,

    fontWeight: '600',

    color: COLORS.textSecondary,
  },
});