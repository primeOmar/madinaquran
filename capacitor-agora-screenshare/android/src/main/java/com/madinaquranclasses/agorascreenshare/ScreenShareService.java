package com.madinaquranclasses.agorascreenshare;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

// ✅ ADD THESE AGORA IMPORTS
import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import io.agora.rtc2.ScreenCaptureParameters;
import io.agora.rtc2.video.VideoEncoderConfiguration;

public class ScreenShareService extends Service {
    private static final String TAG = "ScreenShareService";
    private static final String CHANNEL_ID = "screenshare_channel";
    private static final int NOTIFICATION_ID = 1;
    
    // ✅ ADD AGORA ENGINE
    private RtcEngine rtcEngine;
    private boolean isSharing = false;
    private int retryCount = 0;

    // store last params for retry
    private String lastAppId;
    private String lastChannelId;
    private String lastToken;
    private int lastUid;
    private int lastResultCode;
    private Intent lastData;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Log.e(TAG, "Intent is null, stopping service");
            stopSelf();
            return START_NOT_STICKY;
        }

        createNotificationChannel();
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Screen Sharing Active")
                .setContentText("Madina Quran is sharing your screen.")
                .setSmallIcon(android.R.drawable.ic_menu_share)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // ✅ EXTRACT ALL PARAMETERS FROM INTENT
        int resultCode = intent.getIntExtra("resultCode", -1);
        Intent data = intent.getParcelableExtra("data");
        String appId = intent.getStringExtra("appId");
        String channelId = intent.getStringExtra("channelId");
        String token = intent.getStringExtra("token");
        int uid = intent.getIntExtra("uid", 0);

        Log.d(TAG, "Screen share params - appId: " + appId + ", channel: " + channelId + ", uid: " + uid);

        // ✅ VALIDATE PARAMETERS
        if (data == null || appId == null || channelId == null) {
            Log.e(TAG, "❌ Invalid parameters - data: " + data + ", appId: " + appId + ", channel: " + channelId);
            stopSelf();
            return START_NOT_STICKY;
        }

        // store for potential retry
        lastAppId = appId;
        lastChannelId = channelId;
        lastToken = token;
        lastUid = uid;
        lastResultCode = resultCode;
        lastData = data;

        // ✅ START ACTUAL SCREEN SHARING
        startAgoraScreenShare(appId, channelId, token, uid, resultCode, data);

        return START_NOT_STICKY;
    }

    // ✅ THIS IS WHERE THE MAGIC HAPPENS
    private void startAgoraScreenShare(String appId, String channelId, String token, 
                                       int uid, int resultCode, Intent data) {
        try {
            Log.d(TAG, "🚀 Initializing Agora RTC Engine for screen share");

            // ✅ CREATE AND CONFIGURE AGORA ENGINE
            RtcEngineConfig config = new RtcEngineConfig();
            config.mContext = getApplicationContext();
            config.mAppId = appId;
            config.mEventHandler = new IRtcEngineEventHandler() {
                @Override
                public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
                    Log.d(TAG, "✅ Screen share joined channel: " + channel + " with UID: " + uid);
                    isSharing = true;
                }

                @Override
                public void onError(int err) {
                    Log.e(TAG, "❌ Agora error: " + err);
                    // handle error 110 (native engine failure) with a single retry
                    if (err == 110 && retryCount == 0) {
                        retryCount++;
                        Log.w(TAG, "⚠️ Agora error 110 detected — scheduling one retry");
                        cleanupEngine();
                        scheduleRetry();
                        return;
                    }

                    stopSelf(); // Stop service on other errors or after retry
                }

                @Override
                public void onLeaveChannel(RtcStats stats) {
                    Log.d(TAG, "📤 Left channel, duration: " + stats.totalDuration + "s");
                    isSharing = false;
                }

                @Override
                public void onRtcStats(RtcStats stats) {
                    // Optional: Log stats for debugging
                    Log.d(TAG, "📊 Bitrate: " + stats.txVideoKBitRate + " kbps");
                }
            };

            rtcEngine = RtcEngine.create(config);
            Log.d(TAG, "✅ RtcEngine created successfully");

            // ✅ CONFIGURE FOR LIVE BROADCASTING
            rtcEngine.setChannelProfile(Constants.CHANNEL_PROFILE_LIVE_BROADCASTING);
            rtcEngine.setClientRole(Constants.CLIENT_ROLE_BROADCASTER);
            
            // ✅ SET VIDEO QUALITY FOR SCREEN SHARE
            VideoEncoderConfiguration encoderConfig = new VideoEncoderConfiguration(
                VideoEncoderConfiguration.VD_1920x1080, // 1080p
                VideoEncoderConfiguration.FRAME_RATE.FRAME_RATE_FPS_15, // 15 fps is good for screen
                VideoEncoderConfiguration.STANDARD_BITRATE,
                VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_ADAPTIVE
            );
            rtcEngine.setVideoEncoderConfiguration(encoderConfig);
            Log.d(TAG, "✅ Video encoder configured: 1080p @ 15fps");

            // ✅ CONFIGURE SCREEN CAPTURE PARAMETERS
            ScreenCaptureParameters screenParams = new ScreenCaptureParameters();
            screenParams.videoCaptureParameters.width = 1920;
            screenParams.videoCaptureParameters.height = 1080;
            screenParams.videoCaptureParameters.framerate = 15;
            screenParams.videoCaptureParameters.bitrate = 2000; // 2 Mbps
            //screenParams.videoCaptureParameters.contentHint =
            //    ScreenCaptureParameters.VideoCaptureParameters.CONTENT_HINT_DETAILS; // For text clarity

            //  - START CAPTURING THE SCREEN
            rtcEngine.startScreenCapture(screenParams);
            Log.d(TAG, "✅ Screen capture started with MediaProjection");

            // ✅ JOIN THE AGORA CHANNEL
            int joinResult = rtcEngine.joinChannel(token, channelId, "", uid);
            if (joinResult == 0) {
                Log.d(TAG, "✅ Successfully joined channel: " + channelId + " with UID: " + uid);
            } else {
                Log.e(TAG, "❌ Failed to join channel, error code: " + joinResult);
                stopSelf();
            }

        } catch (Exception e) {
            Log.e(TAG, "❌ Fatal error starting screen share", e);
            stopSelf();
        }
    }

    private void scheduleRetry() {
        new Thread(() -> {
            try {
                Thread.sleep(500);
                Log.d(TAG, "🔁 Retrying Agora screen share initialization...");
                // retry with last known params
                startAgoraScreenShare(lastAppId, lastChannelId, lastToken, lastUid, lastResultCode, lastData);
            } catch (InterruptedException e) {
                Log.e(TAG, "Retry interrupted", e);
                stopSelf();
            }
        }).start();
    }

    private void cleanupEngine() {
        try {
            if (rtcEngine != null) {
                try { rtcEngine.stopScreenCapture(); } catch (Exception ignored) {}
                try { rtcEngine.leaveChannel(); } catch (Exception ignored) {}
                try { RtcEngine.destroy(); } catch (Exception ignored) {}
                rtcEngine = null;
                isSharing = false;
                Log.d(TAG, "♻️ Cleanup: Agora engine destroyed before retry");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error during engine cleanup", e);
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "🛑 ScreenShareService destroying");

        // ✅ CLEANUP AGORA RESOURCES
        if (rtcEngine != null) {
            if (isSharing) {
                try {
                    rtcEngine.stopScreenCapture();
                    Log.d(TAG, "✅ Screen capture stopped");
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping screen capture", e);
                }

                try {
                    rtcEngine.leaveChannel();
                    Log.d(TAG, "✅ Left channel");
                } catch (Exception e) {
                    Log.e(TAG, "Error leaving channel", e);
                }
            }

            // ✅ DESTROY ENGINE TO FREE RESOURCES
            RtcEngine.destroy();
            rtcEngine = null;
            Log.d(TAG, "✅ RtcEngine destroyed");
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID, 
                    "Screen Share Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Shows when screen sharing is active");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}