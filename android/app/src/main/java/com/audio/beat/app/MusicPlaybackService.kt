package com.audio.beat.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.TransferListener
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

@UnstableApi
class MusicPlaybackService :
    MediaLibraryService() {

    companion object {
        private const val CLOUDINARY_AUDIO_CACHE_SIZE_BYTES =
            500L * 1024L * 1024L

        private const val CLOUDINARY_AUDIO_CACHE_DIRECTORY =
            "cloudinary_audio_cache"

        private const val ROOT_ID =
            "audio_beat_root"

        private const val RECENTLY_PLAYED_ID =
            "audio_beat_recently_played"

        private const val LIKED_SONGS_ID =
            "audio_beat_liked_songs"

        private const val PLAYLISTS_ID =
            "audio_beat_playlists"

        private const val ALL_SONGS_ID =
            "audio_beat_all_songs"

        private const val PLAYLIST_PREFIX =
            "audio_beat_playlist:"

        private const val EXTRA_PARENT_ID =
            "audio_beat_parent_id"

        private const val EXTRA_ORIGINAL_ARTIST =
            "audio_beats_original_artist"

        private const val EXTRA_ORIGINAL_ALBUM =
            "audio_beats_original_album"
    }

    private var exoPlayer:
            ExoPlayer? = null

    private var mediaLibrarySession:
            MediaLibrarySession? = null

    private var cloudinaryAudioCache:
            SimpleCache? = null

    private val libraryCallback =
        object :
            MediaLibrarySession.Callback {

            override fun onGetLibraryRoot(
                session:
                MediaLibrarySession,
                browser:
                MediaSession.ControllerInfo,
                params:
                LibraryParams?
            ): ListenableFuture<
                    LibraryResult<MediaItem>> {
                return Futures.immediateFuture(
                    LibraryResult.ofItem(
                        buildBrowsableItem(
                            mediaId =
                                ROOT_ID,
                            title =
                                "Audio Beat",
                            mediaType =
                                MediaMetadata
                                    .MEDIA_TYPE_FOLDER_MIXED
                        ),
                        params
                    )
                )
            }

            override fun onGetChildren(
                session:
                MediaLibrarySession,
                browser:
                MediaSession.ControllerInfo,
                parentId:
                String,
                page:
                Int,
                pageSize:
                Int,
                params:
                LibraryParams?
            ): ListenableFuture<
                    LibraryResult<
                            ImmutableList<
                                    MediaItem>>> {
                val library =
                    loadLibrarySnapshot()

                val children =
                    when {
                        parentId ==
                                ROOT_ID ->
                            buildRootChildren()

                        parentId ==
                                RECENTLY_PLAYED_ID ->
                            buildSongBrowseItems(
                                library.songsForIds(
                                    library
                                        .recentlyPlayedIds
                                ),
                                RECENTLY_PLAYED_ID
                            )

                        parentId ==
                                LIKED_SONGS_ID ->
                            buildSongBrowseItems(
                                library.songsForIds(
                                    library
                                        .likedSongIds
                                ),
                                LIKED_SONGS_ID
                            )

                        parentId ==
                                PLAYLISTS_ID ->
                            library.playlists.map {
                                    playlist ->
                                buildBrowsableItem(
                                    mediaId =
                                        PLAYLIST_PREFIX +
                                                playlist.id,
                                    title =
                                        playlist.name,
                                    mediaType =
                                        MediaMetadata
                                            .MEDIA_TYPE_PLAYLIST
                                )
                            }

                        parentId ==
                                ALL_SONGS_ID ->
                            buildSongBrowseItems(
                                library.songs,
                                ALL_SONGS_ID
                            )

                        parentId.startsWith(
                            PLAYLIST_PREFIX
                        ) -> {
                            val playlistId =
                                parentId.removePrefix(
                                    PLAYLIST_PREFIX
                                )

                            val playlist =
                                library.playlists
                                    .firstOrNull {
                                        it.id ==
                                                playlistId
                                    }

                            if (
                                playlist == null
                            ) {
                                emptyList()
                            } else {
                                buildSongBrowseItems(
                                    library.songsForIds(
                                        playlist.songIds
                                    ),
                                    parentId
                                )
                            }
                        }

                        else ->
                            emptyList()
                    }

                val pagedChildren =
                    paginate(
                        children,
                        page,
                        pageSize
                    )

                return Futures.immediateFuture(
                    LibraryResult.ofItemList(
                        pagedChildren,
                        params
                    )
                )
            }

            override fun onGetItem(
                session:
                MediaLibrarySession,
                browser:
                MediaSession.ControllerInfo,
                mediaId:
                String
            ): ListenableFuture<
                    LibraryResult<MediaItem>> {
                val item =
                    resolveBrowseItem(
                        mediaId
                    )

                return if (
                    item != null
                ) {
                    Futures.immediateFuture(
                        LibraryResult.ofItem(
                            item,
                            null
                        )
                    )
                } else {
                    super.onGetItem(
                        session,
                        browser,
                        mediaId
                    )
                }
            }

            override fun onSetMediaItems(
                mediaSession:
                MediaSession,
                controller:
                MediaSession.ControllerInfo,
                mediaItems:
                List<MediaItem>,
                startIndex:
                Int,
                startPositionMs:
                Long
            ): ListenableFuture<
                    MediaSession
                        .MediaItemsWithStartPosition> {
                /*
                 * Normal phone playback already sends fully
                 * resolved MediaItems containing playback URIs.
                 * Preserve that queue exactly as supplied.
                 */
                if (
                    mediaItems.isNotEmpty() &&
                    mediaItems.all {
                        it.localConfiguration !=
                                null
                    }
                ) {
                    return Futures.immediateFuture(
                        MediaSession
                            .MediaItemsWithStartPosition(
                                mediaItems,
                                startIndex,
                                startPositionMs
                            )
                    )
                }

                val requestedItem =
                    mediaItems.getOrNull(
                        if (
                            startIndex in
                            mediaItems.indices
                        ) {
                            startIndex
                        } else {
                            0
                        }
                    )

                val requestedMediaId =
                    requestedItem
                        ?.mediaId
                        ?.takeIf {
                            it.isNotBlank()
                        }

                if (
                    requestedMediaId ==
                    null
                ) {
                    return super.onSetMediaItems(
                        mediaSession,
                        controller,
                        mediaItems,
                        startIndex,
                        startPositionMs
                    )
                }

                val library =
                    loadLibrarySnapshot()

                val parentId =
                    requestedItem
                        .mediaMetadata
                        .extras
                        ?.getString(
                            EXTRA_PARENT_ID
                        )

                val queueSongs =
                    songsForParent(
                        library,
                        parentId
                    )
                        .ifEmpty {
                            library.songs
                        }

                val requestedSong =
                    library.songs
                        .firstOrNull {
                            it.id ==
                                    requestedMediaId
                        }

                if (
                    requestedSong == null
                ) {
                    return super.onSetMediaItems(
                        mediaSession,
                        controller,
                        mediaItems,
                        startIndex,
                        startPositionMs
                    )
                }

                val normalizedQueue =
                    if (
                        queueSongs.any {
                            it.id ==
                                    requestedSong.id
                        }
                    ) {
                        queueSongs
                    } else {
                        listOf(
                            requestedSong
                        )
                    }

                val playableItems =
                    normalizedQueue.map {
                            song ->
                        buildPlayableItem(
                            song
                        )
                    }

                val resolvedStartIndex =
                    playableItems
                        .indexOfFirst {
                            it.mediaId ==
                                    requestedSong.id
                        }
                        .coerceAtLeast(
                            0
                        )

                val resolvedPosition =
                    if (
                        startPositionMs ==
                        C.TIME_UNSET ||
                        startPositionMs <
                        0L
                    ) {
                        0L
                    } else {
                        startPositionMs
                    }

                return Futures.immediateFuture(
                    MediaSession
                        .MediaItemsWithStartPosition(
                            playableItems,
                            resolvedStartIndex,
                            resolvedPosition
                        )
                )
            }
        }

    override fun onCreate() {
        super.onCreate()

        val defaultDataSourceFactory =
            DefaultDataSource.Factory(
                this
            )

        val databaseProvider =
            StandaloneDatabaseProvider(
                this
            )

        val cache =
            SimpleCache(
                File(
                    noBackupFilesDir,
                    CLOUDINARY_AUDIO_CACHE_DIRECTORY
                ),
                LeastRecentlyUsedCacheEvictor(
                    CLOUDINARY_AUDIO_CACHE_SIZE_BYTES
                ),
                databaseProvider
            )

        cloudinaryAudioCache =
            cache

        val cloudinaryCacheDataSourceFactory =
            CacheDataSource.Factory()
                .setCache(
                    cache
                )
                .setUpstreamDataSourceFactory(
                    defaultDataSourceFactory
                )
                .setFlags(
                    CacheDataSource
                        .FLAG_IGNORE_CACHE_ON_ERROR
                )

        /*
         * Only Cloudinary-delivered media is routed through
         * the persistent Media3 cache.
         *
         * Local/content/file URIs keep using the normal
         * DefaultDataSource path and are not copied into
         * this cache.
         */
        val playbackDataSourceFactory =
            CloudinaryRoutingDataSourceFactory(
                defaultDataSourceFactory =
                    defaultDataSourceFactory,
                cloudinaryDataSourceFactory =
                    cloudinaryCacheDataSourceFactory
            )

        val mediaSourceFactory =
            DefaultMediaSourceFactory(
                playbackDataSourceFactory
            )

        val player =
            ExoPlayer.Builder(
                this
            )
                .setMediaSourceFactory(
                    mediaSourceFactory
                )
                .build()
                .apply {
                    val audioAttributes =
                        AudioAttributes
                            .Builder()
                            .setUsage(
                                C.USAGE_MEDIA
                            )
                            .setContentType(
                                C.AUDIO_CONTENT_TYPE_MUSIC
                            )
                            .build()

                    setAudioAttributes(
                        audioAttributes,
                        true
                    )

                    /*
                     * Automatically pause playback when
                     * headphones or Bluetooth disconnect.
                     */
                    setHandleAudioBecomingNoisy(
                        true
                    )

                    /*
                     * The React queue wraps from its final
                     * song to its first song. Repeat-all gives
                     * phone notification and Android Auto
                     * controls the same boundary behaviour.
                     */
                    repeatMode =
                        Player.REPEAT_MODE_ALL
                }

        val launchIntent =
            packageManager
                .getLaunchIntentForPackage(
                    packageName
                )
                ?: Intent(
                    this,
                    MainActivity::class.java
                )

        val sessionActivity =
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                        PendingIntent.FLAG_IMMUTABLE
            )

        exoPlayer =
            player

        mediaLibrarySession =
            MediaLibrarySession
                .Builder(
                    this,
                    player,
                    libraryCallback
                )
                .setSessionActivity(
                    sessionActivity
                )
                .build()
    }

    override fun onGetSession(
        controllerInfo:
        MediaSession.ControllerInfo
    ): MediaLibrarySession? {
        return mediaLibrarySession
    }

    override fun onTaskRemoved(
        rootIntent: Intent?
    ) {
        /*
         * Pressing Home or opening another app does not
         * call this method, so playback continues normally.
         *
         * Swiping this app away from Android Recents does
         * call this method. Preserve the existing explicit
         * exit behaviour.
         */
        pauseAllPlayersAndStopSelf()
    }

    override fun onDestroy() {
        /*
         * Release the MediaLibrarySession first so no phone
         * or Android Auto controller can keep sending
         * commands to the player.
         */
        mediaLibrarySession?.release()
        mediaLibrarySession =
            null

        /*
         * Stop and release ExoPlayer completely.
         */
        exoPlayer?.run {
            stop()
            clearMediaItems()
            release()
        }

        exoPlayer =
            null

        /*
         * SimpleCache allows only one instance for a cache
         * directory at a time. Release it when the playback
         * service is destroyed so the same persistent cache
         * can be reopened safely next time.
         */
        cloudinaryAudioCache?.release()
        cloudinaryAudioCache =
            null

        super.onDestroy()
    }

    private fun buildRootChildren():
            List<MediaItem> {
        return listOf(
            buildBrowsableItem(
                mediaId =
                    RECENTLY_PLAYED_ID,
                title =
                    "Recently Played",
                mediaType =
                    MediaMetadata
                        .MEDIA_TYPE_FOLDER_MIXED
            ),
            buildBrowsableItem(
                mediaId =
                    LIKED_SONGS_ID,
                title =
                    "Liked Songs",
                mediaType =
                    MediaMetadata
                        .MEDIA_TYPE_FOLDER_MIXED
            ),
            buildBrowsableItem(
                mediaId =
                    PLAYLISTS_ID,
                title =
                    "Playlists",
                mediaType =
                    MediaMetadata
                        .MEDIA_TYPE_FOLDER_PLAYLISTS
            ),
            buildBrowsableItem(
                mediaId =
                    ALL_SONGS_ID,
                title =
                    "All Songs",
                mediaType =
                    MediaMetadata
                        .MEDIA_TYPE_FOLDER_MIXED
            )
        )
    }

    private fun resolveBrowseItem(
        mediaId: String
    ): MediaItem? {
        if (
            mediaId ==
            ROOT_ID
        ) {
            return buildBrowsableItem(
                mediaId =
                    ROOT_ID,
                title =
                    "Audio Beat",
                mediaType =
                    MediaMetadata
                        .MEDIA_TYPE_FOLDER_MIXED
            )
        }

        buildRootChildren()
            .firstOrNull {
                it.mediaId ==
                        mediaId
            }
            ?.let {
                return it
            }

        val library =
            loadLibrarySnapshot()

        if (
            mediaId.startsWith(
                PLAYLIST_PREFIX
            )
        ) {
            val playlistId =
                mediaId.removePrefix(
                    PLAYLIST_PREFIX
                )

            return library.playlists
                .firstOrNull {
                    it.id ==
                            playlistId
                }
                ?.let {
                        playlist ->
                    buildBrowsableItem(
                        mediaId =
                            mediaId,
                        title =
                            playlist.name,
                        mediaType =
                            MediaMetadata
                                .MEDIA_TYPE_PLAYLIST
                    )
                }
        }

        return library.songs
            .firstOrNull {
                it.id ==
                        mediaId
            }
            ?.let {
                    song ->
                buildBrowseSongItem(
                    song =
                        song,
                    parentId =
                        ALL_SONGS_ID
                )
            }
    }

    private fun buildBrowsableItem(
        mediaId: String,
        title: String,
        mediaType: Int
    ): MediaItem {
        return MediaItem.Builder()
            .setMediaId(
                mediaId
            )
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(
                        title
                    )
                    .setDisplayTitle(
                        title
                    )
                    .setIsBrowsable(
                        true
                    )
                    .setIsPlayable(
                        false
                    )
                    .setMediaType(
                        mediaType
                    )
                    .build()
            )
            .build()
    }

    private fun buildSongBrowseItems(
        songs: List<AndroidAutoSong>,
        parentId: String
    ): List<MediaItem> {
        return songs.map {
                song ->
            buildBrowseSongItem(
                song,
                parentId
            )
        }
    }

    private fun buildBrowseSongItem(
        song: AndroidAutoSong,
        parentId: String
    ): MediaItem {
        val extras =
            Bundle().apply {
                putString(
                    EXTRA_PARENT_ID,
                    parentId
                )
            }

        val metadataBuilder =
            MediaMetadata.Builder()
                .setTitle(
                    song.title
                )
                .setDisplayTitle(
                    song.title
                )
                .setArtist(
                    song.artist
                )
                .setAlbumTitle(
                    song.album
                )
                .setIsBrowsable(
                    false
                )
                .setIsPlayable(
                    true
                )
                .setMediaType(
                    MediaMetadata
                        .MEDIA_TYPE_MUSIC
                )
                .setExtras(
                    extras
                )

        addArtwork(
            metadataBuilder,
            song.albumArt
        )

        return MediaItem.Builder()
            .setMediaId(
                song.id
            )
            .setMediaMetadata(
                metadataBuilder.build()
            )
            .build()
    }

    private fun buildPlayableItem(
        song: AndroidAutoSong
    ): MediaItem {
        val notificationArtist =
            "${song.artist} •\u00A0"

        val metadataExtras =
            Bundle().apply {
                putString(
                    EXTRA_ORIGINAL_ARTIST,
                    song.artist
                )

                putString(
                    EXTRA_ORIGINAL_ALBUM,
                    song.album
                )
            }

        val metadataBuilder =
            MediaMetadata.Builder()
                .setTitle(
                    song.title
                )
                .setDisplayTitle(
                    song.title
                )
                .setArtist(
                    notificationArtist
                )
                .setAlbumTitle(
                    song.album
                )
                .setIsBrowsable(
                    false
                )
                .setIsPlayable(
                    true
                )
                .setMediaType(
                    MediaMetadata
                        .MEDIA_TYPE_MUSIC
                )
                .setExtras(
                    metadataExtras
                )

        addArtwork(
            metadataBuilder,
            song.albumArt
        )

        return MediaItem.Builder()
            .setMediaId(
                song.id
            )
            .setUri(
                song.uri
            )
            .setMediaMetadata(
                metadataBuilder.build()
            )
            .build()
    }

    private fun addArtwork(
        metadataBuilder:
        MediaMetadata.Builder,
        artwork:
        String?
    ) {
        artwork
            ?.trim()
            ?.takeIf {
                it.isNotEmpty()
            }
            ?.let {
                    value ->
                runCatching {
                    metadataBuilder
                        .setArtworkUri(
                            Uri.parse(
                                value
                            )
                        )
                }
            }
    }

    private fun songsForParent(
        library:
        AndroidAutoLibrarySnapshot,
        parentId:
        String?
    ): List<AndroidAutoSong> {
        return when {
            parentId ==
                    RECENTLY_PLAYED_ID ->
                library.songsForIds(
                    library
                        .recentlyPlayedIds
                )

            parentId ==
                    LIKED_SONGS_ID ->
                library.songsForIds(
                    library
                        .likedSongIds
                )

            parentId ==
                    ALL_SONGS_ID ->
                library.songs

            parentId
                ?.startsWith(
                    PLAYLIST_PREFIX
                ) == true -> {
                val playlistId =
                    parentId.removePrefix(
                        PLAYLIST_PREFIX
                    )

                val playlist =
                    library.playlists
                        .firstOrNull {
                            it.id ==
                                    playlistId
                        }

                if (
                    playlist == null
                ) {
                    emptyList()
                } else {
                    library.songsForIds(
                        playlist.songIds
                    )
                }
            }

            else ->
                library.songs
        }
    }

    private fun paginate(
        items: List<MediaItem>,
        page: Int,
        pageSize: Int
    ): List<MediaItem> {
        if (
            items.isEmpty() ||
            page < 0 ||
            pageSize <= 0
        ) {
            return emptyList()
        }

        val fromIndex =
            page.toLong() *
                    pageSize.toLong()

        if (
            fromIndex >=
            items.size
        ) {
            return emptyList()
        }

        val safeFrom =
            fromIndex.toInt()

        val safeTo =
            (
                    safeFrom +
                            pageSize
                    )
                .coerceAtMost(
                    items.size
                )

        return items.subList(
            safeFrom,
            safeTo
        )
    }

    private fun loadLibrarySnapshot():
            AndroidAutoLibrarySnapshot {
        val rawJson =
            getSharedPreferences(
                AndroidAutoLibraryPlugin
                    .PREFERENCES_NAME,
                Context.MODE_PRIVATE
            )
                .getString(
                    AndroidAutoLibraryPlugin
                        .LIBRARY_JSON_KEY,
                    null
                )

        if (
            rawJson.isNullOrBlank()
        ) {
            return AndroidAutoLibrarySnapshot()
        }

        return runCatching {
            parseLibrarySnapshot(
                JSONObject(
                    rawJson
                )
            )
        }.getOrElse {
            AndroidAutoLibrarySnapshot()
        }
    }

    private fun parseLibrarySnapshot(
        root: JSONObject
    ): AndroidAutoLibrarySnapshot {
        val songs =
            parseSongs(
                root.optJSONArray(
                    "songs"
                )
            )

        val recentlyPlayedIds =
            parseStringArray(
                root.optJSONArray(
                    "recentlyPlayedIds"
                )
            )

        val likedSongIds =
            parseStringArray(
                root.optJSONArray(
                    "likedSongIds"
                )
            )

        val playlists =
            parsePlaylists(
                root.optJSONArray(
                    "playlists"
                )
            )

        return AndroidAutoLibrarySnapshot(
            songs =
                songs,
            recentlyPlayedIds =
                recentlyPlayedIds,
            likedSongIds =
                likedSongIds,
            playlists =
                playlists
        )
    }

    private fun parseSongs(
        array: JSONArray?
    ): List<AndroidAutoSong> {
        if (
            array == null
        ) {
            return emptyList()
        }

        val songs =
            mutableListOf<
                    AndroidAutoSong>()

        for (
        index in
        0 until array.length()
        ) {
            val item =
                array.optJSONObject(
                    index
                ) ?: continue

            val id =
                item.optString(
                    "id"
                ).trim()

            val uri =
                item.optString(
                    "uri"
                ).trim()

            if (
                id.isBlank() ||
                uri.isBlank()
            ) {
                continue
            }

            songs.add(
                AndroidAutoSong(
                    id =
                        id,
                    uri =
                        uri,
                    title =
                        safeText(
                            item.optString(
                                "title"
                            ),
                            "Unknown title"
                        ),
                    artist =
                        safeText(
                            item.optString(
                                "artist"
                            ),
                            "Unknown artist"
                        ),
                    album =
                        safeText(
                            item.optString(
                                "album"
                            ),
                            "Unknown album"
                        ),
                    albumArt =
                        item
                            .optString(
                                "albumArt"
                            )
                            .trim()
                            .takeIf {
                                it.isNotEmpty() &&
                                it !=
                                        "null"
                            }
                )
            )
        }

        return songs
            .distinctBy {
                it.id
            }
    }

    private fun parsePlaylists(
        array: JSONArray?
    ): List<AndroidAutoPlaylist> {
        if (
            array == null
        ) {
            return emptyList()
        }

        val playlists =
            mutableListOf<
                    AndroidAutoPlaylist>()

        for (
        index in
        0 until array.length()
        ) {
            val item =
                array.optJSONObject(
                    index
                ) ?: continue

            val id =
                item.optString(
                    "id"
                ).trim()

            val name =
                item.optString(
                    "name"
                ).trim()

            if (
                id.isBlank() ||
                name.isBlank()
            ) {
                continue
            }

            playlists.add(
                AndroidAutoPlaylist(
                    id =
                        id,
                    name =
                        name,
                    songIds =
                        parseStringArray(
                            item.optJSONArray(
                                "songIds"
                            )
                        )
                )
            )
        }

        return playlists
            .distinctBy {
                it.id
            }
    }

    private fun parseStringArray(
        array: JSONArray?
    ): List<String> {
        if (
            array == null
        ) {
            return emptyList()
        }

        val values =
            mutableListOf<String>()

        for (
        index in
        0 until array.length()
        ) {
            val value =
                array.optString(
                    index
                ).trim()

            if (
                value.isNotEmpty()
            ) {
                values.add(
                    value
                )
            }
        }

        return values
            .distinct()
    }

    private fun safeText(
        value: String?,
        fallback: String
    ): String {
        return value
            ?.trim()
            ?.takeIf {
                it.isNotEmpty()
            }
            ?: fallback
    }

    private data class AndroidAutoSong(
        val id: String,
        val uri: String,
        val title: String,
        val artist: String,
        val album: String,
        val albumArt: String?
    )

    private data class AndroidAutoPlaylist(
        val id: String,
        val name: String,
        val songIds: List<String>
    )

    private data class AndroidAutoLibrarySnapshot(
        val songs:
        List<AndroidAutoSong> =
            emptyList(),
        val recentlyPlayedIds:
        List<String> =
            emptyList(),
        val likedSongIds:
        List<String> =
            emptyList(),
        val playlists:
        List<AndroidAutoPlaylist> =
            emptyList()
    ) {
        fun songsForIds(
            ids: List<String>
        ): List<AndroidAutoSong> {
            if (
                ids.isEmpty() ||
                songs.isEmpty()
            ) {
                return emptyList()
            }

            val songsById =
                songs.associateBy {
                    it.id
                }

            return ids.mapNotNull {
                    id ->
                songsById[
                    id
                ]
            }
        }
    }

    private class CloudinaryRoutingDataSourceFactory(
        private val defaultDataSourceFactory:
        DataSource.Factory,
        private val cloudinaryDataSourceFactory:
        DataSource.Factory
    ) : DataSource.Factory {

        override fun createDataSource():
                DataSource {
            return CloudinaryRoutingDataSource(
                defaultDataSourceFactory =
                    defaultDataSourceFactory,
                cloudinaryDataSourceFactory =
                    cloudinaryDataSourceFactory
            )
        }
    }

    private class CloudinaryRoutingDataSource(
        private val defaultDataSourceFactory:
        DataSource.Factory,
        private val cloudinaryDataSourceFactory:
        DataSource.Factory
    ) : DataSource {

        private val transferListeners =
            mutableListOf<TransferListener>()

        private var activeDataSource:
                DataSource? = null

        override fun addTransferListener(
            transferListener:
            TransferListener
        ) {
            transferListeners.add(
                transferListener
            )
        }

        override fun open(
            dataSpec: DataSpec
        ): Long {
            check(
                activeDataSource == null
            ) {
                "DataSource is already open."
            }

            val selectedDataSource =
                if (
                    isCloudinaryUri(
                        dataSpec.uri
                    )
                ) {
                    cloudinaryDataSourceFactory
                        .createDataSource()
                } else {
                    defaultDataSourceFactory
                        .createDataSource()
                }

            for (
            transferListener
            in transferListeners
            ) {
                selectedDataSource
                    .addTransferListener(
                        transferListener
                    )
            }

            activeDataSource =
                selectedDataSource

            return try {
                selectedDataSource.open(
                    dataSpec
                )
            } catch (
                exception: Exception
            ) {
                activeDataSource =
                    null

                runCatching {
                    selectedDataSource
                        .close()
                }

                throw exception
            }
        }

        override fun read(
            buffer: ByteArray,
            offset: Int,
            length: Int
        ): Int {
            return activeDataSource
                ?.read(
                    buffer,
                    offset,
                    length
                )
                ?: C.RESULT_END_OF_INPUT
        }

        override fun getUri():
                Uri? {
            return activeDataSource
                ?.uri
        }

        override fun close() {
            val dataSource =
                activeDataSource

            activeDataSource =
                null

            dataSource?.close()
        }

        private fun isCloudinaryUri(
            uri: Uri
        ): Boolean {
            val scheme =
                uri.scheme
                    ?.lowercase()

            if (
                scheme != "https" &&
                scheme != "http"
            ) {
                return false
            }

            val host =
                uri.host
                    ?.lowercase()
                    ?: return false

            return (
                host ==
                    "res.cloudinary.com" ||
                host.endsWith(
                    ".res.cloudinary.com"
                )
            )
        }
    }
}
