package com.ottbrowser

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.BufferedReader
import java.io.InputStreamReader

class TorrService : Service() {

    private var process: Process? = null
    private val CHANNEL_ID = "TorrServerChannel"
    private val NOTIFICATION_ID = 1337

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "STOP") {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, createNotification())
        
        if (process == null) {
            startTorrServer()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        process?.destroy()
        process = null
    }

    private fun startTorrServer() {
        Thread {
            try {
                // The HACK: Android extracts native libs to a specific folder. 
                // We access it directly to execute the binary.
                val libPath = applicationInfo.nativeLibraryDir + "/libtorrserver.so"
                val binary = File(libPath)
                
                if (!binary.exists()) {
                    println("[TorrService] Binary not found at $libPath")
                    return@Thread
                }

                if (!binary.canExecute()) {
                    binary.setExecutable(true)
                }

                val dataDir = filesDir.absolutePath + "/torrserver_data"
                File(dataDir).mkdirs()

                // Command: ./libtorrserver.so -d /data/... -p 8090
                val pb = ProcessBuilder(
                    libPath, 
                    "-d", dataDir, 
                    "-p", "8090" // Default port
                )
                
                // Redirect logs to logcat if needed, or consume them to prevent blocking
                pb.redirectErrorStream(true)
                
                process = pb.start()
                println("[TorrService] Started TorrServer at pid ${process?.toString()}")
                
                // Consume stdout to prevent buffer deadlock
                val reader = BufferedReader(InputStreamReader(process!!.inputStream))
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                   // Log specific lines if needed: println("[TorrServer] $line")
                }

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "TorrServer Engine",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VibePlayer Engine")
            .setContentText("P2P Daemon is active")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .build()
    }
}
