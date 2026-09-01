package com.audio.beat.app

import android.content.ComponentName
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.common.util.concurrent.ListenableFuture

@UnstableApi
@CapacitorPlugin(name = "AudioPlayer")
class AudioPlayerPlugin : Plugin() {

    companion object {
        private const val EXTRA_ORIGINAL_ARTIST =
            "audio_beats_original_artist"

        private const val EXTRA_ORIGINAL_ALBUM =
            "audio_beats_original_album"
    }

    private val mainHandler =
        Handler(Looper.getMainLooper())

    private var controllerFuture:
            ListenableFuture<MediaController>? = null

    private var controller:
            MediaController? = null

    private var pendingLoadCall:
            PluginCall? = null

    private val progressRunnable =
        object : Runnable {
            override fun run() {
                val activeController =
                    controller ?: return

                notifyListeners(
                    "progress",
                    buildProgressState(
                        activeController
                    )
                )

                if (
                    activeController.isPlaying
                ) {
                    mainHandler.postDelayed(
                        this,
                        500L
                    )
                }
            }
        }

    private val playerListener =
        object : Player.Listener {

            override fun onPlaybackStateChanged(
                playbackState: Int
            ) {
                val activeController =
                    controller ?: return

                if (
                    playbackState ==
                    Player.STATE_READY
                ) {
                    resolvePendingLoad(
                        activeController
                    )
                }

                if (
                    playbackState ==
                    Player.STATE_ENDED
                ) {
                    stopProgressUpdates()

                    val durationMs =
                        safeDurationMs(
                            activeController
                        )

                    notifyListeners(
                        "completed",
                        JSObject().apply {
                            put(
                                "position",
                                durationMs /
                                        1000.0
                            )
                            put(
                                "duration",
                                durationMs /
                                        1000.0
                            )
                        }
                    )
                }
            }

            override fun onMediaItemTransition(
                mediaItem: MediaItem?,
                reason: Int
            ) {
                val activeController =
                    controller ?: return

                notifyListeners(
                    "mediaItemChanged",
                    buildMediaItemState(
                        activeController,
                        mediaItem,
                        reason
                    )
                )

                notifyListeners(
                    "progress",
                    buildProgressState(
                        activeController
                    )
                )
            }

            override fun onIsPlayingChanged(
                isPlaying: Boolean
            ) {
                notifyPlaybackState(
                    isPlaying
                )

                if (isPlaying) {
                    startProgressUpdates()
                } else {
                    stopProgressUpdates()

                    controller?.let {
                        notifyListeners(
                            "progress",
                            buildProgressState(
                                it
                            )
                        )
                    }
                }
            }

            override fun onPlayerError(
                error: PlaybackException
            ) {
                pendingLoadCall?.reject(
                    "Unable to load audio: ${error.message}",
                    error
                )

                pendingLoadCall = null

                notifyPlayerError(
                    error.message
                        ?: "Media3 playback error.",
                    error.cause?.message
                )
            }
        }

    override fun load() {
        super.load()
        connectController()
    }

    override fun handleOnDestroy() {
        stopProgressUpdates()

        pendingLoadCall?.reject(
            "Audio player bridge was destroyed."
        )

        pendingLoadCall = null

        controller?.removeListener(
            playerListener
        )

        controller = null

        controllerFuture?.let {
            MediaController.releaseFuture(
                it
            )
        }

        controllerFuture = null

        super.handleOnDestroy()
    }

    private fun connectController() {
        if (
            controller != null ||
            controllerFuture != null
        ) {
            return
        }

        val sessionToken =
            SessionToken(
                context,
                ComponentName(
                    context,
                    MusicPlaybackService::class.java
                )
            )

        val future =
            MediaController.Builder(
                context,
                sessionToken
            ).buildAsync()

        controllerFuture = future

        future.addListener(
            {
                try {
                    val connectedController =
                        future.get()

                    controller =
                        connectedController

                    connectedController
                        .addListener(
                            playerListener
                        )
                } catch (
                    exception: Exception
                ) {
                    controllerFuture = null

                    notifyPlayerError(
                        "Unable to connect to background playback service.",
                        exception.message
                    )
                }
            },
            ContextCompat.getMainExecutor(
                context
            )
        )
    }

    private fun withController(
        call: PluginCall,
        action: (MediaController) -> Unit
    ) {
        val activeController =
            controller

        if (
            activeController != null
        ) {
            mainHandler.post {
                action(
                    activeController
                )
            }

            return
        }

        connectController()

        val future =
            controllerFuture

        if (future == null) {
            call.reject(
                "Unable to initialise background audio controller."
            )

            return
        }

        future.addListener(
            {
                try {
                    val connectedController =
                        future.get()

                    controller =
                        connectedController

                    if (
                        !connectedController
                            .isConnected
                    ) {
                        call.reject(
                            "Background audio controller is not connected."
                        )

                        return@addListener
                    }

                    mainHandler.post {
                        action(
                            connectedController
                        )
                    }
                } catch (
                    exception: Exception
                ) {
                    call.reject(
                        "Unable to connect to background audio service: ${exception.message}",
                        exception
                    )
                }
            },
            ContextCompat.getMainExecutor(
                context
            )
        )
    }

    @PluginMethod
    fun load(
        call: PluginCall
    ) {
        val uriString =
            call.getString("uri")

        if (
            uriString.isNullOrBlank()
        ) {
            call.reject(
                "Audio URI is required."
            )

            return
        }

        val autoPlay =
            call.getBoolean(
                "autoPlay",
                false
            ) ?: false

        withController(
            call
        ) { activeController ->
            pendingLoadCall?.reject(
                "Another audio load request was started."
            )

            pendingLoadCall = call

            val queue =
                buildQueue(
                    call.getArray(
                        "queue"
                    )
                )

            val fallbackItem =
                buildMediaItem(
                    id =
                        call.getString(
                            "id"
                        ) ?: uriString,
                    uri =
                        uriString,
                    title =
                        call.getString(
                            "title"
                        ),
                    artist =
                        call.getString(
                            "artist"
                        ),
                    album =
                        call.getString(
                            "album"
                        ),
                    albumArt =
                        call.getString(
                            "albumArt"
                        )
                )

            val mediaItems =
                if (
                    queue.isNotEmpty()
                ) {
                    queue
                } else {
                    listOf(
                        fallbackItem
                    )
                }

            val requestedId =
                call.getString(
                    "id"
                )

            val startIndexById =
                requestedId
                    ?.let { id ->
                        mediaItems.indexOfFirst {
                            it.mediaId == id
                        }
                    }
                    ?: -1

            val startIndex =
                if (
                    startIndexById >= 0
                ) {
                    startIndexById
                } else {
                    mediaItems.indexOfFirst {
                        it.localConfiguration
                            ?.uri
                            ?.toString() ==
                                uriString
                    }.coerceAtLeast(0)
                }

            activeController.setMediaItems(
                mediaItems,
                startIndex,
                0L
            )

            activeController.prepare()

            activeController.playWhenReady =
                autoPlay
        }
    }

    @PluginMethod
    fun play(
        call: PluginCall
    ) {
        withController(
            call
        ) { activeController ->
            if (
                activeController
                    .mediaItemCount == 0
            ) {
                call.reject(
                    "No prepared audio track is available."
                )

                return@withController
            }

            activeController.play()

            call.resolve(
                buildCommandResult(
                    activeController,
                    true
                )
            )
        }
    }

    @PluginMethod
    fun pause(
        call: PluginCall
    ) {
        withController(
            call
        ) { activeController ->
            activeController.pause()

            call.resolve(
                buildCommandResult(
                    activeController,
                    false
                )
            )
        }
    }

    @PluginMethod
    fun stop(
        call: PluginCall
    ) {
        withController(
            call
        ) { activeController ->
            activeController.pause()
            activeController.seekTo(0L)

            call.resolve(
                buildCommandResult(
                    activeController,
                    false
                )
            )
        }
    }

    @PluginMethod
    fun seek(
        call: PluginCall
    ) {
        val requestedPosition =
            call.getDouble(
                "position"
            )

        if (
            requestedPosition == null
        ) {
            call.reject(
                "Seek position is required."
            )

            return
        }

        withController(
            call
        ) { activeController ->
            val durationMs =
                safeDurationMs(
                    activeController
                )

            val requestedMs =
                (
                        requestedPosition *
                                1000.0
                        ).toLong()

            val safePositionMs =
                if (
                    durationMs > 0L
                ) {
                    requestedMs.coerceIn(
                        0L,
                        durationMs
                    )
                } else {
                    requestedMs
                        .coerceAtLeast(
                            0L
                        )
                }

            activeController.seekTo(
                safePositionMs
            )

            call.resolve(
                JSObject().apply {
                    put(
                        "position",
                        safePositionMs /
                                1000.0
                    )

                    put(
                        "duration",
                        durationMs /
                                1000.0
                    )
                }
            )
        }
    }

    @PluginMethod
    fun release(
        call: PluginCall
    ) {
        withController(
            call
        ) { activeController ->
            stopProgressUpdates()

            activeController.stop()
            activeController
                .clearMediaItems()

            pendingLoadCall = null

            notifyPlaybackState(
                false
            )

            call.resolve()
        }
    }

    @PluginMethod
    fun getState(
        call: PluginCall
    ) {
        withController(
            call
        ) { activeController ->
            call.resolve(
                buildFullState(
                    activeController
                )
            )
        }
    }

    private fun buildQueue(
        rawQueue: JSArray?
    ): List<MediaItem> {
        if (
            rawQueue == null ||
            rawQueue.length() == 0
        ) {
            return emptyList()
        }

        val mediaItems =
            mutableListOf<MediaItem>()

        for (
        index in
        0 until rawQueue.length()
        ) {
            val item =
                rawQueue
                    .optJSONObject(
                        index
                    )
                    ?: continue

            val uri =
                item.optString(
                    "uri"
                ).trim()

            if (
                uri.isBlank()
            ) {
                continue
            }

            val id =
                item.optString(
                    "id",
                    uri
                ).trim()
                    .ifBlank {
                        uri
                    }

            mediaItems.add(
                buildMediaItem(
                    id = id,
                    uri = uri,
                    title =
                        item.optString(
                            "title"
                        ),
                    artist =
                        item.optString(
                            "artist"
                        ),
                    album =
                        item.optString(
                            "album"
                        ),
                    albumArt =
                        item.optString(
                            "albumArt"
                        )
                )
            )
        }

        return mediaItems
            .distinctBy {
                it.mediaId
            }
    }

    private fun buildMediaItem(
        id: String,
        uri: String,
        title: String?,
        artist: String?,
        album: String?,
        albumArt: String?
    ): MediaItem {
        val safeTitle =
            title
                ?.trim()
                ?.takeIf {
                    it.isNotEmpty()
                }
                ?: "Unknown title"

        val safeArtist =
            artist
                ?.trim()
                ?.takeIf {
                    it.isNotEmpty()
                }
                ?: "Unknown artist"

        val safeAlbum =
            album
                ?.trim()
                ?.takeIf {
                    it.isNotEmpty()
                }
                ?: "Unknown album"

        /*
         * This phone's System UI renders the notification's second
         * line by concatenating artist + albumTitle with no separator.
         *
         * Instead of putting the album into artist as well, give the
         * artist field only the artist plus our separator. Then let
         * System UI append albumTitle once:
         *
         *   "Artist • " + "Album"
         *        -> Artist • Album
         *
         * The space after the bullet is a non-breaking space so OEM
         * notification code is less likely to trim it away.
         */
        val notificationArtist =
            "$safeArtist •\u00A0"

        val metadataExtras =
            Bundle().apply {
                putString(
                    EXTRA_ORIGINAL_ARTIST,
                    safeArtist
                )

                putString(
                    EXTRA_ORIGINAL_ALBUM,
                    safeAlbum
                )
            }

        val metadataBuilder =
            MediaMetadata.Builder()
                .setTitle(
                    safeTitle
                )
                .setDisplayTitle(
                    safeTitle
                )
                .setArtist(
                    notificationArtist
                )
                .setAlbumTitle(
                    safeAlbum
                )
                .setExtras(
                    metadataExtras
                )
                .setMediaType(
                    MediaMetadata
                        .MEDIA_TYPE_MUSIC
                )

        albumArt
            ?.trim()
            ?.takeIf {
                it.isNotEmpty()
            }
            ?.let {
                    artworkUri ->
                runCatching {
                    metadataBuilder
                        .setArtworkUri(
                            Uri.parse(
                                artworkUri
                            )
                        )
                }.onFailure {
                        exception ->
                    notifyPlayerError(
                        "Unable to attach album artwork metadata.",
                        exception.message
                    )
                }
            }

        return MediaItem.Builder()
            .setUri(
                uri
            )
            .setMediaId(
                id
            )
            .setMediaMetadata(
                metadataBuilder.build()
            )
            .build()
    }

    private fun resolvePendingLoad(
        activeController:
        MediaController
    ) {
        val pendingCall =
            pendingLoadCall
                ?: return

        val uri =
            activeController
                .currentMediaItem
                ?.localConfiguration
                ?.uri
                ?.toString()

        val result =
            JSObject().apply {
                put(
                    "uri",
                    uri
                )

                put(
                    "duration",
                    safeDurationMs(
                        activeController
                    ) / 1000.0
                )
            }

        pendingCall.resolve(
            result
        )

        pendingLoadCall = null

        notifyListeners(
            "prepared",
            result
        )
    }

    private fun buildFullState(
        activeController:
        MediaController
    ): JSObject {
        val mediaItem =
            activeController
                .currentMediaItem

        val metadata =
            mediaItem
                ?.mediaMetadata

        return JSObject().apply {
            put(
                "uri",
                mediaItem
                    ?.localConfiguration
                    ?.uri
                    ?.toString()
            )

            put(
                "id",
                mediaItem
                    ?.mediaId
            )

            put(
                "title",
                metadata
                    ?.title
                    ?.toString()
            )

            put(
                "artist",
                originalArtist(
                    metadata
                )
            )

            put(
                "album",
                originalAlbum(
                    metadata
                )
            )

            put(
                "albumArt",
                metadata
                    ?.artworkUri
                    ?.toString()
            )

            put(
                "isPrepared",
                activeController
                    .mediaItemCount >
                        0 &&
                        activeController
                            .playbackState !=
                        Player.STATE_IDLE
            )

            put(
                "isPlaying",
                activeController
                    .isPlaying
            )

            put(
                "position",
                safePositionMs(
                    activeController
                ) / 1000.0
            )

            put(
                "duration",
                safeDurationMs(
                    activeController
                ) / 1000.0
            )
        }
    }

    private fun buildMediaItemState(
        activeController:
        MediaController,
        mediaItem:
        MediaItem?,
        reason: Int
    ): JSObject {
        val metadata =
            mediaItem
                ?.mediaMetadata

        return JSObject().apply {
            put(
                "id",
                mediaItem
                    ?.mediaId
            )

            put(
                "uri",
                mediaItem
                    ?.localConfiguration
                    ?.uri
                    ?.toString()
            )

            put(
                "title",
                metadata
                    ?.title
                    ?.toString()
            )

            put(
                "artist",
                originalArtist(
                    metadata
                )
            )

            put(
                "album",
                originalAlbum(
                    metadata
                )
            )

            put(
                "albumArt",
                metadata
                    ?.artworkUri
                    ?.toString()
            )

            put(
                "position",
                safePositionMs(
                    activeController
                ) / 1000.0
            )

            put(
                "duration",
                safeDurationMs(
                    activeController
                ) / 1000.0
            )

            put(
                "isPlaying",
                activeController
                    .isPlaying ||
                        activeController
                            .playWhenReady
            )

            put(
                "reason",
                reason
            )
        }
    }

    private fun originalArtist(
        metadata: MediaMetadata?
    ): String? {
        return metadata
            ?.extras
            ?.getString(
                EXTRA_ORIGINAL_ARTIST
            )
            ?: metadata
                ?.artist
                ?.toString()
    }

    private fun originalAlbum(
        metadata: MediaMetadata?
    ): String? {
        return metadata
            ?.extras
            ?.getString(
                EXTRA_ORIGINAL_ALBUM
            )
            ?: metadata
                ?.albumTitle
                ?.toString()
    }

    private fun buildProgressState(
        activeController:
        MediaController
    ): JSObject =
        JSObject().apply {
            put(
                "position",
                safePositionMs(
                    activeController
                ) / 1000.0
            )

            put(
                "duration",
                safeDurationMs(
                    activeController
                ) / 1000.0
            )

            put(
                "isPlaying",
                activeController
                    .isPlaying
            )
        }

    private fun buildCommandResult(
        activeController:
        MediaController,
        expectedPlaying:
        Boolean
    ): JSObject =
        JSObject().apply {
            put(
                "isPlaying",
                expectedPlaying
            )

            put(
                "position",
                safePositionMs(
                    activeController
                ) / 1000.0
            )

            put(
                "duration",
                safeDurationMs(
                    activeController
                ) / 1000.0
            )
        }

    private fun safePositionMs(
        activeController:
        MediaController
    ): Long =
        activeController
            .currentPosition
            .coerceAtLeast(
                0L
            )

    private fun safeDurationMs(
        activeController:
        MediaController
    ): Long {
        val duration =
            activeController.duration

        return if (
            duration ==
            C.TIME_UNSET ||
            duration < 0L
        ) {
            0L
        } else {
            duration
        }
    }

    private fun startProgressUpdates() {
        mainHandler.removeCallbacks(
            progressRunnable
        )

        mainHandler.post(
            progressRunnable
        )
    }

    private fun stopProgressUpdates() {
        mainHandler.removeCallbacks(
            progressRunnable
        )
    }

    private fun notifyPlaybackState(
        playing: Boolean
    ) {
        notifyListeners(
            "playbackStateChanged",
            JSObject().apply {
                put(
                    "isPlaying",
                    playing
                )
            }
        )
    }

    private fun notifyPlayerError(
        message: String,
        details: String?
    ) {
        notifyListeners(
            "error",
            JSObject().apply {
                put(
                    "message",
                    message
                )

                if (
                    !details
                        .isNullOrBlank()
                ) {
                    put(
                        "details",
                        details
                    )
                }
            }
        )
    }
}
