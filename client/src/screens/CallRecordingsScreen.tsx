// // /**
// //  * CallRecordingsScreen.tsx
// //  * Displays call-recording audio files found on device storage in a FlatList.
// //  * Data logic lives in `useCallRecordings`; this component only renders UI.
// //  */
// // import React from 'react';
// // import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
// // import { useCallRecordings } from '../hooks/useCallRecordings';
// // import RecordingItem from '../components/RecordingItem';
// // import LoadingIndicator from '../components/LoadingIndicator';
// // import EmptyState from '../components/EmptyState';
// // import { COLORS } from '../utils/constants';
// // import { CallRecordingFile } from '../types/Recording.types';

// // export default function CallRecordingsScreen() {
// //   const { recordings, loading, error, permissionDenied, refresh } = useCallRecordings();

// //   if (loading) {
// //     return <LoadingIndicator message="Scanning for call recordings..." />;
// //   }

// //   if (permissionDenied) {
// //     return (
// //       <EmptyState
// //         title="Permission required"
// //         description="Storage access is needed to find call recording files. Please grant the permission to continue."
// //         actionLabel="Grant Permission"
// //         onAction={refresh}
// //       />
// //     );
// //   }

// //   if (error) {
// //     return (
// //       <EmptyState title="Something went wrong" description={error} actionLabel="Retry" onAction={refresh} />
// //     );
// //   }

// //   if (recordings.length === 0) {
// //     return (
// //       <EmptyState
// //         title="No recordings found"
// //         description="No call recording files were found in common recording folders on this device."
// //         actionLabel="Rescan"
// //         onAction={refresh}
// //       />
// //     );
// //   }

// //   return (
// //     <View style={styles.container}>
// //       <FlatList
// //         data={recordings}
// //         keyExtractor={(item: CallRecordingFile) => item.id}
// //         renderItem={({ item }) => <RecordingItem recording={item} />}
// //         contentContainerStyle={styles.listContent}
// //         refreshControl={
// //           <RefreshControl refreshing={false} onRefresh={refresh} colors={[COLORS.primary]} />
// //         }
// //         initialNumToRender={20}
// //         windowSize={10}
// //       />
// //     </View>
// //   );
// // }

// // const styles = StyleSheet.create({
// //   container: { flex: 1, backgroundColor: COLORS.background },
// //   listContent: { paddingVertical: 10 },
// // });


// /**
//  * CallRecordingsScreen.tsx
//  * CHANGE: shows "Open Settings" when storage/all-files-access is
//  * permanently denied (this is the normal, expected path on API 30+ since
//  * MANAGE_EXTERNAL_STORAGE can never be granted via a popup at all).
//  */
// import React from 'react';
// import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
// import { useCallRecordings } from '../hooks/useCallRecordings';
// import RecordingItem from '../components/RecordingItem';
// import LoadingIndicator from '../components/LoadingIndicator';
// import EmptyState from '../components/EmptyState';
// import { COLORS } from '../utils/constants';
// import { CallRecordingFile } from '../types/Recording.types';
// import { PermissionManager } from '../permissions/PermissionManager';

// export default function CallRecordingsScreen() {
//   const { recordings, loading, error, permissionDenied, permanentlyDenied, refresh } = useCallRecordings();

//   if (loading) {
//     return <LoadingIndicator message="Scanning for call recordings..." />;
//   }

//   if (permissionDenied) {
//     return (
//       <EmptyState
//         title="Permission required"
//         description={
//           permanentlyDenied
//             ? "This app needs 'All files access' to read call recording folders, which can only be turned on from Settings. Tap below, enable 'Allow access to manage all files', then come back and tap Rescan."
//             : 'Storage access is needed to find call recording files. Please grant the permission to continue.'
//         }
//         actionLabel={permanentlyDenied ? 'Open Settings' : 'Grant Permission'}
//         onAction={async () => {
//           if (permanentlyDenied) {
//             await PermissionManager.openManageStorageSettings();
//           } else {
//             await refresh();
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

//   if (recordings.length === 0) {
//     return (
//       <EmptyState
//         title="No recordings found"
//         description="No audio files were found in known recording folders. If you're on an emulator, add test files via adb, or use a physical device that has actually recorded calls."
//         actionLabel="Rescan"
//         onAction={refresh}
//       />
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <FlatList
//         data={recordings}
//         keyExtractor={(item: CallRecordingFile) => item.id}
//         renderItem={({ item }) => <RecordingItem recording={item} />}
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
 * CallRecordingsScreen.tsx
 * ADDED (existing loading/permission/error/empty states unchanged): an
 * upload FAB that opens UploadOptionsModal, letting the user push
 * Today / All / Custom-range recordings (audio + metadata) to the CRM
 * backend via ApiService.
 */
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useCallRecordings } from '../hooks/useCallRecordings';
import RecordingItem from '../components/RecordingItem';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import UploadFab from '../components/UploadFab';
import UploadOptionsModal from '../components/UploadOptionsModal';
import { COLORS } from '../utils/constants';
import { CallRecordingFile } from '../types/Recording.types';
import { PermissionManager } from '../permissions/PermissionManager';
import { useUploadFlow } from '../hooks/useUploadFlow';
import { ApiService } from '../services/ApiService';

export default function CallRecordingsScreen() {
  const { recordings, loading, error, permissionDenied, permanentlyDenied, refresh } = useCallRecordings();

  const upload = useUploadFlow<CallRecordingFile>({
    items: recordings,
    getTimestamp: file => file.createdDate,
    uploadFn: ApiService.uploadRecordings.bind(ApiService),
  });

  if (loading) {
    return <LoadingIndicator message="Scanning for call recordings..." />;
  }

  if (permissionDenied) {
    return (
      <EmptyState
        title="Permission required"
        description={
          permanentlyDenied
            ? "This app needs 'All files access' to read call recording folders, which can only be turned on from Settings. Tap below, enable 'Allow access to manage all files', then come back and tap Rescan."
            : 'Storage access is needed to find call recording files. Please grant the permission to continue.'
        }
        actionLabel={permanentlyDenied ? 'Open Settings' : 'Grant Permission'}
        onAction={async () => {
          if (permanentlyDenied) {
            await PermissionManager.openManageStorageSettings();
          } else {
            await refresh();
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

  if (recordings.length === 0) {
    return (
      <EmptyState
        title="No recordings found"
        description="No audio files were found in known recording folders. If you're on an emulator, add test files via adb, or use a physical device that has actually recorded calls."
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
        renderItem={({ item }) => <RecordingItem recording={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} colors={[COLORS.primary]} />
        }
        initialNumToRender={20}
        windowSize={10}
      />

      <UploadFab onPress={upload.openModal} />

      <UploadOptionsModal
        visible={upload.modalVisible}
        uploading={upload.uploading}
        progress={upload.progress}
        onClose={upload.closeModal}
        onConfirm={upload.confirmUpload}
        title="Upload Recordings"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingVertical: 10, paddingBottom: 90 }, // extra bottom space so FAB doesn't cover last row
});