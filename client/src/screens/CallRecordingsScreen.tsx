/**
 * CallRecordingsScreen.tsx
 *
 * Responsibilities:
 * - Read the saved local user identity
 * - Scan local recording folders
 * - Display discovered recordings
 *
 * Identity is NOT edited from this screen.
 *
 * Recording upload/sync can later be added as a
 * separate flow that matches a recording to a call
 * and attaches it to the existing CRM call record.
 */

import React, {
  useCallback,
} from 'react';

import {
  FlatList,
  RefreshControl,
  StyleSheet,
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

import {useCallRecordings} from '../hooks/useCallRecordings';
import {useLocalIdentity} from '../hooks/useLocalIdentity';

import RecordingItem from '../components/RecordingItem';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';

import {COLORS} from '../utils/constants';

import {
  CallRecordingFile,
} from '../types/Recording.types';

import {
  PermissionManager,
} from '../permissions/PermissionManager';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'CallRecordings'
>;

export default function CallRecordingsScreen({
  navigation,
}: Props) {
  /**
   * Identity is read-only here.
   *
   * No modal is shown from the recording screen.
   */
  const {
    identity,
    loadingIdentity,
    reloadIdentity,
  } = useLocalIdentity();

  /**
   * Reload the identity whenever this
   * screen receives focus.
   *
   * This guarantees that edits made on Home
   * are immediately available here.
   */
  useFocusEffect(
    useCallback(() => {
      reloadIdentity();
    }, [reloadIdentity]),
  );

  /**
   * Recording scanning starts only after
   * the user identity exists.
   */
  const {
    recordings,
    loading,
    error,
    permissionDenied,
    permanentlyDenied,
    refresh,
  } = useCallRecordings(
    Boolean(identity),
  );

  if (loadingIdentity) {
    return (
      <LoadingIndicator message="Loading user details..." />
    );
  }

  /**
   * Safety guard in case somebody reaches
   * this route without completing setup.
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

  if (loading) {
    return (
      <LoadingIndicator message="Scanning for call recordings..." />
    );
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
        actionLabel={
          permanentlyDenied
            ? 'Open Settings'
            : 'Grant Permission'
        }
        onAction={async () => {
          if (permanentlyDenied) {
            await PermissionManager
              .openManageStorageSettings();

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
        keyExtractor={(
          item: CallRecordingFile,
        ) => item.id}
        renderItem={({item}) => (
          <RecordingItem recording={item} />
        )}
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
  },
});