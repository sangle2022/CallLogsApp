// /**
//  * CallLogsScreen.tsx
//  * CHANGE: shows "Open Settings" (instead of a dead-end "Grant Permission"
//  * button) when the call-log/contacts permission has been permanently
//  * denied and Android will no longer show the popup.
//  */
// import React from 'react';
// import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
// import { useCallLogs } from '../hooks/useCallLogs';
// import CallLogItem from '../components/CallLogItem';
// import LoadingIndicator from '../components/LoadingIndicator';
// import EmptyState from '../components/EmptyState';
// import { COLORS } from '../utils/constants';
// import { CallLogEntry } from '../types/CallLog.types';
// import { PermissionManager } from '../permissions/PermissionManager';

// export default function CallLogsScreen() {
//   const { callLogs, loading, error, permissionDenied, permanentlyDenied, refresh } = useCallLogs();

//   if (loading) {
//     return <LoadingIndicator message="Loading call logs..." />;
//   }

//   if (permissionDenied) {
//     return (
//       <EmptyState
//         title="Permission required"
//         description={
//           permanentlyDenied
//             ? "Call log access was denied and Android won't show the permission popup again. Please enable 'Call logs' and 'Contacts' permissions manually in Settings, then come back and tap Retry."
//             : 'Call log access is needed to display your call history. Please grant the permission to continue.'
//         }
//         actionLabel={permanentlyDenied ? 'Open Settings' : 'Grant Permission'}
//         onAction={() => {
//           if (permanentlyDenied) {
//             PermissionManager.openAppSettings();
//           } else {
//             refresh();
//           }
//         }}
//       />
//     );
//   }

//   if (error) {
//     return (
//       <EmptyState title="Something went wrong" description={error} actionLabel="Retry" onAction={refresh} />
//     );
//   }

//   if (callLogs.length === 0) {
//     return <EmptyState title="No call logs found" description="Your call history is empty." actionLabel="Retry" onAction={refresh} />;
//   }

//   return (
//     <View style={styles.container}>
//       <FlatList
//         data={callLogs}
//         keyExtractor={(item: CallLogEntry) => item.id}
//         renderItem={({ item }) => <CallLogItem entry={item} />}
//         contentContainerStyle={styles.listContent}
//         refreshControl={
//           <RefreshControl refreshing={false} onRefresh={refresh} colors={[COLORS.primary]} />
//         }
//         initialNumToRender={20}
//         windowSize={10}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: COLORS.background },
//   listContent: { paddingVertical: 10 },
// });
/**
 * CallLogsScreen.tsx
 * ADDED (on top of the existing filter bar + permission/error/loading
 * states, all unchanged): an upload FAB that opens UploadOptionsModal,
 * letting the user push Today / All / Custom-range call logs to the CRM
 * backend via ApiService.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallLogs } from '../hooks/useCallLogs';
import CallLogItem from '../components/CallLogItem';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import UploadFab from '../components/UploadFab';
import UploadOptionsModal from '../components/UploadOptionsModal';
import { COLORS } from '../utils/constants';
import { CallLogEntry, CallType } from '../types/CallLog.types';
import { PermissionManager } from '../permissions/PermissionManager';
import { useUploadFlow } from '../hooks/useUploadFlow';
import { ApiService } from '../services/ApiService';

type CallLogFilter = 'ALL' | CallType.INCOMING | CallType.OUTGOING | CallType.MISSED;

const FILTER_OPTIONS: { label: string; value: CallLogFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Incoming', value: CallType.INCOMING },
  { label: 'Outgoing', value: CallType.OUTGOING },
  { label: 'Missed', value: CallType.MISSED },
];

export default function CallLogsScreen() {
  const { callLogs, loading, error, permissionDenied, permanentlyDenied, refresh } = useCallLogs();
  const [activeFilter, setActiveFilter] = useState<CallLogFilter>('ALL');

  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') return callLogs;
    return callLogs.filter((entry: CallLogEntry) => entry.callType === activeFilter);
  }, [callLogs, activeFilter]);

  // Upload flow: uploads from the FULL call log list (not the filtered
  // view) so switching the Incoming/Outgoing/Missed filter never affects
  // what gets uploaded - only the date range chosen in the popup does.
  const upload = useUploadFlow<CallLogEntry>({
    items: callLogs,
    getTimestamp: entry => entry.timestamp,
    uploadFn: ApiService.uploadCallLogs.bind(ApiService),
  });

  if (loading) {
    return <LoadingIndicator message="Loading call logs..." />;
  }

  if (permissionDenied) {
    return (
      <EmptyState
        title="Permission required"
        description={
          permanentlyDenied
            ? "Call log access was denied and Android won't show the permission popup again. Please enable 'Call logs' and 'Contacts' permissions manually in Settings, then come back and tap Retry."
            : 'Call log access is needed to display your call history. Please grant the permission to continue.'
        }
        actionLabel={permanentlyDenied ? 'Open Settings' : 'Grant Permission'}
        onAction={() => {
          if (permanentlyDenied) {
            PermissionManager.openAppSettings();
          } else {
            refresh();
          }
        }}
      />
    );
  }

  if (error) {
    return (
      <EmptyState title="Something went wrong" description={error} actionLabel="Retry" onAction={refresh} />
    );
  }

  if (callLogs.length === 0) {
    return <EmptyState title="No call logs found" description="Your call history is empty." actionLabel="Retry" onAction={refresh} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        {FILTER_OPTIONS.map(option => {
          const isActive = activeFilter === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredLogs.length === 0 ? (
        <EmptyState
          title="No matching calls"
          description="No call logs match this filter."
          actionLabel="Show All"
          onAction={() => setActiveFilter('ALL')}
        />
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item: CallLogEntry) => item.id}
          renderItem={({ item }) => <CallLogItem entry={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} colors={[COLORS.primary]} />
          }
          initialNumToRender={20}
          windowSize={10}
        />
      )}

      <UploadFab onPress={upload.openModal} />

      <UploadOptionsModal
        visible={upload.modalVisible}
        uploading={upload.uploading}
        progress={upload.progress}
        onClose={upload.closeModal}
        onConfirm={upload.confirmUpload}
        title="Upload Call Logs"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingVertical: 10, paddingBottom: 90 }, // extra bottom space so FAB doesn't cover last row
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
    color: '#fff',
  },
});