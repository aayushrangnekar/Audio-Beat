package com.audio.beat.app

import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import com.getcapacitor.BridgeActivity

@OptIn(UnstableApi::class)
class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MusicScannerPlugin::class.java)
        registerPlugin(VideoStoragePlugin::class.java)
        registerPlugin(AudioPlayerPlugin::class.java)
        registerPlugin(AudioOutputPlugin::class.java)
        registerPlugin(AndroidAutoLibraryPlugin::class.java)

        super.onCreate(savedInstanceState)
    }
}
