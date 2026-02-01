package com.madinaquranclasses.videocall;

import androidx.activity.result.ActivityResult;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import io.agora.rtc2.ScreenCaptureParameters;
import io.agora.rtc2.video.VideoEncoderConfiguration;

@CapacitorPlugin(name = "AgoraScreenShare")
public class AgoraScreenSharePlugin extends Plugin {

    private static final String TAG = "AgoraScreenShare";
    private RtcEngine screenEngine;
    private boolean isSharing = false;

    @PluginMethod
    public void startScreenShare(PluginCall call) {
        String appId = call.getString("appId");
        if (appId == null) {
            call.reject("Missing appId");
            return;
        }

        try {
            if (screenEngine == null) {
                RtcEngineConfig config = new RtcEngineConfig();
                config.mContext = getContext();
                config.mAppId = appId;
                config.mEventHandler = new IRtcEngineEventHandler() {
                    @Override
                    public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
                        Log.d(TAG, "Screen share joined: " + channel);
                    }

                    @Override
                    public void onError(int err) {
                        Log.e(TAG, "Screen share error: " + err);
                    }
                };

                screenEngine = RtcEngine.create(config);
                screenEngine.setChannelProfile(Constants.CHANNEL_PROFILE_LIVE_BROADCASTING);
                screenEngine.setClientRole(Constants.CLIENT_ROLE_BROADCASTER);

                VideoEncoderConfiguration encoderConfig = new VideoEncoderConfiguration(
                        new VideoEncoderConfiguration.VideoDimensions(1280, 720),
                        VideoEncoderConfiguration.FRAME_RATE.FRAME_RATE_FPS_15,
                        VideoEncoderConfiguration.STANDARD_BITRATE,
                        VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_ADAPTIVE
                );
                screenEngine.setVideoEncoderConfiguration(encoderConfig);
            }

            Activity activity = getActivity();
            MediaProjectionManager manager = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            Intent intent = manager.createScreenCaptureIntent();

            // Save the call so we can access appId/token in the callback
            saveCall(call);
            startActivityForResult(call, intent, "handleScreenSharePermission");

        } catch (Exception e) {
            Log.e(TAG, "Error starting screen share", e);
            call.reject(e.getMessage());
        }
    }

    @ActivityCallback
    private void handleScreenSharePermission(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Permission denied");
            return;
        }

        try {
            String token = call.getString("token");
            String channelId = call.getString("channelId");
            Integer uid = call.getInt("uid", 0);

            // 1. Setup Parameters (Note: Agora 4.x uses sub-parameters)
            ScreenCaptureParameters params = new ScreenCaptureParameters();
            params.captureVideo = true;
            params.captureAudio = false; // Set true if you want to share system audio

            params.videoCaptureParameters.width = 1280;
            params.videoCaptureParameters.height = 720;
            params.videoCaptureParameters.framerate = 15;

            // 2. FIX: Call with ONLY one parameter (params)
            // The Intent from 'result.getData()' is handled internally by the SDK
            screenEngine.startScreenCapture(params);

            // 3. Join the channel
            screenEngine.joinChannel(token, channelId, "", uid);

            isSharing = true;
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Callback error", e);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void stopScreenShare(PluginCall call) {
        stopScreenShareInternal();
        call.resolve();
    }

    private void stopScreenShareInternal() {
        if (screenEngine != null && isSharing) {
            screenEngine.stopScreenCapture();
            screenEngine.leaveChannel();
            isSharing = false;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopScreenShareInternal();
        if (screenEngine != null) {
            RtcEngine.destroy();
            screenEngine = null;
        }
        super.handleOnDestroy();
    }
}