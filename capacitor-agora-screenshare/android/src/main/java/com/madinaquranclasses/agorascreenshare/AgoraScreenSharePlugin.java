package com.madinaquranclasses.agorascreenshare;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;


@CapacitorPlugin(name = "AgoraScreenShare")
public class AgoraScreenSharePlugin extends Plugin {

    @PluginMethod
    public void startScreenShare(PluginCall call) {
        saveCall(call);
        MediaProjectionManager mpm = (MediaProjectionManager) getContext()
                .getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        
        if (mpm != null) {
            Intent intent = mpm.createScreenCaptureIntent();
            // Start activity and point to the callback method below
            startActivityForResult(call, intent, "handleScreenShareResult");
        } else {
            call.reject("Media Projection not supported on this device.");
        }
    }

    @PluginMethod
    public void stopScreenShare(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), ScreenShareService.class);
        getContext().stopService(serviceIntent);
        call.resolve();
    }

    // This method name MUST match the string passed to startActivityForResult above
    @ActivityCallback
    private void handleScreenShareResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            // Start the Foreground Service to show the notification
            Intent serviceIntent = new Intent(getContext(), ScreenShareService.class);
            serviceIntent.putExtra("resultCode", result.getResultCode());
            serviceIntent.putExtra("data", result.getData());
            
            getContext().startForegroundService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("status", "permission_granted");
            call.resolve(ret);
        } else {
            call.reject("Permission denied by user");
        }
    }
}