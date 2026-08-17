/**
 * CallRecordingsScreen.tsx
 *
 * Recordings are an independent CRM data flow:
 *
 * local audio file
 *   -> file metadata + SHA-256 content hash
 *   -> Mobile_Call_Recordings CRM record
 *   -> audio attached to that recording record
 *
 * There is intentionally NO recording-to-call-log matching on this screen.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

import {useCallRecordings} from '../hooks/useCallRecordings';
import {useLocalIdentity} from '../hooks/useLocalIdentity';
import {useRecordingSync} from '../hooks/useRecordingSync';

import RecordingItem from '../components/RecordingItem';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import UploadFab from '../components/UploadFab';
import RecordingDateRangeModal from '../components/RecordingDateRangeModal';

import {COLORS} from '../utils/constants';
import {CallRecordingFile} from '../types/Recording.types';
import {PermissionManager} from '../permissions/PermissionManager';
import {RecordingSyncStatusService} from '../services/RecordingSyncStatusService';

type Props = NativeStackScreenProps<RootStackParamList, 'CallRecordings'>;

export default function CallRecordingsScreen({navigation}: Props) {
  const {
    identity,
    loadingIdentity,
    reloadIdentity,
  } = useLocalIdentity();

  useFocusEffect(
    useCallback(() => {
      reloadIdentity();
    }, [reloadIdentity]),
  );

  const {
    recordings,
    loading,
    error,
    permissionDenied,
    permanentlyDenied,
    refresh,
  } = useCallRecordings(Boolean(identity));

  /**
   * Same idea as the Call Logs screen:
   * keep the visual SYNCED marker in AsyncStorage so navigating away and back
   * does not reset every recording to unsynced.
   */
  const [acknowledgedRecordingIds, setAcknowledgedRecordingIds] = useState<
    Set<string>
  >(new Set());

  const refreshVisualStatuses = useCallback(async () => {
    const status = await RecordingSyncStatusService.getAcknowledgedSet(
      recordings.map(item => item.id),
    );

    setAcknowledgedRecordingIds(status);
  }, [recordings]);

  useEffect(() => {
    void refreshVisualStatuses();
  }, [refreshVisualStatuses]);

  const sync = useRecordingSync({
    recordings,
    onStatusChanged: refreshVisualStatuses,
  });

  if (loadingIdentity) {
    return <LoadingIndicator message="Loading user details..." />;
  }

  if (!identity) {
    return (
      <EmptyState
        title="User details required"
        description="Your user name and phone number are not configured. Please configure them from the Home screen first."
        actionLabel="Go to Home"
        onAction={() => navigation.navigate('Home')}
      />
    );
  }

  if (loading) {
    return <LoadingIndicator message="Scanning for call recordings..." />;
  }

  if (permissionDenied) {
    return (
      <EmptyState
        title="Permission required"
        description={
          permanentlyDenied
            ? 'This app needs storage access to read call recording folders. Enable the required storage access in Settings, then return and rescan.'
            : 'Storage access is needed to find call recording files.'
        }
        actionLabel={permanentlyDenied ? 'Open Settings' : 'Grant Permission'}
        onAction={async () => {
          if (permanentlyDenied) {
            await PermissionManager.openManageStorageSettings();
            return;
          }

          await refresh();
        }}
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

  if (recordings.length === 0) {
    return (
      <EmptyState
        title="No recordings found"
        description="No audio files were found in known recording folders on this device."
        actionLabel="Rescan"
        onAction={refresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recordings}
        keyExtractor={(item: CallRecordingFile) => item.id}
        renderItem={({item}) => (
          <RecordingItem
            recording={item}
            synced={acknowledgedRecordingIds.has(item.id)}
          />
        )}
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

      <UploadFab
        onPress={sync.openModal}
        disabled={sync.uploading}
        accessibilityLabel="Upload recordings to CRM"
      />

      <RecordingDateRangeModal
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
    paddingBottom: 110,
  },
});
