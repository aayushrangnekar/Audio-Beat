package com.audio.beat.app

import android.content.Context
import androidx.car.app.connection.CarConnection
import androidx.lifecycle.Observer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AndroidAutoLibrary")
class AndroidAutoLibraryPlugin : Plugin() {

    companion object {
        const val PREFERENCES_NAME =
            "audio_beat_android_auto"

        const val LIBRARY_JSON_KEY =
            "library_json"
    }

    private var carConnection:
            CarConnection? = null

    private var lastConnectionType =
        CarConnection.CONNECTION_TYPE_NOT_CONNECTED

    private val connectionObserver =
        Observer<Int> { connectionType ->
            lastConnectionType =
                connectionType ?:
                CarConnection.CONNECTION_TYPE_NOT_CONNECTED

            notifyListeners(
                "connectionStateChanged",
                buildConnectionState(
                    lastConnectionType
                ),
                true
            )
        }

    override fun load() {
        super.load()

        val connection =
            CarConnection(
                context
            )

        carConnection =
            connection

        connection.type.observeForever(
            connectionObserver
        )
    }

    override fun handleOnDestroy() {
        carConnection
            ?.type
            ?.removeObserver(
                connectionObserver
            )

        carConnection = null

        super.handleOnDestroy()
    }

    @PluginMethod
    fun syncLibrary(
        call: PluginCall
    ) {
        val library =
            call.getObject(
                "library"
            )

        if (library == null) {
            call.reject(
                "Android Auto library data is required."
            )
            return
        }

        context
            .getSharedPreferences(
                PREFERENCES_NAME,
                Context.MODE_PRIVATE
            )
            .edit()
            .putString(
                LIBRARY_JSON_KEY,
                library.toString()
            )
            .apply()

        call.resolve(
            JSObject().apply {
                put(
                    "synced",
                    true
                )
            }
        )
    }

    @PluginMethod
    fun getConnectionState(
        call: PluginCall
    ) {
        val currentType =
            carConnection
                ?.type
                ?.value
                ?: lastConnectionType

        lastConnectionType =
            currentType

        call.resolve(
            buildConnectionState(
                currentType
            )
        )
    }

    private fun buildConnectionState(
        connectionType: Int
    ): JSObject {
        val type =
            when (
                connectionType
            ) {
                CarConnection.CONNECTION_TYPE_PROJECTION ->
                    "projection"

                CarConnection.CONNECTION_TYPE_NATIVE ->
                    "native"

                CarConnection.CONNECTION_TYPE_NOT_CONNECTED ->
                    "none"

                else ->
                    "unknown"
            }

        return JSObject().apply {
            put(
                "connected",
                connectionType ==
                        CarConnection.CONNECTION_TYPE_PROJECTION ||
                        connectionType ==
                        CarConnection.CONNECTION_TYPE_NATIVE
            )

            put(
                "projection",
                connectionType ==
                        CarConnection.CONNECTION_TYPE_PROJECTION
            )

            put(
                "connectionType",
                type
            )
        }
    }
}
