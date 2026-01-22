package com.madinaquranclasses.videocall;

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
import com.getcapacitor.annotation.Permission;
import io.agora.rtc2.ScreenCaptureParameters; // Ensure Agora SDK is in your dependencies

@CapacitorPlugin(name = "AgoraScreenshare")
public class AgoraScreensharePlugin extends Plugin {
    private static final int REQUEST_CODE_SCREEN_SHARE = 1001;

    @PluginMethod
    public void startScreenShare(PluginCall call) {
        saveCall(call); // Save the promise to resolve it later
        
        MediaProjectionManager mpm = (MediaProjectionManager) getContext()
                .getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        
        if (mpm != null) {
            // This triggers the Android "Start Recording?" popup
            Intent intent = mpm.createScreenCaptureIntent();
            startActivityForResult(call, intent, "handleOnActivityResult");
        } else {
            call.reject("MediaProjectionManager not available");
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        PluginCall savedCall = getSavedCall();

        if (resultCode == Activity.RESULT_OK && data != null) {
            // 1. Start the Foreground Service (for the notification)
            Intent serviceIntent = new Intent(getContext(), ScreenShareService.class);
            serviceIntent.putExtra("resultCode", resultCode);
            serviceIntent.putExtra("data", data);
            getContext().startForegroundService(serviceIntent);

            // 2. Resolve the JS promise
            JSObject ret = new JSObject();
            ret.put("status", "permission_granted");
            savedCall.resolve(ret);
        } else {
            savedCall.reject("User cancelled screen share permission");
        }
    }

    @PluginMethod
    public void stopScreenShare(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ScreenShareService.class));
        call.resolve();
    }
}