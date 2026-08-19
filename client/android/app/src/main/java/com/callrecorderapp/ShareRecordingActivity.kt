package com.callrecorderapp

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.MimeTypeMap
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class ShareRecordingActivity : Activity() {

    companion object {
        private const val TAG = "SharedRecording"

        private const val CACHE_FOLDER =
            "shared_recordings"

        private const val MAX_CACHE_AGE_MS =
            24L * 60L * 60L * 1000L

        /**
         * Used only to reject obviously invalid timestamps.
         */
        private val MIN_REASONABLE_TIMESTAMP =
            SimpleDateFormat(
                "yyyy-MM-dd",
                Locale.US
            ).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.parse("2000-01-01")?.time ?: 946684800000L
    }

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {
        super.onCreate(savedInstanceState)

        showLoadingView()

        if (intent?.action != Intent.ACTION_SEND) {
            finishWithError(
                "No shared recording was received."
            )
            return
        }

        val sharedUri =
            getSharedUri(intent)

        if (sharedUri == null) {
            finishWithError(
                "The shared recording could not be opened."
            )
            return
        }

        val suppliedMimeType =
            intent.type

        val mimeType =
            suppliedMimeType
                ?: contentResolver.getType(sharedUri)
                ?: ""

        if (
            mimeType.isNotBlank() &&
            !mimeType.startsWith("audio/")
        ) {
            finishWithError(
                "Only audio recordings can be imported."
            )
            return
        }

        Thread {
            try {
                cleanupOldTemporaryFiles()

                val sharedRecording =
                    prepareSharedRecording(
                        sharedUri,
                        mimeType
                    )

                runOnUiThread {
                    openReactNativeApp(
                        sharedRecording
                    )
                }

            } catch (error: Exception) {

                Log.e(
                    TAG,
                    "Shared recording import failed",
                    error
                )

                runOnUiThread {
                    finishWithError(
                        error.message
                            ?: "Unable to import recording."
                    )
                }
            }
        }.start()
    }

    private fun getSharedUri(
        incomingIntent: Intent
    ): Uri? {

        val streamUri: Uri? =
            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.TIRAMISU
            ) {

                incomingIntent.getParcelableExtra(
                    Intent.EXTRA_STREAM,
                    Uri::class.java
                )

            } else {

                @Suppress("DEPRECATION")
                incomingIntent.getParcelableExtra(
                    Intent.EXTRA_STREAM
                )
            }

        if (streamUri != null) {
            return streamUri
        }

        val clipData =
            incomingIntent.clipData

        if (
            clipData != null &&
            clipData.itemCount > 0
        ) {
            return clipData
                .getItemAt(0)
                .uri
        }

        return null
    }

    /**
     * Main shared-recording preparation.
     *
     * IMPORTANT:
     * Timestamp metadata is resolved BEFORE copying the file.
     */
    private fun prepareSharedRecording(
        sourceUri: Uri,
        suppliedMimeType: String
    ): SharedRecording {

        /**
         * 1. Read everything exposed by the original provider.
         */
        val providerMetadata =
            readProviderMetadata(
                sourceUri
            )

        val mimeType =
            suppliedMimeType.ifBlank {
                contentResolver
                    .getType(sourceUri)
                    ?: "application/octet-stream"
            }

        val extension =
            determineExtension(
                providerMetadata.displayName,
                mimeType
            )

        val originalFileName =
            buildOriginalFileName(
                providerMetadata.displayName,
                extension
            )

        /**
         * 2. Resolve original recording time.
         *
         * This happens while we still have the original content:// URI.
         */
        val resolvedTime =
            resolveRecordingTime(
                sourceUri = sourceUri,
                providerMetadata =
                    providerMetadata,
                fileName =
                    originalFileName
            )

        Log.i(
            TAG,
            "Recording timestamp = " +
                "${Date(resolvedTime.timestamp)} " +
                "source=${resolvedTime.source}"
        )

        /**
         * 3. Copy audio into temporary app cache.
         */
        val cacheDirectory =
            File(
                cacheDir,
                CACHE_FOLDER
            )

        if (!cacheDirectory.exists()) {
            if (!cacheDirectory.mkdirs()) {
                throw IllegalStateException(
                    "Could not create temporary recording folder."
                )
            }
        }

        val temporaryFileName =
            "${System.currentTimeMillis()}_" +
                "${UUID.randomUUID()}_" +
                originalFileName

        val destinationFile =
            File(
                cacheDirectory,
                temporaryFileName
            )

        val inputStream =
            contentResolver
                .openInputStream(
                    sourceUri
                )
                ?: throw IllegalStateException(
                    "Unable to read shared recording."
                )

        inputStream.use { input ->

            FileOutputStream(
                destinationFile
            ).use { output ->

                input.copyTo(
                    output,
                    64 * 1024
                )
            }
        }

        if (
            !destinationFile.exists() ||
            destinationFile.length() <= 0
        ) {
            destinationFile.delete()

            throw IllegalStateException(
                "Shared recording is empty."
            )
        }

        /**
         * Give our cached copy the resolved recording timestamp.
         *
         * This makes RNFS mtime useful as well.
         */
        try {
            destinationFile.setLastModified(
                resolvedTime.timestamp
            )
        } catch (error: Exception) {

            Log.w(
                TAG,
                "Could not preserve recording timestamp",
                error
            )
        }

        return SharedRecording(
            importId =
                UUID.randomUUID()
                    .toString(),

            filePath =
                destinationFile.absolutePath,

            fileName =
                originalFileName,

            fileSize =
                destinationFile.length(),

            recordingTime =
                resolvedTime.timestamp,

            extension =
                extension,

            mimeType =
                mimeType
        )
    }

    // ============================================================
    // TIMESTAMP RESOLUTION
    // ============================================================

    /**
     * Timestamp priority:
     *
     * 1. Provider creation/original date
     * 2. Embedded audio metadata date
     * 3. MediaStore DATE_TAKEN
     * 4. MediaStore DATE_ADDED
     * 5. Provider LAST_MODIFIED / DATE_MODIFIED
     * 6. Timestamp from filename
     * 7. Current time
     */
    private fun resolveRecordingTime(
        sourceUri: Uri,
        providerMetadata: ProviderMetadata,
        fileName: String
    ): ResolvedRecordingTime {

        /**
         * --------------------------------------------------------
         * 1. Explicit provider creation/original timestamp
         * --------------------------------------------------------
         */
        providerMetadata.creationTime
            ?.takeIf {
                isReasonableTimestamp(it)
            }
            ?.let {

                return ResolvedRecordingTime(
                    timestamp = it,
                    source =
                        "PROVIDER_CREATION"
                )
            }

        /**
         * --------------------------------------------------------
         * 2. Embedded audio metadata
         * --------------------------------------------------------
         */
        readEmbeddedMediaDate(
            sourceUri
        )
            ?.takeIf {
                isReasonableTimestamp(it)
            }
            ?.let {

                return ResolvedRecordingTime(
                    timestamp = it,
                    source =
                        "EMBEDDED_MEDIA_DATE"
                )
            }

        /**
         * --------------------------------------------------------
         * 3A. MediaStore DATE_TAKEN
         * --------------------------------------------------------
         */
        providerMetadata.dateTaken
            ?.takeIf {
                isReasonableTimestamp(it)
            }
            ?.let {

                return ResolvedRecordingTime(
                    timestamp = it,
                    source =
                        "MEDIASTORE_DATE_TAKEN"
                )
            }

        /**
         * --------------------------------------------------------
         * 3B. MediaStore DATE_ADDED
         * --------------------------------------------------------
         */
        providerMetadata.dateAdded
            ?.takeIf {
                isReasonableTimestamp(it)
            }
            ?.let {

                return ResolvedRecordingTime(
                    timestamp = it,
                    source =
                        "MEDIASTORE_DATE_ADDED"
                )
            }

        /**
         * --------------------------------------------------------
         * 4. Last modified
         * --------------------------------------------------------
         */
        providerMetadata.lastModified
            ?.takeIf {
                isReasonableTimestamp(it)
            }
            ?.let {

                return ResolvedRecordingTime(
                    timestamp = it,
                    source =
                        "PROVIDER_LAST_MODIFIED"
                )
            }

        /**
         * --------------------------------------------------------
         * 5. Filename timestamp
         *
         * Supports:
         * 13 digits -> milliseconds
         * 10 digits -> seconds
         *
         * Only used when the converted timestamp represents a
         * reasonable real-world date.
         * --------------------------------------------------------
         */
        extractTimestampFromFileName(
            fileName
        )
            ?.takeIf {
                isReasonableTimestamp(it)
            }
            ?.let {

                return ResolvedRecordingTime(
                    timestamp = it,
                    source =
                        "FILENAME_TIMESTAMP"
                )
            }

        /**
         * --------------------------------------------------------
         * 6. FINAL FALLBACK
         *
         * As requested, if absolutely nothing else exists,
         * use current time.
         * --------------------------------------------------------
         */
        return ResolvedRecordingTime(
            timestamp =
                System.currentTimeMillis(),

            source =
                "CURRENT_TIME_FALLBACK"
        )
    }

    // ============================================================
    // PROVIDER METADATA
    // ============================================================

    private fun readProviderMetadata(
        uri: Uri
    ): ProviderMetadata {

        var displayName: String? =
            null

        var fileSize: Long =
            0L

        var creationTime: Long? =
            null

        var dateTaken: Long? =
            null

        var dateAdded: Long? =
            null

        var lastModified: Long? =
            null

        var cursor: Cursor? =
            null

        try {

            cursor =
                contentResolver.query(
                    uri,
                    null,
                    null,
                    null,
                    null
                )

            if (
                cursor == null ||
                !cursor.moveToFirst()
            ) {
                return ProviderMetadata(
                    displayName = null,
                    fileSize = 0,
                    creationTime = null,
                    dateTaken = null,
                    dateAdded = null,
                    lastModified = null
                )
            }

            /**
             * Log every provider column during development.
             *
             * Useful for Google Phone, Samsung, Xiaomi, etc.
             */
            logProviderColumns(
                cursor
            )

            displayName =
                readStringColumn(
                    cursor,
                    listOf(
                        OpenableColumns
                            .DISPLAY_NAME
                    )
                )

            fileSize =
                readRawLongColumn(
                    cursor,
                    listOf(
                        OpenableColumns.SIZE
                    )
                ) ?: 0L

            /**
             * There is no universal ContentProvider creation-time
             * column, so check common provider/OEM names.
             *
             * "inferred_date" is also available on newer MediaStore
             * versions as an approximate creation date.
             */
            creationTime =
                readTimestampColumn(
                    cursor,
                    listOf(
                        "date_created",
                        "creation_time",
                        "creation_date",
                        "date_creation",
                        "created_at",
                        "original_date",
                        "original_time",
                        "date_original",
                        "inferred_date"
                    )
                )

            /**
             * MediaStore DATE_TAKEN.
             *
             * Standard value is milliseconds.
             */
            dateTaken =
                readTimestampColumn(
                    cursor,
                    listOf(
                        "datetaken",
                        "date_taken"
                    )
                )

            /**
             * MediaStore DATE_ADDED is normally seconds.
             * normalizeTimestampValue() automatically handles
             * seconds vs milliseconds.
             */
            dateAdded =
                readTimestampColumn(
                    cursor,
                    listOf(
                        "date_added"
                    )
                )

            /**
             * DocumentsProvider commonly exposes last_modified.
             * MediaStore commonly exposes date_modified.
             */
            lastModified =
                readTimestampColumn(
                    cursor,
                    listOf(
                        "last_modified",
                        "date_modified",
                        "modified",
                        "modified_at"
                    )
                )

        } catch (error: Exception) {

            Log.w(
                TAG,
                "Could not read provider metadata",
                error
            )

        } finally {
            cursor?.close()
        }

        return ProviderMetadata(
            displayName =
                displayName,

            fileSize =
                fileSize,

            creationTime =
                creationTime,

            dateTaken =
                dateTaken,

            dateAdded =
                dateAdded,

            lastModified =
                lastModified
        )
    }

    /**
     * Logs every column returned by the sharing ContentProvider.
     *
     * Keep this while testing different phones.
     *
     * Example:
     *
     * _display_name = record-123.wav
     * _size = 2100000
     * date_modified = ...
     */
    private fun logProviderColumns(
        cursor: Cursor
    ) {

        try {

            Log.i(
                TAG,
                "========== SHARED URI METADATA =========="
            )

            cursor.columnNames
                .forEachIndexed {
                    index,
                    columnName ->

                    val value =
                        try {
                            if (
                                cursor.isNull(index)
                            ) {
                                "NULL"
                            } else {
                                cursor.getString(
                                    index
                                )
                            }
                        } catch (_: Exception) {
                            "<unreadable>"
                        }

                    Log.i(
                        TAG,
                        "$columnName = $value"
                    )
                }

            Log.i(
                TAG,
                "========================================="
            )

        } catch (error: Exception) {

            Log.w(
                TAG,
                "Could not log provider metadata",
                error
            )
        }
    }

    private fun readStringColumn(
        cursor: Cursor,
        possibleNames: List<String>
    ): String? {

        val index =
            findColumnIndex(
                cursor,
                possibleNames
            )

        if (
            index < 0 ||
            cursor.isNull(index)
        ) {
            return null
        }

        return try {

            cursor.getString(index)
                ?.trim()
                ?.takeIf {
                    it.isNotBlank()
                }

        } catch (_: Exception) {
            null
        }
    }

    private fun readRawLongColumn(
        cursor: Cursor,
        possibleNames: List<String>
    ): Long? {

        val index =
            findColumnIndex(
                cursor,
                possibleNames
            )

        if (
            index < 0 ||
            cursor.isNull(index)
        ) {
            return null
        }

        return try {

            when (
                cursor.getType(index)
            ) {
                Cursor.FIELD_TYPE_INTEGER ->
                    cursor.getLong(index)

                Cursor.FIELD_TYPE_FLOAT ->
                    cursor.getDouble(index)
                        .toLong()

                Cursor.FIELD_TYPE_STRING ->
                    cursor.getString(index)
                        ?.trim()
                        ?.toLongOrNull()

                else ->
                    null
            }

        } catch (_: Exception) {
            null
        }
    }

    /**
     * Reads either numeric epoch values or textual dates.
     */
    private fun readTimestampColumn(
        cursor: Cursor,
        possibleNames: List<String>
    ): Long? {

        val index =
            findColumnIndex(
                cursor,
                possibleNames
            )

        if (
            index < 0 ||
            cursor.isNull(index)
        ) {
            return null
        }

        return try {

            when (
                cursor.getType(index)
            ) {

                Cursor.FIELD_TYPE_INTEGER -> {

                    normalizeTimestampValue(
                        cursor.getLong(index)
                    )
                }

                Cursor.FIELD_TYPE_FLOAT -> {

                    normalizeTimestampValue(
                        cursor
                            .getDouble(index)
                            .toLong()
                    )
                }

                Cursor.FIELD_TYPE_STRING -> {

                    val raw =
                        cursor
                            .getString(index)
                            ?.trim()
                            ?: return null

                    /**
                     * Numeric timestamp?
                     */
                    raw.toLongOrNull()
                        ?.let {
                            normalizeTimestampValue(
                                it
                            )
                        }
                        ?: parseDateString(
                            raw
                        )
                }

                else ->
                    null
            }

        } catch (_: Exception) {
            null
        }
    }

    private fun findColumnIndex(
        cursor: Cursor,
        possibleNames: List<String>
    ): Int {

        val actualColumns =
            cursor.columnNames

        for (
            possibleName in possibleNames
        ) {

            actualColumns
                .forEachIndexed {
                    index,
                    actualName ->

                    if (
                        actualName.equals(
                            possibleName,
                            ignoreCase = true
                        )
                    ) {
                        return index
                    }
                }
        }

        return -1
    }

    // ============================================================
    // EMBEDDED AUDIO METADATA
    // ============================================================

    private fun readEmbeddedMediaDate(
        uri: Uri
    ): Long? {

        val retriever =
            MediaMetadataRetriever()

        return try {

            retriever.setDataSource(
                this,
                uri
            )

            val mediaDate =
                retriever.extractMetadata(
                    MediaMetadataRetriever
                        .METADATA_KEY_DATE
                )

            val duration =
                retriever.extractMetadata(
                    MediaMetadataRetriever
                        .METADATA_KEY_DURATION
                )

            val title =
                retriever.extractMetadata(
                    MediaMetadataRetriever
                        .METADATA_KEY_TITLE
                )

            val artist =
                retriever.extractMetadata(
                    MediaMetadataRetriever
                        .METADATA_KEY_ARTIST
                )

            val author =
                retriever.extractMetadata(
                    MediaMetadataRetriever
                        .METADATA_KEY_AUTHOR
                )

            val bitrate =
                retriever.extractMetadata(
                    MediaMetadataRetriever
                        .METADATA_KEY_BITRATE
                )

            Log.i(
                TAG,
                "========== EMBEDDED AUDIO METADATA =========="
            )

            Log.i(
                TAG,
                "date=$mediaDate"
            )

            Log.i(
                TAG,
                "duration=$duration"
            )

            Log.i(
                TAG,
                "title=$title"
            )

            Log.i(
                TAG,
                "artist=$artist"
            )

            Log.i(
                TAG,
                "author=$author"
            )

            Log.i(
                TAG,
                "bitrate=$bitrate"
            )

            Log.i(
                TAG,
                "============================================="
            )

            if (
                mediaDate.isNullOrBlank()
            ) {
                null
            } else {

                /**
                 * It could theoretically be numeric.
                 */
                mediaDate
                    .trim()
                    .toLongOrNull()
                    ?.let {
                        normalizeTimestampValue(
                            it
                        )
                    }
                    ?: parseDateString(
                        mediaDate
                    )
            }

        } catch (error: Exception) {

            Log.w(
                TAG,
                "Could not read embedded media date",
                error
            )

            null

        } finally {

            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Supports several common date representations found
     * inside media containers.
     */
    private fun parseDateString(
        rawValue: String
    ): Long? {

        val value =
            rawValue.trim()

        if (value.isBlank()) {
            return null
        }

        val formats =
            listOf(
                DatePattern(
                    "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                    false
                ),

                DatePattern(
                    "yyyy-MM-dd'T'HH:mm:ssXXX",
                    false
                ),

                DatePattern(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                    true
                ),

                DatePattern(
                    "yyyy-MM-dd'T'HH:mm:ss'Z'",
                    true
                ),

                DatePattern(
                    "yyyyMMdd'T'HHmmss.SSS'Z'",
                    true
                ),

                DatePattern(
                    "yyyyMMdd'T'HHmmss'Z'",
                    true
                ),

                DatePattern(
                    "yyyyMMdd'T'HHmmss.SSSZ",
                    false
                ),

                DatePattern(
                    "yyyyMMdd'T'HHmmssZ",
                    false
                ),

                DatePattern(
                    "yyyy-MM-dd HH:mm:ss",
                    false
                ),

                DatePattern(
                    "yyyyMMdd_HHmmss",
                    false
                )
            )

        for (
            item in formats
        ) {

            try {

                val formatter =
                    SimpleDateFormat(
                        item.pattern,
                        Locale.US
                    ).apply {

                        isLenient =
                            false

                        if (
                            item.forceUtc
                        ) {
                            timeZone =
                                TimeZone
                                    .getTimeZone(
                                        "UTC"
                                    )
                        }
                    }

                val parsed =
                    formatter.parse(
                        value
                    )?.time

                if (
                    parsed != null &&
                    isReasonableTimestamp(
                        parsed
                    )
                ) {
                    return parsed
                }

            } catch (_: Exception) {
                // Try next format.
            }
        }

        return null
    }

    // ============================================================
    // FILENAME TIMESTAMP FALLBACK
    // ============================================================

    private fun extractTimestampFromFileName(
        fileName: String
    ): Long? {

        /**
         * First look for 13-digit millisecond epoch values.
         *
         * Example:
         * record-1786632609106.wav
         */
        val millisecondsRegex =
            Regex(
                "(?<!\\d)(\\d{13})(?!\\d)"
            )

        millisecondsRegex
            .findAll(fileName)
            .forEach {

                val value =
                    it.groupValues
                        .getOrNull(1)
                        ?.toLongOrNull()

                val normalized =
                    value?.let {
                        timestamp ->
                        normalizeTimestampValue(
                            timestamp
                        )
                    }

                if (
                    normalized != null &&
                    isReasonableTimestamp(
                        normalized
                    )
                ) {

                    Log.i(
                        TAG,
                        "Timestamp found in filename: $normalized"
                    )

                    return normalized
                }
            }

        /**
         * Also support 10-digit Unix seconds.
         */
        val secondsRegex =
            Regex(
                "(?<!\\d)(\\d{10})(?!\\d)"
            )

        secondsRegex
            .findAll(fileName)
            .forEach {

                val value =
                    it.groupValues
                        .getOrNull(1)
                        ?.toLongOrNull()

                val normalized =
                    value?.let {
                        timestamp ->
                        normalizeTimestampValue(
                            timestamp
                        )
                    }

                if (
                    normalized != null &&
                    isReasonableTimestamp(
                        normalized
                    )
                ) {

                    Log.i(
                        TAG,
                        "Unix timestamp found in filename: $normalized"
                    )

                    return normalized
                }
            }

        return null
    }

    /**
     * Automatically handles:
     *
     * seconds:
     * 1786632609
     *
     * milliseconds:
     * 1786632609000
     *
     * microseconds:
     * 1786632609000000
     */
    private fun normalizeTimestampValue(
        rawValue: Long
    ): Long? {

        if (rawValue <= 0) {
            return null
        }

        val normalized =
            when {

                rawValue <
                    10_000_000_000L -> {

                    /**
                     * Unix seconds.
                     */
                    rawValue * 1000L
                }

                rawValue <
                    10_000_000_000_000L -> {

                    /**
                     * Unix milliseconds.
                     */
                    rawValue
                }

                rawValue <
                    10_000_000_000_000_000L -> {

                    /**
                     * Unix microseconds.
                     */
                    rawValue / 1000L
                }

                else -> {

                    /**
                     * Possibly nanoseconds.
                     */
                    rawValue / 1_000_000L
                }
            }

        return normalized
            .takeIf {
                isReasonableTimestamp(
                    it
                )
            }
    }

    private fun isReasonableTimestamp(
        timestamp: Long
    ): Boolean {

        val maximumFutureTime =
            System.currentTimeMillis() +
                (7L * 24L * 60L * 60L * 1000L)

        return (
            timestamp >=
                MIN_REASONABLE_TIMESTAMP &&
                timestamp <=
                maximumFutureTime
            )
    }

    // ============================================================
    // FILE HELPERS
    // ============================================================

    private fun determineExtension(
        displayName: String?,
        mimeType: String
    ): String {

        if (
            !displayName.isNullOrBlank()
        ) {

            val name =
                displayName.trim()

            val dotIndex =
                name.lastIndexOf('.')

            if (
                dotIndex >= 0 &&
                dotIndex <
                name.length - 1
            ) {
                return name
                    .substring(
                        dotIndex + 1
                    )
                    .lowercase()
            }
        }

        val mimeExtension =
            MimeTypeMap
                .getSingleton()
                .getExtensionFromMimeType(
                    mimeType
                )

        if (
            !mimeExtension.isNullOrBlank()
        ) {
            return mimeExtension
                .lowercase()
        }

        return "wav"
    }

    private fun buildOriginalFileName(
        displayName: String?,
        extension: String
    ): String {

        val rawName =
            displayName
                ?.trim()
                ?.takeIf {
                    it.isNotBlank()
                }

        if (rawName == null) {

            return (
                "shared-recording-" +
                    "${System.currentTimeMillis()}." +
                    extension
                )
        }

        var safeName =
            File(rawName).name

        safeName =
            safeName
                .replace(
                    "\\",
                    "_"
                )
                .replace(
                    "/",
                    "_"
                )
                .replace(
                    "\n",
                    "_"
                )
                .replace(
                    "\r",
                    "_"
                )
                .replace(
                    "\u0000",
                    "_"
                )
                .trim()

        if (safeName.isBlank()) {

            safeName =
                "shared-recording-" +
                    "${System.currentTimeMillis()}." +
                    extension
        }

        if (
            !safeName.contains('.')
        ) {
            safeName +=
                ".$extension"
        }

        return safeName
    }

    // ============================================================
    // OPEN REACT NATIVE SCREEN
    // ============================================================

    private fun openReactNativeApp(
        recording: SharedRecording
    ) {

        val deepLink =
            Uri.Builder()
                .scheme(
                    "callmanager"
                )
                .authority(
                    "shared-recording"
                )
                .appendQueryParameter(
                    "importId",
                    recording.importId
                )
                .appendQueryParameter(
                    "filePath",
                    recording.filePath
                )
                .appendQueryParameter(
                    "fileName",
                    recording.fileName
                )
                .appendQueryParameter(
                    "fileSize",
                    recording.fileSize
                        .toString()
                )
                .appendQueryParameter(
                    "recordingTime",
                    recording.recordingTime
                        .toString()
                )
                .appendQueryParameter(
                    "extension",
                    recording.extension
                )
                .appendQueryParameter(
                    "mimeType",
                    recording.mimeType
                )
                .build()

        val mainIntent =
            Intent(
                this,
                MainActivity::class.java
            ).apply {

                action =
                    Intent.ACTION_VIEW

                data =
                    deepLink

                addFlags(
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }

        startActivity(
            mainIntent
        )

        finish()
    }

    // ============================================================
    // TEMPORARY FILE CLEANUP
    // ============================================================

    private fun cleanupOldTemporaryFiles() {

        val directory =
            File(
                cacheDir,
                CACHE_FOLDER
            )

        if (!directory.exists()) {
            return
        }

        val now =
            System.currentTimeMillis()

        directory
            .listFiles()
            ?.forEach { file ->

                try {

                    if (
                        file.isFile &&
                        now -
                        file.lastModified() >
                        MAX_CACHE_AGE_MS
                    ) {
                        file.delete()
                    }

                } catch (_: Exception) {
                }
            }
    }

    // ============================================================
    // SIMPLE LOADING UI
    // ============================================================

    private fun showLoadingView() {

        val root =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams
                            .MATCH_PARENT,

                        ViewGroup.LayoutParams
                            .MATCH_PARENT
                    )

                setPadding(
                    40,
                    40,
                    40,
                    40
                )
            }

        val progressBar =
            ProgressBar(this)

        val text =
            TextView(this).apply {

                this.text =
                    "Preparing recording..."

                textSize =
                    16f

                gravity =
                    Gravity.CENTER

                setPadding(
                    0,
                    24,
                    0,
                    0
                )
            }

        root.addView(
            progressBar
        )

        root.addView(
            text
        )

        setContentView(
            root
        )
    }

    private fun finishWithError(
        message: String
    ) {

        Toast
            .makeText(
                this,
                message,
                Toast.LENGTH_LONG
            )
            .show()

        finish()
    }

    // ============================================================
    // MODELS
    // ============================================================

    private data class ProviderMetadata(
        val displayName: String?,
        val fileSize: Long,

        val creationTime: Long?,
        val dateTaken: Long?,
        val dateAdded: Long?,
        val lastModified: Long?
    )

    private data class ResolvedRecordingTime(
        val timestamp: Long,
        val source: String
    )

    private data class SharedRecording(
        val importId: String,

        val filePath: String,
        val fileName: String,

        val fileSize: Long,
        val recordingTime: Long,

        val extension: String,
        val mimeType: String
    )

    private data class DatePattern(
        val pattern: String,
        val forceUtc: Boolean
    )
}