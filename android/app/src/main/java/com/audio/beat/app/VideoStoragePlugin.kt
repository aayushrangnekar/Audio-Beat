package com.audio.beat.app

import android.content.Context
import android.net.Uri
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

@CapacitorPlugin(name = "VideoStorage")
class VideoStoragePlugin : Plugin() {

    companion object {
        private const val PREF_NAME = "song_videos"

        private const val CLOUDINARY_VIDEO_CACHE_DIRECTORY =
            "cloudinary_video_cache"

        private const val CLOUDINARY_VIDEO_CACHE_SIZE_BYTES =
            200L * 1024L * 1024L

        private const val DOWNLOAD_BUFFER_SIZE =
            64 * 1024

        private const val CONNECT_TIMEOUT_MS =
            15_000

        private const val READ_TIMEOUT_MS =
            30_000
    }

    private val videoCacheLock =
        Any()

    private fun prefs() =
        context.getSharedPreferences(
            PREF_NAME,
            Context.MODE_PRIVATE
        )

    private fun isSupportedCloudinaryUrl(
        value: String
    ): Boolean {
        return value.startsWith(
            "https://res.cloudinary.com/"
        ) &&
                value.contains(
                    "/video/upload/"
                )
    }

    @PluginMethod
    fun saveVideo(call: PluginCall) {
        val songId = call.getString("songId")
        val url = call.getString("url")?.trim()

        if (songId.isNullOrBlank() || url.isNullOrBlank()) {
            call.reject("Missing songId or URL")
            return
        }

        if (!isSupportedCloudinaryUrl(url)) {
            call.reject(
                "Only secure Cloudinary video delivery URLs are supported"
            )
            return
        }

        deleteLegacyLocalFile(
            prefs().getString(songId, null)
        )

        prefs()
            .edit()
            .putString(songId, url)
            .apply()

        val result = JSObject()
        result.put("url", url)
        call.resolve(result)
    }

    @PluginMethod
    fun getVideo(call: PluginCall) {
        val songId = call.getString("songId")

        if (songId.isNullOrBlank()) {
            call.reject("Missing songId")
            return
        }

        val savedUrl =
            prefs().getString(songId, null)

        val result = JSObject()
        result.put(
            "url",
            if (
                savedUrl != null &&
                isSupportedCloudinaryUrl(savedUrl)
            ) savedUrl else null
        )

        call.resolve(result)
    }

    @PluginMethod
    fun removeVideo(call: PluginCall) {
        val songId = call.getString("songId")

        if (songId.isNullOrBlank()) {
            call.reject("Missing songId")
            return
        }

        deleteLegacyLocalFile(
            prefs().getString(songId, null)
        )

        prefs()
            .edit()
            .remove(songId)
            .apply()

        call.resolve()
    }

    @PluginMethod
    fun getAllVideos(call: PluginCall) {
        val videos = JSObject()
        val editor = prefs().edit()

        for ((songId, rawValue) in prefs().all) {
            val value = rawValue as? String ?: continue

            if (isSupportedCloudinaryUrl(value)) {
                videos.put(songId, value)
            } else {
                deleteLegacyLocalFile(value)
                editor.remove(songId)
            }
        }

        editor.apply()

        val result = JSObject()
        result.put("videos", videos)
        call.resolve(result)
    }

    @PluginMethod
    fun cacheVideo(call: PluginCall) {
        val songId =
            call.getString("songId")

        val url =
            call.getString("url")
                ?.trim()

        if (
            songId.isNullOrBlank() ||
            url.isNullOrBlank()
        ) {
            call.reject(
                "Missing songId or URL"
            )
            return
        }

        if (
            !isSupportedCloudinaryUrl(
                url
            )
        ) {
            call.reject(
                "Only secure Cloudinary video delivery URLs are supported"
            )
            return
        }

        Thread {
            try {
                val cachedFile =
                    synchronized(
                        videoCacheLock
                    ) {
                        getOrDownloadCachedVideo(
                            url
                        )
                    }

                val result =
                    JSObject()

                result.put(
                    "url",
                    Uri.fromFile(
                        cachedFile
                    ).toString()
                )

                call.resolve(result)
            } catch (exception: Exception) {
                call.reject(
                    "Unable to cache Cloudinary video: ${exception.message}",
                    exception
                )
            }
        }.start()
    }

    private fun getOrDownloadCachedVideo(
        url: String
    ): File {
        val cacheDirectory =
            File(
                context.noBackupFilesDir,
                CLOUDINARY_VIDEO_CACHE_DIRECTORY
            )

        if (
            !cacheDirectory.exists() &&
            !cacheDirectory.mkdirs()
        ) {
            throw IllegalStateException(
                "Unable to create video cache directory"
            )
        }

        val fileName =
            buildCacheFileName(
                url
            )

        val cachedFile =
            File(
                cacheDirectory,
                fileName
            )

        if (
            cachedFile.isFile &&
            cachedFile.length() > 0L
        ) {
            cachedFile.setLastModified(
                System.currentTimeMillis()
            )

            evictOldCachedVideos(
                cacheDirectory,
                cachedFile
            )

            return cachedFile
        }

        val temporaryFile =
            File(
                cacheDirectory,
                "$fileName.download"
            )

        if (temporaryFile.exists()) {
            temporaryFile.delete()
        }

        downloadVideo(
            url,
            temporaryFile
        )

        if (
            temporaryFile.length() <= 0L
        ) {
            temporaryFile.delete()

            throw IllegalStateException(
                "Downloaded video is empty"
            )
        }

        if (
            temporaryFile.length() >
            CLOUDINARY_VIDEO_CACHE_SIZE_BYTES
        ) {
            temporaryFile.delete()

            throw IllegalStateException(
                "Video exceeds the 200 MB cache limit"
            )
        }

        if (
            cachedFile.exists() &&
            !cachedFile.delete()
        ) {
            temporaryFile.delete()

            throw IllegalStateException(
                "Unable to replace cached video"
            )
        }

        if (
            !temporaryFile.renameTo(
                cachedFile
            )
        ) {
            temporaryFile.copyTo(
                cachedFile,
                overwrite = true
            )
            temporaryFile.delete()
        }

        cachedFile.setLastModified(
            System.currentTimeMillis()
        )

        evictOldCachedVideos(
            cacheDirectory,
            cachedFile
        )

        return cachedFile
    }

    private fun downloadVideo(
        url: String,
        destination: File
    ) {
        val connection =
            URL(url)
                .openConnection() as
                    HttpURLConnection

        try {
            connection.instanceFollowRedirects =
                true

            connection.connectTimeout =
                CONNECT_TIMEOUT_MS

            connection.readTimeout =
                READ_TIMEOUT_MS

            connection.useCaches =
                false

            connection.requestMethod =
                "GET"

            connection.connect()

            val responseCode =
                connection.responseCode

            if (
                responseCode !in
                200..299
            ) {
                throw IllegalStateException(
                    "Cloudinary returned HTTP $responseCode"
                )
            }

            val contentLength =
                connection.contentLengthLong

            if (
                contentLength >
                CLOUDINARY_VIDEO_CACHE_SIZE_BYTES
            ) {
                throw IllegalStateException(
                    "Video exceeds the 200 MB cache limit"
                )
            }

            connection.inputStream
                .buffered()
                .use { input ->
                    destination
                        .outputStream()
                        .buffered()
                        .use { output ->
                            val buffer =
                                ByteArray(
                                    DOWNLOAD_BUFFER_SIZE
                                )

                            var totalBytes =
                                0L

                            while (true) {
                                val bytesRead =
                                    input.read(
                                        buffer
                                    )

                                if (bytesRead < 0) {
                                    break
                                }

                                totalBytes +=
                                    bytesRead

                                if (
                                    totalBytes >
                                    CLOUDINARY_VIDEO_CACHE_SIZE_BYTES
                                ) {
                                    throw IllegalStateException(
                                        "Video exceeds the 200 MB cache limit"
                                    )
                                }

                                output.write(
                                    buffer,
                                    0,
                                    bytesRead
                                )
                            }
                        }
                }
        } catch (exception: Exception) {
            destination.delete()
            throw exception
        } finally {
            connection.disconnect()
        }
    }

    private fun evictOldCachedVideos(
        cacheDirectory: File,
        protectedFile: File
    ) {
        val cachedFiles =
            cacheDirectory
                .listFiles()
                ?.filter {
                    it.isFile &&
                            !it.name.endsWith(
                                ".download"
                            )
                }
                ?.sortedBy {
                    it.lastModified()
                }
                ?: return

        var totalBytes =
            cachedFiles.sumOf {
                it.length()
            }

        if (
            totalBytes <=
            CLOUDINARY_VIDEO_CACHE_SIZE_BYTES
        ) {
            return
        }

        for (file in cachedFiles) {
            if (
                totalBytes <=
                CLOUDINARY_VIDEO_CACHE_SIZE_BYTES
            ) {
                break
            }

            if (
                file.absolutePath ==
                protectedFile.absolutePath
            ) {
                continue
            }

            val fileSize =
                file.length()

            if (file.delete()) {
                totalBytes -=
                    fileSize
            }
        }
    }

    private fun buildCacheFileName(
        url: String
    ): String {
        val digest =
            MessageDigest
                .getInstance(
                    "SHA-256"
                )
                .digest(
                    url.toByteArray(
                        Charsets.UTF_8
                    )
                )

        val hash =
            digest.joinToString(
                separator = ""
            ) { byte ->
                "%02x".format(
                    byte.toInt() and
                            0xff
                )
            }

        return hash +
                videoFileExtension(
                    url
                )
    }

    private fun videoFileExtension(
        url: String
    ): String {
        val path =
            runCatching {
                Uri.parse(url).path
            }.getOrNull()
                ?.lowercase()
                ?: return ".mp4"

        return when {
            path.endsWith(".webm") ->
                ".webm"

            path.endsWith(".m4v") ->
                ".m4v"

            path.endsWith(".mov") ->
                ".mov"

            path.endsWith(".mkv") ->
                ".mkv"

            else ->
                ".mp4"
        }
    }

    private fun deleteLegacyLocalFile(value: String?) {
        if (
            value.isNullOrBlank() ||
            value.startsWith("https://")
        ) {
            return
        }

        try {
            val normalizedPath =
                if (value.startsWith("file://")) {
                    Uri.parse(value).path
                } else {
                    value
                }

            if (!normalizedPath.isNullOrBlank()) {
                File(normalizedPath).delete()
            }
        } catch (_: Exception) {
            // Ignore stale legacy paths.
        }
    }
}