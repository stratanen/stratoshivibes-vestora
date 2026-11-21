package com.example.webshell

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

/**
 * Lets the Vestora page use the camera (to scan a wallet QR code) and pick an image file.
 * The web shell template blocks both by default. Only the camera (never the microphone) is granted,
 * and only to pages on stratoshivibes.com. The camera image stays on the device.
 */
object CameraBridge {
    @JvmField
    var activity: ComponentActivity? = null
    private var counter = 0

    fun handlePermission(request: PermissionRequest) {
        val act = activity
        val host = request.origin.host ?: ""
        val trusted = host == "stratoshivibes.com" || host.endsWith(".stratoshivibes.com")
        val wantsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
        if (act == null || !trusted || !wantsCamera) {
            request.deny()
            return
        }
        val camera = arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
        if (ContextCompat.checkSelfPermission(act, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(camera)
            return
        }
        act.runOnUiThread {
            val key = "vestora-camera-permission-" + (counter++)
            val holder = arrayOfNulls<ActivityResultLauncher<String>>(1)
            holder[0] =
                act.activityResultRegistry.register(key, ActivityResultContracts.RequestPermission()) { granted ->
                    if (granted) request.grant(camera) else request.deny()
                    holder[0]?.unregister()
                }
            holder[0]?.launch(Manifest.permission.CAMERA)
        }
    }

    fun handleChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams,
    ): Boolean {
        val act = activity ?: return false
        val key = "vestora-file-chooser-" + (counter++)
        val holder = arrayOfNulls<ActivityResultLauncher<Intent>>(1)
        holder[0] =
            act.activityResultRegistry.register(key, ActivityResultContracts.StartActivityForResult()) { result ->
                callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
                holder[0]?.unregister()
            }
        return try {
            holder[0]?.launch(params.createIntent())
            true
        } catch (e: Exception) {
            holder[0]?.unregister()
            callback.onReceiveValue(null)
            true
        }
    }
}
