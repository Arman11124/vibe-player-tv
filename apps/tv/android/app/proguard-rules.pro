# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# LibTorrent4j JNI Protection
-keep class org.libtorrent4j.** { *; }
-keep class com.frostwire.jlibtorrent.** { *; }

# TorrentModule JNI Protection
-keep class com.ottbrowser.TorrentModule { *; }
-keep class com.ottbrowser.TorrentPackage { *; }
-keep class com.ottbrowser.TorrentHttpServer { *; }

# React Native (General Safety)
-keep class com.facebook.react.** { *; }

