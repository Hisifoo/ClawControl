package com.capacitor.nativewebsocket

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@CapacitorPlugin(name = "NativeWebSocket")
class NativeWebSocketPlugin : Plugin() {

    private var manager: WebSocketManager? = null
    private var activeConnectionId: String? = null
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    @PluginMethod
    fun connect(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrEmpty()) {
            call.reject("Missing or invalid 'url' parameter")
            return
        }

        // Parse TLS options
        val tlsObj = call.getObject("tls", JSObject())!!
        val tlsOptions = TLSOptions(
            required = tlsObj.optBoolean("required", true),
            expectedFingerprint = tlsObj.optString("expectedFingerprint", null),
            allowTOFU = tlsObj.optBoolean("allowTOFU", false),
            storeKey = tlsObj.optString("storeKey", null),
        )

        val connectionId = call.getString("connectionId")
        val origin = call.getString("origin")

        executor.execute {
            // Disconnect existing connection
            manager?.disconnect()

            val mgr = WebSocketManager(context, tlsOptions)
            activeConnectionId = connectionId

            mgr.onOpen = {
                notifyListeners("open", JSObject().apply {
                    connectionId?.let { put("connectionId", it) }
                })
            }

            mgr.onMessage = { text ->
                notifyListeners("message", JSObject().apply {
                    put("data", text)
                    connectionId?.let { put("connectionId", it) }
                })
            }

            mgr.onClose = { code, reason ->
                notifyListeners("close", JSObject().apply {
                    put("code", code)
                    reason?.let { put("reason", it) }
                    connectionId?.let { put("connectionId", it) }
                })
            }

            mgr.onError = { message ->
                notifyListeners("error", JSObject().apply {
                    put("message", message)
                    connectionId?.let { put("connectionId", it) }
                })
            }

            mgr.onTLSFingerprint = { fingerprint ->
                notifyListeners("tlsFingerprint", JSObject().apply {
                    put("fingerprint", fingerprint)
                    connectionId?.let { put("connectionId", it) }
                })
            }

            manager = mgr
            mgr.connect(url, origin)
        }
        call.resolve()
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val data = call.getString("data")
        if (data == null) {
            call.reject("Missing 'data' parameter")
            return
        }

        val mgr = manager
        if (mgr == null) {
            call.reject("WebSocket is not connected")
            return
        }

        mgr.send(data)
        call.resolve()
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        executor.execute {
            manager?.disconnect()
            manager = null
        }
        call.resolve()
    }

    @PluginMethod
    fun getStoredFingerprint(call: PluginCall) {
        val storeKey = call.getString("storeKey")
        if (storeKey == null) {
            call.reject("Missing 'storeKey' parameter")
            return
        }

        val fingerprint = TLSCertificateStore.loadFingerprint(context, storeKey)
        call.resolve(JSObject().apply {
            put("fingerprint", fingerprint ?: JSObject.NULL)
        })
    }

    @PluginMethod
    fun clearStoredFingerprint(call: PluginCall) {
        val storeKey = call.getString("storeKey")
        if (storeKey == null) {
            call.reject("Missing 'storeKey' parameter")
            return
        }

        TLSCertificateStore.clearFingerprint(context, storeKey)
        call.resolve()
    }
}
