/**
 * CallRecordingsScreen.tsx
 *
 * Recordings are now a completely independent CRM data flow:
 *
 * local audio file
 *   -> file metadata + SHA-256 content hash
 *   -> Mobile_Call_Recordings CRM record
 *   -> audio attached to that recording record
 *
 * There is intentionally NO recording-to-call-log matching on this screen.
 */
import React, {useCallback} from 'react';
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
import SyncDateRangeModal from '../components/SyncDateRangeModal';

import {COLORS} from '../utils/constants';
import {CallRecordingFile} from '../types/Recording.types';
import {PermissionManager} from '../permissions/PermissionManager';

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

  const sync = useRecordingSync({recordings});

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
            synced={sync.syncedLocalIds.has(item.id)}
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

      <SyncDateRangeModal
        visible={sync.modalVisible}
        uploading={sync.uploading}
        progress={sync.progress}
        onClose={sync.closeModal}
        onConfirm={sync.syncRange}
        title="Upload recordings to CRM"
        subtitle="Select a recording date range. Files are uploaded independently using their file name, size, file time and audio content. They are not matched with call logs."
        confirmLabel="Upload recordings"
        progressLabel="recordings"
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
