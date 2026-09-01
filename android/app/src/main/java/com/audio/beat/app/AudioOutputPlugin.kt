package com.audio.beat.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "AudioOutput",
    permissions = [
        Permission(
            alias = "bluetoothConnect",
            strings = [Manifest.permission.BLUETOOTH_CONNECT]
        )
    ]
)
class AudioOutputPlugin : Plugin() {

    private lateinit var audioManager: AudioManager

    private val audioDeviceCallback =
        object : AudioDeviceCallback() {

            override fun onAudioDevicesAdded(
                addedDevices: Array<out AudioDeviceInfo>
            ) {
                emitCurrentState()
            }

            override fun onAudioDevicesRemoved(
                removedDevices: Array<out AudioDeviceInfo>
            ) {
                emitCurrentState()
            }
        }

    override fun load() {
        super.load()

        audioManager = context.getSystemService(
            Context.AUDIO_SERVICE
        ) as AudioManager

        audioManager.registerAudioDeviceCallback(
            audioDeviceCallback,
            null
        )
    }

    override fun handleOnDestroy() {
        if (::audioManager.isInitialized) {
            try {
                audioManager.unregisterAudioDeviceCallback(
                    audioDeviceCallback
                )
            } catch (_: Exception) {
                // The callback may already be unregistered.
            }
        }

        super.handleOnDestroy()
    }

    @PluginMethod
    fun getOutputDevices(call: PluginCall) {
        call.resolve(buildOutputState())
    }

    @PluginMethod
    fun requestBluetoothPermission(
        call: PluginCall
    ) {
        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.S
        ) {
            call.resolve(
                JSObject().apply {
                    put("granted", true)
                }
            )

            return
        }

        if (
            getPermissionState(
                "bluetoothConnect"
            ) == PermissionState.GRANTED
        ) {
            call.resolve(
                JSObject().apply {
                    put("granted", true)
                }
            )

            return
        }

        requestPermissionForAlias(
            "bluetoothConnect",
            call,
            "bluetoothPermissionResult"
        )
    }

    @PermissionCallback
    fun bluetoothPermissionResult(
        call: PluginCall
    ) {
        val granted =
            Build.VERSION.SDK_INT <
                    Build.VERSION_CODES.S ||
                    getPermissionState(
                        "bluetoothConnect"
                    ) == PermissionState.GRANTED

        call.resolve(
            JSObject().apply {
                put("granted", granted)
            }
        )

        emitCurrentState()
    }

    private fun emitCurrentState() {
        if (!::audioManager.isInitialized) {
            return
        }

        notifyListeners(
            "outputDevicesChanged",
            buildOutputState()
        )
    }

    /**
     * Returns only the selected external audio output.
     *
     * Built-in speaker, earpiece, telephony, unknown and
     * duplicate outputs are intentionally excluded.
     */
    private fun buildOutputState(): JSObject {
        val selectedDevice =
            findSelectedExternalOutput()

        val devices = JSArray()

        if (selectedDevice != null) {
            devices.put(
                deviceToJson(selectedDevice)
            )
        }

        return JSObject().apply {
            put("devices", devices)

            if (selectedDevice != null) {
                put(
                    "activeDevice",
                    deviceToJson(selectedDevice)
                )
            } else {
                put("activeDevice", null)
            }
        }
    }

    /**
     * Android 13+ can report the device anticipated to
     * receive media audio.
     *
     * Older Android versions fall back to currently
     * connected output devices.
     */
    private fun findSelectedExternalOutput():
            AudioDeviceInfo? {

        val routedDevices =
            getMediaRoutedDevices()
                .filter(::isExternalOutput)

        val allExternalDevices =
            audioManager.getDevices(
                AudioManager.GET_DEVICES_OUTPUTS
            )
                .filter(::isExternalOutput)

        /*
         * Prefer devices Android identifies for media
         * routing. Include all connected external outputs
         * as fallbacks because some manufacturers return
         * incomplete routing information.
         */
        val candidates =
            (routedDevices + allExternalDevices)
                .distinctBy { device ->
                    "${device.id}-${device.type}"
                }

        if (candidates.isEmpty()) {
            return null
        }

        /*
         * Bluetooth devices are preferred over wired,
         * USB and HDMI outputs.
         *
         * Among duplicated Bluetooth entries, prefer the
         * entry whose product name is not the phone model.
         */
        return candidates.minWithOrNull(
            compareBy<AudioDeviceInfo>(
                { deviceTypePriority(it.type) },
                { bluetoothNamePenalty(it) },
                { genericNamePenalty(it) },
                { safeProductName(it).lowercase() }
            )
        )
    }

    private fun getMediaRoutedDevices():
            List<AudioDeviceInfo> {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.TIRAMISU
        ) {
            return emptyList()
        }

        return try {
            val mediaAttributes =
                AudioAttributes.Builder()
                    .setUsage(
                        AudioAttributes.USAGE_MEDIA
                    )
                    .setContentType(
                        AudioAttributes
                            .CONTENT_TYPE_MUSIC
                    )
                    .build()

            audioManager
                .getAudioDevicesForAttributes(
                    mediaAttributes
                )
        } catch (_: SecurityException) {
            emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun deviceToJson(
        device: AudioDeviceInfo
    ): JSObject {
        val mappedType =
            mapDeviceType(device.type)

        return JSObject().apply {
            put(
                "id",
                buildDeviceId(device)
            )

            put(
                "name",
                displayName(device, mappedType)
            )

            put("type", mappedType)
            put("connected", true)
            put("active", true)

            put(
                "connection",
                connectionLabel(mappedType)
            )
        }
    }

    private fun buildDeviceId(
        device: AudioDeviceInfo
    ): String {
        val address =
            safeDeviceAddress(device)

        if (address.isNotBlank()) {
            return "android-audio-$address"
        }

        return "android-audio-${device.id}"
    }

    private fun safeDeviceAddress(
        device: AudioDeviceInfo
    ): String {
        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.P
        ) {
            return ""
        }

        if (
            isBluetoothType(device.type) &&
            !hasBluetoothConnectPermission()
        ) {
            return ""
        }

        return try {
            device.address
                ?.trim()
                .orEmpty()
        } catch (_: SecurityException) {
            ""
        } catch (_: Exception) {
            ""
        }
    }

    private fun safeProductName(
        device: AudioDeviceInfo
    ): String {
        if (
            isBluetoothType(device.type) &&
            !hasBluetoothConnectPermission()
        ) {
            return ""
        }

        return try {
            device.productName
                ?.toString()
                ?.trim()
                .orEmpty()
        } catch (_: SecurityException) {
            ""
        } catch (_: Exception) {
            ""
        }
    }

    private fun hasBluetoothConnectPermission():
            Boolean {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.S
        ) {
            return true
        }

        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun displayName(
        device: AudioDeviceInfo,
        mappedType: String
    ): String {
        val productName =
            safeProductName(device)

        if (isUsableAccessoryName(productName)) {
            return productName
        }

        return when (mappedType) {
            "headphones" ->
                "Bluetooth headphones"

            "bluetooth" ->
                "Bluetooth audio"

            "car" ->
                "Car audio"

            "wired" ->
                "Wired headphones"

            "usb" ->
                "USB audio"

            "hdmi" ->
                "HDMI audio"

            else ->
                "Audio output"
        }
    }

    /**
     * Prevents the phone model, generic Android labels and
     * blank values from being used as the accessory name.
     */
    private fun isUsableAccessoryName(
        name: String
    ): Boolean {
        if (name.isBlank()) {
            return false
        }

        val normalised =
            name.trim().lowercase()

        val phoneModel =
            Build.MODEL
                .trim()
                .lowercase()

        val phoneDevice =
            Build.DEVICE
                .trim()
                .lowercase()

        val phoneProduct =
            Build.PRODUCT
                .trim()
                .lowercase()

        if (
            normalised == phoneModel ||
            normalised == phoneDevice ||
            normalised == phoneProduct
        ) {
            return false
        }

        return normalised !in setOf(
            "unknown",
            "default",
            "audio output",
            "available audio output",
            "bluetooth",
            "bluetooth audio",
            "built-in audio",
            "speaker",
            "phone speaker",
            "phone earpiece"
        )
    }

    /**
     * Adds a penalty when Android exposes the phone model
     * as the Bluetooth output name.
     *
     * This makes "Immortal 121" win over "2201117TI".
     */
    private fun bluetoothNamePenalty(
        device: AudioDeviceInfo
    ): Int {
        if (!isBluetoothType(device.type)) {
            return 0
        }

        return if (
            isUsableAccessoryName(
                safeProductName(device)
            )
        ) {
            0
        } else {
            1
        }
    }

    private fun genericNamePenalty(
        device: AudioDeviceInfo
    ): Int {
        return if (
            isUsableAccessoryName(
                safeProductName(device)
            )
        ) {
            0
        } else {
            1
        }
    }

    /**
     * Only show outputs that represent an actual external
     * listening device.
     */
    private fun isExternalOutput(
        device: AudioDeviceInfo
    ): Boolean {
        return when (device.type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
            AudioDeviceInfo.TYPE_BLE_SPEAKER,

            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_LINE_ANALOG,
            AudioDeviceInfo.TYPE_LINE_DIGITAL,

            AudioDeviceInfo.TYPE_USB_DEVICE,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_ACCESSORY,

            AudioDeviceInfo.TYPE_HDMI,
            AudioDeviceInfo.TYPE_HDMI_ARC,
            AudioDeviceInfo.TYPE_HDMI_EARC -> true

            else -> false
        }
    }

    private fun mapDeviceType(
        type: Int
    ): String {
        return when (type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET ->
                "headphones"

            AudioDeviceInfo.TYPE_BLE_SPEAKER ->
                "bluetooth"

            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_LINE_ANALOG,
            AudioDeviceInfo.TYPE_LINE_DIGITAL ->
                "wired"

            AudioDeviceInfo.TYPE_USB_DEVICE,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_ACCESSORY ->
                "usb"

            AudioDeviceInfo.TYPE_HDMI,
            AudioDeviceInfo.TYPE_HDMI_ARC,
            AudioDeviceInfo.TYPE_HDMI_EARC ->
                "hdmi"

            else ->
                "unknown"
        }
    }

    private fun connectionLabel(
        type: String
    ): String {
        return when (type) {
            "headphones",
            "bluetooth",
            "car" ->
                "Connected via Bluetooth"

            "wired" ->
                "Connected by cable"

            "usb" ->
                "Connected by USB"

            "hdmi" ->
                "Connected by HDMI"

            else ->
                "Connected audio output"
        }
    }

    private fun isBluetoothType(
        type: Int
    ): Boolean {
        return when (type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
            AudioDeviceInfo.TYPE_BLE_SPEAKER -> true

            else -> false
        }
    }

    private fun deviceTypePriority(
        type: Int
    ): Int {
        return when (type) {
            /*
             * A2DP and BLE are preferred for music.
             * SCO is primarily a call/communication route.
             */
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
            AudioDeviceInfo.TYPE_BLE_SPEAKER -> 0

            AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> 1

            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_LINE_ANALOG,
            AudioDeviceInfo.TYPE_LINE_DIGITAL -> 2

            AudioDeviceInfo.TYPE_USB_DEVICE,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_ACCESSORY -> 3

            AudioDeviceInfo.TYPE_HDMI,
            AudioDeviceInfo.TYPE_HDMI_ARC,
            AudioDeviceInfo.TYPE_HDMI_EARC -> 4

            else -> 5
        }
    }
}