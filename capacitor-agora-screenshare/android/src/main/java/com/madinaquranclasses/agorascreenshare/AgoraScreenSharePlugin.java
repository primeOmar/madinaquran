package com.madinaquranclasses.agorascreenshare;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.util.Log;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

/**
 * AgoraScreenSharePlugin - Production Ready
 * 
 * Enables screen sharing functionality for Android using Agora RTC SDK.
 * This plugin handles:
 * - Screen capture permission requests
 * - Starting/stopping the screen share service
 * - Parameter validation and error handling
 * 
 * @version 1.0.0
 * @author Madina Quran Classes
 */
@CapacitorPlugin(name = "AgoraScreenShare")
public class AgoraScreenSharePlugin extends Plugin {
    
    private static final String TAG = "AgoraScreenShare";
    private static final int SCREEN_SHARE_REQUEST_CODE = 1954681310;
    
    /**
     * Starts the screen sharing process.
     * 
     * Expected parameters from JavaScript:
     * - appId (String): Agora App ID
     * - channelId (String): Agora channel name
     * - token (String): Agora token for authentication
     * - uid (Integer): Unique user ID for screen share (typically localUid + 10000)
     * 
     * Flow:
     * 1. Validates all required parameters
     * 2. Requests MediaProjection permission from user
     * 3. On permission grant, starts ScreenShareService
     */
    @PluginMethod
    public void startScreenShare(PluginCall call) {
        Log.d(TAG, "📱 startScreenShare called");
        
        // ✅ STEP 1: Extract and validate all parameters
        String appId = call.getString("appId");
        String channelId = call.getString("channelId");
        String token = call.getString("token");
        Integer uid = call.getInt("uid");
        
        // Validate required parameters
        if (appId == null || appId.isEmpty()) {
            Log.e(TAG, "❌ Missing or empty appId");
            call.reject("Missing required parameter: appId");
            return;
        }
        
        if (channelId == null || channelId.isEmpty()) {
            Log.e(TAG, "❌ Missing or empty channelId");
            call.reject("Missing required parameter: channelId");
            return;
        }
        
        if (token == null || token.isEmpty()) {
            Log.e(TAG, "❌ Missing or empty token");
            call.reject("Missing required parameter: token");
            return;
        }
        
        if (uid == null || uid <= 0) {
            Log.e(TAG, "❌ Missing or invalid uid");
            call.reject("Missing or invalid parameter: uid (must be > 0)");
            return;
        }
        
        Log.d(TAG, "✅ Parameters validated:");
        Log.d(TAG, "   - appId: " + appId.substring(0, 8) + "...");
        Log.d(TAG, "   - channelId: " + channelId);
        Log.d(TAG, "   - uid: " + uid);
        Log.d(TAG, "   - token length: " + token.length());
        
        // ✅ STEP 2: Save the call for use in callback
        saveCall(call);
        
        // ✅ STEP 3: Get MediaProjectionManager
        Context context = getContext();
        if (context == null) {
            Log.e(TAG, "❌ Context is null");
            call.reject("Internal error: Context not available");
            return;
        }
        
        MediaProjectionManager mpm = (MediaProjectionManager) context
                .getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        
        if (mpm == null) {
            Log.e(TAG, "❌ MediaProjectionManager not available");
            call.reject("Screen sharing not supported on this device");
            return;
        }
        
        // ✅ STEP 4: Request screen capture permission
        try {
            Intent permissionIntent = mpm.createScreenCaptureIntent();
            
            // This will trigger the Android system dialog asking user for permission
            // The result will be handled in handleScreenShareResult() callback
            startActivityForResult(call, permissionIntent, "handleScreenShareResult");
            
            Log.d(TAG, "🔐 Screen capture permission requested");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to request screen capture permission", e);
            call.reject("Failed to request screen capture permission: " + e.getMessage());
        }
    }
    
    /**
     * Stops the screen sharing service.
     * 
     * This method:
     * 1. Sends stop intent to ScreenShareService
     * 2. Service will handle cleanup (stop capture, leave channel, destroy engine)
     * 3. Returns success immediately
     */
    @PluginMethod
    public void stopScreenShare(PluginCall call) {
        Log.d(TAG, "🛑 stopScreenShare called");
        
        try {
            Context context = getContext();
            if (context == null) {
                Log.e(TAG, "❌ Context is null");
                call.reject("Internal error: Context not available");
                return;
            }
            
            // Send stop intent to service
            Intent serviceIntent = new Intent(context, ScreenShareService.class);
            context.stopService(serviceIntent);
            
            Log.d(TAG, "✅ Screen share service stop requested");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Screen sharing stopped successfully");
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error stopping screen share", e);
            call.reject("Failed to stop screen share: " + e.getMessage());
        }
    }
    
    /**
     * Callback method triggered after user responds to screen capture permission dialog.
     * 
     * This method name MUST match the string passed to startActivityForResult() above.
     * 
     * @param call The original plugin call (contains appId, channelId, token, uid)
     * @param result The activity result containing permission data
     */
    @ActivityCallback
    private void handleScreenShareResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "🎯 handleScreenShareResult - resultCode: " + result.getResultCode());
        
        // ✅ CHECK 1: Verify user granted permission
        if (result.getResultCode() != Activity.RESULT_OK) {
            Log.w(TAG, "⚠️ Screen capture permission denied by user");
            call.reject("Screen capture permission denied. Please grant permission to share your screen.");
            return;
        }
        
        // ✅ CHECK 2: Verify permission data is valid
        Intent permissionData = result.getData();
        if (permissionData == null) {
            Log.e(TAG, "❌ Permission data is null");
            call.reject("Screen capture permission data is invalid");
            return;
        }
        
        Log.d(TAG, "✅ Screen capture permission granted");
        
        // ✅ STEP 1: Extract Agora parameters from original call
        String appId = call.getString("appId");
        String channelId = call.getString("channelId");
        String token = call.getString("token");
        Integer uid = call.getInt("uid");
        
        // Validate parameters again (safety check)
        if (appId == null || channelId == null || token == null || uid == null) {
            Log.e(TAG, "❌ Parameters lost during permission flow");
            call.reject("Internal error: Parameters not preserved");
            return;
        }
        
        // ✅ STEP 2: Prepare intent for ScreenShareService
        try {
            Context context = getContext();
            if (context == null) {
                Log.e(TAG, "❌ Context is null");
                call.reject("Internal error: Context not available");
                return;
            }
            
            Intent serviceIntent = new Intent(context, ScreenShareService.class);
            
            // Pass permission data
            serviceIntent.putExtra("resultCode", result.getResultCode());
            serviceIntent.putExtra("data", permissionData);
            
            // Pass Agora parameters
            serviceIntent.putExtra("appId", appId);
            serviceIntent.putExtra("channelId", channelId);
            serviceIntent.putExtra("token", token);
            serviceIntent.putExtra("uid", uid);
            
            Log.d(TAG, "📦 Starting ScreenShareService with parameters:");
            Log.d(TAG, "   - appId: " + appId.substring(0, 8) + "...");
            Log.d(TAG, "   - channelId: " + channelId);
            Log.d(TAG, "   - uid: " + uid);
            
            // ✅ STEP 3: Start foreground service in an API-safe way
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.w(TAG, "startForegroundService failed, falling back to startService", e);
                try {
                    context.startService(serviceIntent);
                } catch (Exception ex) {
                    Log.e(TAG, "Failed to start ScreenShareService", ex);
                    call.reject("Failed to start screen sharing service: " + ex.getMessage());
                    return;
                }
            }
            
            Log.d(TAG, "✅ ScreenShareService started successfully");
            
            // ✅ STEP 4: Return success to JavaScript
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("status", "permission_granted");
            ret.put("message", "Screen sharing started successfully");
            ret.put("uid", uid); // Return the screen share UID for reference
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start ScreenShareService", e);
            call.reject("Failed to start screen sharing: " + e.getMessage());
        }
    }
    
    /**
     * Optional: Check if screen sharing is currently active.
     * This can be used by JavaScript to query the current state.
     */
    @PluginMethod
    public void isScreenSharing(PluginCall call) {
        // This would require maintaining state, which could be done via:
        // 1. SharedPreferences
        // 2. Static variable in ScreenShareService
        // 3. Checking if service is running
        
        // For now, return a simple response
        JSObject ret = new JSObject();
        ret.put("isSharing", false); // Update this based on actual state
        ret.put("message", "State checking not implemented yet");
        call.resolve(ret);
    }
    
    /**
     * Cleanup when plugin is destroyed.
     * Ensures screen sharing is stopped if still active.
     */
    @Override
    protected void handleOnDestroy() {
        Log.d(TAG, "🧹 Plugin destroyed, ensuring screen share is stopped");
        
        try {
            Context context = getContext();
            if (context != null) {
                Intent serviceIntent = new Intent(context, ScreenShareService.class);
                context.stopService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error during plugin cleanup", e);
        }
        
        super.handleOnDestroy();
    }
}