import Capacitor
import Foundation

@objc(NativeWebSocketPlugin)
public class NativeWebSocketPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeWebSocketPlugin"
    public let jsName = "NativeWebSocket"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStoredFingerprint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearStoredFingerprint", returnType: CAPPluginReturnPromise),
    ]

    private var manager: WebSocketManager?

    @objc func connect(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString)
        else {
            call.reject("Missing or invalid 'url' parameter")
            return
        }

        // Parse TLS options
        let tls = call.getObject("tls") ?? [:]
        let tlsOpts = TLSOptions(
            required: tls["required"] as? Bool ?? true,
            expectedFingerprint: tls["expectedFingerprint"] as? String,
            allowTOFU: tls["allowTOFU"] as? Bool ?? false,
            storeKey: tls["storeKey"] as? String
        )

        // Disconnect existing connection
        manager?.disconnect()

        let mgr = WebSocketManager(tlsOptions: tlsOpts)

        mgr.onOpen = { [weak self] in
            self?.notifyListeners("open", data: [:])
        }

        mgr.onMessage = { [weak self] text in
            self?.notifyListeners("message", data: ["data": text])
        }

        mgr.onClose = { [weak self] code, reason in
            var data: [String: Any] = ["code": code]
            if let reason { data["reason"] = reason }
            self?.notifyListeners("close", data: data)
        }

        mgr.onError = { [weak self] message in
            self?.notifyListeners("error", data: ["message": message])
        }

        mgr.onTLSFingerprint = { [weak self] fingerprint in
            self?.notifyListeners("tlsFingerprint", data: ["fingerprint": fingerprint])
        }

        self.manager = mgr
        let origin = call.getString("origin")
        mgr.connect(url: url, origin: origin)
        call.resolve()
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let data = call.getString("data") else {
            call.reject("Missing 'data' parameter")
            return
        }

        guard let mgr = manager else {
            call.reject("WebSocket is not connected")
            return
        }

        mgr.send(data)
        call.resolve()
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        manager?.disconnect()
        manager = nil
        call.resolve()
    }

    @objc func getStoredFingerprint(_ call: CAPPluginCall) {
        guard let storeKey = call.getString("storeKey") else {
            call.reject("Missing 'storeKey' parameter")
            return
        }

        let fingerprint = TLSCertificateStore.loadFingerprint(storeKey: storeKey)
        call.resolve(["fingerprint": fingerprint as Any])
    }

    @objc func clearStoredFingerprint(_ call: CAPPluginCall) {
        guard let storeKey = call.getString("storeKey") else {
            call.reject("Missing 'storeKey' parameter")
            return
        }

        TLSCertificateStore.clearFingerprint(storeKey: storeKey)
        call.resolve()
    }
}
