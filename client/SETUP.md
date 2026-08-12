# Setup Instructions

## 1. Install dependencies

```bash
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-call-log
npm install react-native-fs

cd android && ./gradlew clean && cd ..
```

> `react-native-call-log` and the storage scan in `RecordingService` are
> Android-only (there is no public iOS API for call logs or call-recording
> files). The code already guards every native call with `Platform.OS`
> checks so the app won't crash on iOS — those two features will simply
> return empty lists there.

## 2. Update AndroidManifest.xml

Copy the permission entries from `android-manifest-additions.xml` into
`android/app/src/main/AndroidManifest.xml`, inside the `<manifest>` tag.

## 3. Copy the `src/` folder and `App.tsx`

Drop the `src/` directory and `App.tsx` from this deliverable into your
existing project root, replacing the default `App.tsx`.

## 4. Run the app

```bash
npx react-native run-android
```

On first launch, the app will prompt for call log, contacts, and
storage/media permissions from the relevant screens.

## Folder Structure

```
src/
├── screens/            # Route-level screens (Home, CallLogs, CallRecordings)
├── components/         # Reusable presentational components
├── services/           # Business logic: CallLogService, RecordingService, CloudUploadService
├── hooks/               # Data-fetching hooks wrapping services + permissions
├── navigation/          # React Navigation stack + typed param list
├── permissions/         # Centralised Android runtime permission handling
├── types/               # Shared TypeScript interfaces/enums
├── utils/                # Formatters and constants (colors, folder paths)
└── assets/               # Images/icons (empty placeholder)
App.tsx                  # Thin root component
android-manifest-additions.xml
```

## Future Enhancements (already scaffolded)

- **Cloud / Zoho CRM upload**: `src/services/CloudUploadService.ts` defines
  `uploadCallLogs` and `uploadRecording` stubs. Implement the network calls
  there — no other file needs to change. Wire a button in
  `CallLogsScreen`/`CallRecordingsScreen` to call it when ready.
- **iOS**: All native-dependent code paths already check `Platform.OS`.
  Call logs and recording scanning will need iOS-specific alternatives
  (e.g. CallKit extensions) if that becomes a requirement — everything
  else (navigation, components, types) is already cross-platform.
