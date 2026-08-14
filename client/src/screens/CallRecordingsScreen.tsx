/**
 * CallRecordingsScreen.tsx
 *
 * Recording sync:
 *
 * recording
 * -> matching Android call
 * -> Unique_Call_ID
 * -> existing CRM call
 * -> attachment
 */

import React, { useCallback } from 'react';

import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';

import { useCallRecordings } from '../hooks/useCallRecordings';

import { useLocalIdentity } from '../hooks/useLocalIdentity';

import { useRecordingSync } from '../hooks/useRecordingSync';

import RecordingItem from '../components/RecordingItem';

import LoadingIndicator from '../components/LoadingIndicator';

import EmptyState from '../components/EmptyState';

import UploadFab from '../components/UploadFab';

import SyncDateRangeModal from '../components/SyncDateRangeModal';

import SafeScreen from '../components/SafeScreen';

import { COLORS } from '../utils/constants';

import { CallRecordingFile } from '../types/Recording.types';

import { PermissionManager } from '../permissions/PermissionManager';

type Props = NativeStackScreenProps<RootStackParamList, 'CallRecordings'>;

export default function CallRecordingsScreen({ navigation }: Props) {
  const { identity, loadingIdentity, reloadIdentity } = useLocalIdentity();

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

  const sync = useRecordingSync({
    recordings,
    identity,
  });

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
    content = <LoadingIndicator message="Scanning for call recordings..." />;
  } else if (permissionDenied) {
    content = (
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
  } else if (error) {
    content = (
      <EmptyState
        title="Something went wrong"
        description={error}
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  } else if (recordings.length === 0) {
    content = (
      <EmptyState
        title="No recordings found"
        description="No audio files were found in known recording folders on this device."
        actionLabel="Rescan"
        onAction={refresh}
      />
    );
  } else {
    content = (
      <View style={styles.content}>
        <FlatList
          data={recordings}
          keyExtractor={(item: CallRecordingFile) => item.id}
          renderItem={({ item }) => <RecordingItem recording={item} />}
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

          accessibilityLabel="Upload matched call recordings to CRM"
        />

        <SyncDateRangeModal
          visible={sync.modalVisible}
          uploading={sync.uploading}
          progress={sync.progress}
          onClose={sync.closeModal}
          onConfirm={sync.syncRange}
          title="Sync recordings to CRM"
          subtitle="Select the call date range. Recordings are matched to calls in this range and attached only to existing CRM call records."
          confirmLabel="Sync recordings"
          progressLabel="recordings"
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
     * Keeps final recording above
     * floating upload button.
     */
    paddingBottom: 110,

    flexGrow: 1,
  },
});
