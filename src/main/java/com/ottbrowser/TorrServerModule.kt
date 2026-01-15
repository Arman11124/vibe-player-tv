package com.ottbrowser

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class TorrServerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "TorrServerModule"
    }

    @ReactMethod
    fun start() {
        try {
            val intent = Intent(reactContext, TorrService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun stop() {
        val intent = Intent(reactContext, TorrService::class.java)
        intent.action = "STOP"
        reactContext.startService(intent)
    }

    // Checking actual HTTP status is better done in JS. 
    // This is just a helper to trigger the service.
    @ReactMethod
    fun ensureRunning() {
        start()
    }
}
