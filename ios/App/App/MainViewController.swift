import UIKit
import Capacitor

/// The app's root screen. Capacitor already grants camera and microphone to the
/// web view (WebViewDelegationHandler answers requestMediaCapturePermissionFor
/// with .grant), so the system prompt is the only one people see. This subclass
/// only adds the shell plugin the offline page uses to try the hosted app again.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SameMoonShellPlugin())
    }
}

/// Lets the bundled offline page reload the hosted app, whose address only
/// native code knows (it comes from server.url in capacitor.config.json).
@objc(SameMoonShellPlugin)
class SameMoonShellPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "SameMoonShellPlugin"
    let jsName = "SameMoonShell"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "retry", returnType: CAPPluginReturnPromise)
    ]

    @objc func retry(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let bridge = self.bridge, let webView = bridge.webView else {
                call.reject("The web view is not ready.")
                return
            }
            webView.load(URLRequest(url: bridge.config.appStartServerURL))
            call.resolve()
        }
    }
}
