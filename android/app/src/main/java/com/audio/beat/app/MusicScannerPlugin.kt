package com.audio.beat.app

import android.Manifest
import android.content.ContentUris
import android.os.Build
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

@CapacitorPlugin(
    name = "MusicScanner",
    permissions = [
        Permission(
            alias = "audioMedia",
            strings = [Manifest.permission.READ_MEDIA_AUDIO]
        ),
        Permission(
            alias = "legacyStorage",
            strings = [Manifest.permission.READ_EXTERNAL_STORAGE]
        ),
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class MusicScannerPlugin : Plugin() {

    companion object {
        private const val TAG = "MusicScanner"
        private const val ARTWORK_DIRECTORY_NAME = "album_art"

        private val MEDIASTORE_ALBUM_ART_URI: Uri =
            Uri.parse("content://media/external/audio/albumart")
    }

    @PluginMethod
    fun scanMusic(call: PluginCall) {
        if (!hasMusicPermission()) {
            requestMusicPermission(call)
            return
        }

        requestNotificationPermissionThenScan(call)
    }

    private fun hasMusicPermission(): Boolean {
        return if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.TIRAMISU
        ) {
            getPermissionState("audioMedia") ==
                    PermissionState.GRANTED
        } else {
            getPermissionState("legacyStorage") ==
                    PermissionState.GRANTED
        }
    }

    private fun requestMusicPermission(
        call: PluginCall
    ) {
        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.TIRAMISU
        ) {
            requestPermissionForAlias(
                "audioMedia",
                call,
                "musicPermissionCallback"
            )
        } else {
            requestPermissionForAlias(
                "legacyStorage",
                call,
                "musicPermissionCallback"
            )
        }
    }

    @PermissionCallback
    private fun musicPermissionCallback(
        call: PluginCall
    ) {
        if (!hasMusicPermission()) {
            call.reject(
                "Music & audio permission is required to scan device songs."
            )
            return
        }

        requestNotificationPermissionThenScan(call)
    }

    private fun requestNotificationPermissionThenScan(
        call: PluginCall
    ) {
        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") !=
            PermissionState.GRANTED
        ) {
            requestPermissionForAlias(
                "notifications",
                call,
                "notificationPermissionCallback"
            )
            return
        }

        performMusicScan(call)
    }

    @PermissionCallback
    private fun notificationPermissionCallback(
        call: PluginCall
    ) {
        /*
         * Notification permission is optional for scanning music.
         * Continue the scan whether the user grants or denies it.
         */
        performMusicScan(call)
    }

    private fun performMusicScan(
        call: PluginCall
    ) {
        Thread {
            try {
                val songs = scanDeviceMusic()

                val result = JSObject()
                result.put("songs", songs)

                call.resolve(result)
            } catch (exception: Exception) {
                Log.e(
                    TAG,
                    "Unable to scan device music",
                    exception
                )

                call.reject(
                    "Unable to scan device music",
                    exception
                )
            }
        }.start()
    }

    private fun scanDeviceMusic(): JSArray {
        val songs = JSArray()

        val collection =
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATE_MODIFIED
        )

        val selection =
            "${MediaStore.Audio.Media.IS_MUSIC} != 0"

        val sortOrder =
            "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"

        context.contentResolver.query(
            collection,
            projection,
            selection,
            null,
            sortOrder
        )?.use { cursor ->

            val idColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media._ID
                )

            val titleColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.TITLE
                )

            val artistColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.ARTIST
                )

            val albumColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.ALBUM
                )

            val albumIdColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.ALBUM_ID
                )

            val durationColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.DURATION
                )

            val dateModifiedColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.DATE_MODIFIED
                )

            while (cursor.moveToNext()) {
                try {
                    val mediaId =
                        cursor.getLong(idColumn)

                    val albumId =
                        cursor.getLong(albumIdColumn)

                    val dateModified =
                        cursor.getLong(dateModifiedColumn)

                    val durationMilliseconds =
                        cursor.getLong(durationColumn)

                    val contentUri =
                        ContentUris.withAppendedId(
                            collection,
                            mediaId
                        )

                    val title =
                        normalizeMetadata(
                            cursor.getString(titleColumn),
                            "Unknown title"
                        )

                    val artist =
                        normalizeMetadata(
                            cursor.getString(artistColumn),
                            "Unknown artist"
                        )

                    val album =
                        normalizeMetadata(
                            cursor.getString(albumColumn),
                            "Unknown album"
                        )

                    val artworkResult =
                        resolveArtwork(
                            mediaId = mediaId,
                            albumId = albumId,
                            dateModified = dateModified,
                            audioUri = contentUri
                        )

                    val song = JSObject()

                    song.put(
                        "id",
                        mediaId.toString()
                    )

                    song.put(
                        "title",
                        title
                    )

                    song.put(
                        "artist",
                        artist
                    )

                    song.put(
                        "album",
                        album
                    )

                    song.put(
                        "uri",
                        contentUri.toString()
                    )

                    song.put(
                        "duration",
                        durationMilliseconds / 1000.0
                    )

                    song.put(
                        "albumArt",
                        artworkResult?.uri
                    )

                    /*
                     * Keep this temporarily while testing.
                     * It shows whether artwork came from the MP3,
                     * MediaStore, cache, or was not found.
                     */
                    song.put(
                        "artworkSource",
                        artworkResult?.source ?: "none"
                    )

                    Log.d(
                        TAG,
                        "Song='$title', albumId=$albumId, " +
                                "artworkSource=${artworkResult?.source ?: "none"}, " +
                                "albumArt=${artworkResult?.uri ?: "null"}"
                    )

                    songs.put(song)
                } catch (exception: Exception) {
                    Log.w(
                        TAG,
                        "Unable to process an audio item",
                        exception
                    )
                }
            }
        }

        return songs
    }

    private fun resolveArtwork(
        mediaId: Long,
        albumId: Long,
        dateModified: Long,
        audioUri: Uri
    ): ArtworkResult? {
        val artworkDirectory =
            getArtworkDirectory()
                ?: return null

        val cachedArtwork =
            findCachedArtwork(
                directory = artworkDirectory,
                mediaId = mediaId,
                dateModified = dateModified
            )

        if (cachedArtwork != null) {
            return ArtworkResult(
                uri = Uri.fromFile(cachedArtwork).toString(),
                source = "cache"
            )
        }

        removeOutdatedArtwork(
            directory = artworkDirectory,
            mediaId = mediaId
        )

        /*
         * First try the actual artwork embedded inside the audio file.
         */
        val embeddedArtwork =
            extractEmbeddedArtwork(
                mediaId = mediaId,
                dateModified = dateModified,
                audioUri = audioUri,
                directory = artworkDirectory
            )

        if (embeddedArtwork != null) {
            return ArtworkResult(
                uri = Uri.fromFile(embeddedArtwork).toString(),
                source = "embedded"
            )
        }

        /*
         * Some Android devices maintain a separate album-art provider.
         * Use it as a fallback when the file has no readable embedded art.
         */
        val mediaStoreArtwork =
            copyMediaStoreAlbumArtwork(
                mediaId = mediaId,
                albumId = albumId,
                dateModified = dateModified,
                directory = artworkDirectory
            )

        if (mediaStoreArtwork != null) {
            return ArtworkResult(
                uri = Uri.fromFile(mediaStoreArtwork).toString(),
                source = "mediastore"
            )
        }

        return null
    }

    private fun extractEmbeddedArtwork(
        mediaId: Long,
        dateModified: Long,
        audioUri: Uri,
        directory: File
    ): File? {
        val retriever =
            MediaMetadataRetriever()

        return try {
            retriever.setDataSource(
                context,
                audioUri
            )

            val artworkBytes =
                retriever.embeddedPicture

            if (
                artworkBytes == null ||
                artworkBytes.isEmpty()
            ) {
                Log.d(
                    TAG,
                    "No embedded picture for $audioUri"
                )

                return null
            }

            Log.d(
                TAG,
                "Embedded picture found for $audioUri: " +
                        "${artworkBytes.size} bytes"
            )

            val extension =
                detectImageExtension(
                    artworkBytes
                )

            val outputFile =
                createArtworkFile(
                    directory = directory,
                    mediaId = mediaId,
                    dateModified = dateModified,
                    extension = extension
                )

            FileOutputStream(outputFile).use {
                it.write(artworkBytes)
                it.flush()
            }

            validateArtworkFile(outputFile)
        } catch (exception: Exception) {
            Log.w(
                TAG,
                "Embedded artwork extraction failed for $audioUri",
                exception
            )

            null
        } finally {
            try {
                retriever.release()
            } catch (exception: Exception) {
                Log.w(
                    TAG,
                    "Unable to release MediaMetadataRetriever",
                    exception
                )
            }
        }
    }

    private fun copyMediaStoreAlbumArtwork(
        mediaId: Long,
        albumId: Long,
        dateModified: Long,
        directory: File
    ): File? {
        if (albumId <= 0L) {
            return null
        }

        val artworkUri =
            ContentUris.withAppendedId(
                MEDIASTORE_ALBUM_ART_URI,
                albumId
            )

        var inputStream: InputStream? = null

        return try {
            inputStream =
                context.contentResolver.openInputStream(
                    artworkUri
                )

            if (inputStream == null) {
                return null
            }

            /*
             * The provider may return JPEG, PNG, or another supported
             * image format. Saving as .jpg does not re-encode it; the
             * WebView detects the image using its actual file contents.
             */
            val outputFile =
                createArtworkFile(
                    directory = directory,
                    mediaId = mediaId,
                    dateModified = dateModified,
                    extension = "jpg"
                )

            FileOutputStream(outputFile).use { outputStream ->
                inputStream.copyTo(outputStream)
                outputStream.flush()
            }

            Log.d(
                TAG,
                "MediaStore artwork copied from $artworkUri"
            )

            validateArtworkFile(outputFile)
        } catch (exception: Exception) {
            Log.d(
                TAG,
                "No MediaStore artwork for albumId=$albumId: " +
                        exception.message
            )

            null
        } finally {
            try {
                inputStream?.close()
            } catch (exception: Exception) {
                Log.w(
                    TAG,
                    "Unable to close album artwork stream",
                    exception
                )
            }
        }
    }

    private fun getArtworkDirectory(): File? {
        val directory =
            File(
                context.cacheDir,
                ARTWORK_DIRECTORY_NAME
            )

        if (
            directory.exists() ||
            directory.mkdirs()
        ) {
            return directory
        }

        Log.w(
            TAG,
            "Unable to create artwork cache directory"
        )

        return null
    }

    private fun createArtworkFile(
        directory: File,
        mediaId: Long,
        dateModified: Long,
        extension: String
    ): File {
        return File(
            directory,
            "cover_${mediaId}_${dateModified}.$extension"
        )
    }

    private fun findCachedArtwork(
        directory: File,
        mediaId: Long,
        dateModified: Long
    ): File? {
        val expectedPrefix =
            "cover_${mediaId}_${dateModified}."

        return directory
            .listFiles()
            ?.firstOrNull { file ->
                file.isFile &&
                        file.name.startsWith(
                            expectedPrefix
                        ) &&
                        file.length() > 0L
            }
    }

    private fun removeOutdatedArtwork(
        directory: File,
        mediaId: Long
    ) {
        val prefix =
            "cover_${mediaId}_"

        directory
            .listFiles()
            ?.filter { file ->
                file.isFile &&
                        file.name.startsWith(prefix)
            }
            ?.forEach { file ->
                try {
                    file.delete()
                } catch (exception: Exception) {
                    Log.w(
                        TAG,
                        "Unable to remove old artwork ${file.name}",
                        exception
                    )
                }
            }
    }

    private fun validateArtworkFile(
        file: File
    ): File? {
        if (
            file.exists() &&
            file.isFile &&
            file.length() > 0L
        ) {
            Log.d(
                TAG,
                "Artwork saved: ${file.absolutePath}, " +
                        "${file.length()} bytes"
            )

            return file
        }

        try {
            file.delete()
        } catch (_: Exception) {
            // Nothing else is required here.
        }

        return null
    }

    private fun detectImageExtension(
        bytes: ByteArray
    ): String {
        if (
            bytes.size >= 8 &&
            unsigned(bytes[0]) == 0x89 &&
            unsigned(bytes[1]) == 0x50 &&
            unsigned(bytes[2]) == 0x4E &&
            unsigned(bytes[3]) == 0x47
        ) {
            return "png"
        }

        if (
            bytes.size >= 12 &&
            bytes[0].toInt().toChar() == 'R' &&
            bytes[1].toInt().toChar() == 'I' &&
            bytes[2].toInt().toChar() == 'F' &&
            bytes[3].toInt().toChar() == 'F' &&
            bytes[8].toInt().toChar() == 'W' &&
            bytes[9].toInt().toChar() == 'E' &&
            bytes[10].toInt().toChar() == 'B' &&
            bytes[11].toInt().toChar() == 'P'
        ) {
            return "webp"
        }

        if (
            bytes.size >= 3 &&
            unsigned(bytes[0]) == 0xFF &&
            unsigned(bytes[1]) == 0xD8 &&
            unsigned(bytes[2]) == 0xFF
        ) {
            return "jpg"
        }

        return "img"
    }

    private fun unsigned(
        value: Byte
    ): Int {
        return value.toInt() and 0xFF
    }

    private fun normalizeMetadata(
        value: String?,
        fallback: String
    ): String {
        val normalized =
            value
                ?.trim()
                .orEmpty()

        if (
            normalized.isBlank() ||
            normalized.equals(
                "<unknown>",
                ignoreCase = true
            )
        ) {
            return fallback
        }

        return normalized
    }

    private data class ArtworkResult(
        val uri: String,
        val source: String
    )
}