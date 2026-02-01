# Screen Share Debugging Guide - Production Ready

## Overview
This guide provides comprehensive logging and troubleshooting steps for the Android screen share feature.

## What Was Fixed

### 1. **Enhanced Logging in TeacherVideoCall.jsx**
- Added `logScreenShare()` helper function with timestamps
- Logs at every stage of screen share initialization:
  - Current SCREEN_SHARE_UID value
  - Fallback UID initialization from sessionInfo
  - UID validation (must be > 0)
  - Token fetch response
  - Native parameters before calling plugin
  - Success/failure messages

### 2. **Enhanced Error Handling**
- Catches `uid` parameter errors specifically
- Displays user-friendly error messages explaining what went wrong
- Includes current UID value in error messages for debugging

### 3. **Student-Side Logging in StudentVideoCall.jsx**
- Added `logScreenTrack()` helper function
- Logs when `user-published` events are received:
  - Received UID and mediaType
  - Expected screen UID calculation (teacherUid + 10000)
  - Whether the track was identified as screen share
  - Remote tracks map contents
- Logs when screen share stops (`user-unpublished`)

## Testing Steps

### Setup
1. Open Chrome DevTools or Android Logcat Monitor
2. Filter logs by: `SCREEN_SHARE` (both teacher and student side logs use this keyword)

### Test Procedure

#### Teacher Side
1. Start the teacher's video call
2. Open browser console (F12 → Console tab)
3. Look for logs like:
   ```
   [HH:MM:SS] 🎬 SCREEN_SHARE: Screen Share UID set to: 1009 (Teacher UID: 9)
   [HH:MM:SS] 🎬 SCREEN_SHARE: START: User clicked screen share button
   ```

4. Click the "Share Screen" button
5. **Expected logs** (in order):
   ```
   [HH:MM:SS] 🎬 SCREEN_SHARE: START: User clicked screen share button
   [HH:MM:SS] 🎬 SCREEN_SHARE: Current SCREEN_SHARE_UID: 1009
   [HH:MM:SS] 🎬 SCREEN_SHARE: Validated UID 1009 > 0: PASS
   [HH:MM:SS] 🎬 SCREEN_SHARE: Fetching screen token. Channel: class123, UID: 1009
   [HH:MM:SS] 🎬 SCREEN_SHARE: Token fetch SUCCESS. Token length: 387
   [HH:MM:SS] 🎬 SCREEN_SHARE: Native execution path...
   [HH:MM:SS] 🎬 SCREEN_SHARE: Native params: appId=..., channel=class123, uid=1009, token_length=387
   [HH:MM:SS] 🎬 SCREEN_SHARE: Native startScreenShare() call SUCCEEDED
   [HH:MM:SS] 🎬 SCREEN_SHARE: Screen share STARTED successfully
   ```

6. If error, look for:
   ```
   [HH:MM:SS] 🎬 SCREEN_SHARE: ERROR: Screen share failed: ...
   [HH:MM:SS] 🎬 SCREEN_SHARE: WARN: UID parameter error: SCREEN_SHARE_UID=1009
   ```

#### Student Side
1. Join the same video call as a student
2. Open browser console (F12 → Console tab)
3. Filter logs by: `SCREEN_TRACK_STUDENT`
4. Ask the teacher to start screen share
5. **Expected logs**:
   ```
   [HH:MM:SS] 📺 SCREEN_TRACK_STUDENT: user-published: uid=1009, mediaType=video
   [HH:MM:SS] 📺 SCREEN_TRACK_STUDENT: currentTeacherUid=9, expectedScreenUid=1009, isTeacherScreen=true
   [HH:MM:SS] 📺 SCREEN_TRACK_STUDENT: ✅ SCREEN DETECTED! Setting teacherScreenSharing=true for uid 1009
   [HH:MM:SS] 📺 SCREEN_TRACK_STUDENT: remoteTracks updated: now has keys [9, 1009]
   ```

6. If screen NOT detected:
   - Check if `currentTeacherUid` is correct (should be 9 in example)
   - Check if `expectedScreenUid` matches `uid` received (both should be 1009)
   - If mismatched, teacher's SCREEN_SHARE_UID is wrong

## Troubleshooting Guide

### Error: "uid:null" or "uid must be > 0"

**Cause:** SCREEN_SHARE_UID not set before screen share button clicked

**Debug Steps:**
1. Look for logs showing `SCREEN_SHARE_UID: null` when button clicked
2. Check if `joinChannel()` completed successfully
3. Verify `sessionState.sessionInfo?.uid` exists
   - Add breakpoint at line 950 in toggleScreenShare
   - Check `sessionState.sessionInfo` in console: `sessionState.sessionInfo?.uid`

**Fix:**
```javascript
// In joinChannel() around line 940
console.log("📡 Session joined. uid:", assignedUid);
console.log("📡 sessionState.sessionInfo:", sessionState.sessionInfo);

// If sessionInfo not updated yet, wait for state to propagate
await new Promise(resolve => setTimeout(resolve, 100));
SCREEN_SHARE_UID = Number(assignedUid) + 10000;
```

### Error: "Token fetch failed"

**Cause:** Backend API endpoint not returning token for screen share UID

**Debug Steps:**
1. Check network tab (F12 → Network)
2. Find POST request to `getScreenToken`
3. Verify payload: `{channel: "class123", uid: 1009}`
4. Check response status: should be 200
5. If 400/401/403:
   - UID value invalid for backend
   - Backend doesn't support screen share tokens
   - Authentication failed

**Fix:**
- Verify backend has screen share token endpoint
- Test with postman: `POST /api/screen-token?channel=test&uid=1009`

### Error: Student doesn't see screen share

**Debug Steps:**

1. **Teacher Side:**
   - Confirm logs show `startScreenShare() SUCCEEDED`
   - Check Android logcat: `adb logcat | grep -i screen`
   - Should see: `"Starting screen capture..."`, `"Joined screen channel successfully"`

2. **Student Side:**
   - Confirm logs show `uid=1009` received in user-published
   - Confirm `currentTeacherUid=9` (matches teacher's UID)
   - Confirm `expectedScreenUid=1009` (teacher + 10000)
   - Confirm `isTeacherScreen=true`

3. **If UID mismatch:**
   - Teacher side: `uid=50000` (random) instead of `1009`
   - **Cause:** `SCREEN_SHARE_UID` wasn't set before button click
   - **Fix:** Ensure `joinChannel()` completes before allowing screen share button

4. **If track not in remoteTracks:**
   - `user-published` event received but track not stored
   - Check if subscribe call failed (no await)
   - Verify mediaType is "video"

5. **If JSX not rendering screen:**
   - Check if `teacherScreenSharing` state is true
   - Check if `screenShareTrack?.video` exists
   - May be issue with display logic, not track reception

### Network Issues

**Symptoms:**
- Token fetch succeeds but screen never appears
- Teacher-side logs show success but student sees nothing
- 10-20 second delay before error

**Debug:**
1. Check network latency in DevTools Network tab
2. Verify both teacher and student on same network or properly routed
3. Check Agora dashboard for channel usage

**Fix:**
- Add retry logic for token fetch
- Add timeout handling for native plugin call
- Add fallback to test with web screen share (PC mode)

## Key Numbers

- **UID Range:** 1-2,147,483,647 (32-bit signed int)
- **Teacher UID:** Typically 1-100 (assigned by Agora)
- **Screen Share UID:** Teacher UID + 10000
  - Example: teacher=9 → screen=1009
- **Token Validity:** Usually 24 hours
- **Frame Rate:** 15fps (Android) to prevent CPU overheating
- **Resolution:** 720x1280 (portrait orientation)

## Production Checklist

- [ ] Screen share UID set in `joinChannel()` before button enabled
- [ ] Token fetch includes proper error handling
- [ ] Native parameters validated before plugin call
- [ ] Student logs confirm correct UID math
- [ ] Screen renders fullscreen when detected
- [ ] Screen share stops cleanly when teacher stops
- [ ] Logs disabled in production build (use environment variable)
- [ ] Test with multiple students simultaneously
- [ ] Test with teacher switching to/from screen multiple times
- [ ] Test on low-bandwidth network
- [ ] Test permission denial (user clicks "Don't Allow")

## Disabling Logs for Production

Add at top of component:

```javascript
const IS_DEBUG = process.env.NODE_ENV === 'development';

const logScreenShare = (level, msg) => {
  if (!IS_DEBUG) return; // Silent in production
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] 🎬 SCREEN_SHARE: ${msg}`);
};
```

## Additional Resources

- **Agora Docs:** https://docs.agora.io/en/Interactive%20Broadcast/screensharing_android
- **Capacitor Plugin:** [Local plugin location]
- **Test Channel:** Use dedicated testing channel to avoid production data
