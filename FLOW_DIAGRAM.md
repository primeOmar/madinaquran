# Screen Share Flow Diagram

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          INITIALIZATION PHASE                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

TEACHER                                             STUDENT
────────────────────────────────────────────────────────────────

1. joinChannel()
   ├─ Connect to Agora
   ├─ Receive assignedUid = 9
   ├─ SET: SCREEN_SHARE_UID = 9 + 10000 = 1009
   └─ ✓ Log: "Screen Share UID set to 1009"
   
   [Both in same channel]
   
                                           1. joinChannel()
                                              ├─ Connect to Agora
                                              ├─ Receive assignedUid = 1
                                              ├─ Store: currentTeacherUid = 9
                                              └─ ✓ Ready to receive

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SCREEN SHARE START PHASE                                │
└─────────────────────────────────────────────────────────────────────────────────┘

2. User clicks "Share Screen"
   │
   ├─ ✓ Log: "START: User clicked screen share button"
   │
   ├─ Check: SCREEN_SHARE_UID = 1009 ✓
   │  ✓ Log: "Current SCREEN_SHARE_UID: 1009"
   │
   ├─ Validate: 1009 > 0 ✓
   │  ✓ Log: "Validated UID 1009 > 0: PASS"
   │
   ├─ Fetch token for UID=1009
   │  ├─ POST to backend: {channel: "class_123", uid: 1009}
   │  ├─ Backend generates token for screen share UID
   │  └─ ✓ Log: "Token fetch SUCCESS. Token length: 387"
   │
   ├─ Prepare native parameters:
   │  ├─ appId: "a1b2c3d4e5f6..."
   │  ├─ channelId: "class_123"
   │  ├─ uid: 1009
   │  ├─ token: "..." (valid token for UID 1009)
   │  └─ ✓ Log: "Native params: uid=1009, ..."
   │
   └─ Call AgoraScreenShare.startScreenShare()
      │
      └─ Android Native Layer
         ├─ ✓ Validate uid=1009 > 0
         ├─ Create new Agora RTC engine (separate from main camera)
         ├─ Start MediaProjection (screen capture service)
         ├─ Join channel with uid=1009
         ├─ Join channel as screen publisher
         └─ Publish screen video stream

   ✓ Log: "Native startScreenShare() call SUCCEEDED"
   ✓ Log: "Screen share STARTED successfully"

┌─────────────────────────────────────────────────────────────────────────────────┐
│                      STUDENT RECEIVES PHASE                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

                                           3. Agora fires user-published event
                                              ├─ UID: 1009
                                              ├─ mediaType: "video"
                                              └─ Subscribe to track
                                              
                                           4. setupAgoraEventListeners()
                                              ├─ ✓ Log: "user-published: uid=1009"
                                              │
                                              ├─ Calculate expected screen UID
                                              │  └─ 9 + 10000 = 1009 ✓
                                              │
                                              ├─ Compare:
                                              │  └─ isTeacherScreen = (1009 === 1009) = TRUE ✓
                                              │
                                              ├─ ✓ Log: "✅ SCREEN DETECTED!"
                                              │
                                              ├─ Set: teacherScreenSharing = TRUE
                                              │
                                              └─ Store in remoteTracks map
                                                 └─ remoteTracks[1009] = screenVideoTrack
                                              
                                           5. JSX Render Check
                                              ├─ teacherScreenSharing === TRUE ✓
                                              ├─ screenShareTrack?.video exists ✓
                                              └─ Render fullscreen with:
                                                 "LIVE: TEACHER'S SCREEN" badge
                                                 + video element showing teacher's screen

┌─────────────────────────────────────────────────────────────────────────────────┐
│                      SCREEN SHARE STOP PHASE                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

TEACHER: User clicks "Stop Screen Share"          STUDENT: Automatically detects
         │                                                  │
         ├─ Call AgoraScreenShare.stopScreenShare()       │
         │  └─ Native: Stop MediaProjection               │
         │     Leave screen channel                       │
         │                                                 ├─ Agora fires user-unpublished
         │                                                 │  event with UID=1009
         │                                                 │
         │                                                 ├─ ✓ Log: "user-unpublished: uid=1009"
         │                                                 │
         │                                                 ├─ Recognize as screen share
         │                                                 │  ✓ Log: "❌ SCREEN STOPPED!"
         │                                                 │
         │                                                 ├─ Set: teacherScreenSharing = FALSE
         │                                                 │
         └─ Set: isScreenSharing = FALSE                  ├─ Remove from remoteTracks[1009]
                                                          │
                                                          └─ JSX auto-updates
                                                             Render teacher camera face
                                                             (or "Waiting for teacher...")

```

## UID Calculation Verification

```
                    SCREEN SHARE UID FORMULA
                    ========================
    
    SCREEN_SHARE_UID = TeacherUID + 10000
    
    
    EXAMPLE SCENARIOS:
    ──────────────────
    
    Teacher UID  │ Screen UID  │ Student Recognizes?
    ─────────────┼─────────────┼────────────────────
         1       │    10001    │ YES (1 + 10000)
         5       │    10005    │ YES (5 + 10000)
         9       │    10009    │ YES (9 + 10000)
        99       │    10099    │ YES (99 + 10000)
        
        
    WRONG SCENARIOS:
    ────────────────
    
    ❌ Teacher UID = 9, Screen UID = 50000
       Student expects: 9 + 10000 = 10009
       Mismatch! Student doesn't recognize
       
    ❌ Teacher UID = 9, Screen UID = null
       Student expects: 9 + 10000 = 10009
       No UID received! Error in native layer
```

## Error Prevention Flowchart

```
START: User clicks "Share Screen"
       │
       ▼
   ┌─────────────────────────────────────────┐
   │ Check: Is SCREEN_SHARE_UID set?        │
   │ Current value: __________ (from logs)   │
   └─────────────────────────────────────────┘
       │
       ├─ YES (e.g., 1009)
       │   └─ Continue ✓
       │
       └─ NO (null/undefined)
           │
           ▼
       ┌─────────────────────────────────────────┐
       │ Fallback: Check sessionState.uid       │
       │ Value: __________ (check in console)    │
       └─────────────────────────────────────────┘
           │
           ├─ EXISTS (e.g., 9)
           │   ├─ Calculate: 9 + 10000 = 1009
           │   └─ Continue ✓
           │
           └─ MISSING (null/undefined)
               │
               ▼
           ┌─────────────────────────────────────────┐
           │ ERROR: "UID not available"              │
           │ CAUSE: joinChannel() hasn't completed   │
           │ FIX: Wait for teacher to fully join     │
           └─────────────────────────────────────────┘

       │
       ▼
   ┌─────────────────────────────────────────┐
   │ Validate: UID > 0?                     │
   │ (e.g., 1009 > 0 = YES)                 │
   └─────────────────────────────────────────┘
       │
       ├─ YES
       │   └─ Continue ✓
       │
       └─ NO
           └─ ERROR: Show to user
   
       │
       ▼
   ┌─────────────────────────────────────────┐
   │ Fetch Token from Backend                │
   │ POST: {channel, uid: 1009}              │
   └─────────────────────────────────────────┘
       │
       ├─ SUCCESS: Token received
       │   └─ Continue ✓
       │
       └─ FAILED: Backend error (400/401/403)
           └─ ERROR: "Token fetch failed"
   
       │
       ▼
   ┌─────────────────────────────────────────┐
   │ Call Native Plugin                      │
   │ startScreenShare({uid: 1009, ...})      │
   └─────────────────────────────────────────┘
       │
       ├─ SUCCESS: Foreground service started
       │   └─ Students receive user-published ✓
       │
       └─ FAILED: Android permission/error
           └─ ERROR: Show to user

END: Screen sharing active or error shown
```

## Log Collection for Debugging

### Teacher Console Logs
```javascript
// Open F12, go to Console tab
// Type in console:
copy(document.querySelector('body').innerText
  .split('\n')
  .filter(l => l.includes('SCREEN_SHARE'))
  .join('\n'))
// Paste to support ticket

// Or manually:
// 1. Look for all lines with 🎬 SCREEN_SHARE
// 2. Copy timestamp and message
// 3. Note exact error if present
```

### Student Console Logs
```javascript
// Open F12, go to Console tab
// Type in console:
copy(document.querySelector('body').innerText
  .split('\n')
  .filter(l => l.includes('SCREEN_TRACK_STUDENT'))
  .join('\n'))
// Paste to support ticket

// Specifically look for:
// ✓ Did user-published event arrive with uid=1009?
// ✓ Did student recognize it as screen (isTeacherScreen=true)?
// ✓ Did remoteTracks map get updated?
```

### Android Logcat (Native Layer)
```bash
# Collect logs during screen share attempt
adb logcat -c  # Clear previous
# [Now click Share Screen]
adb logcat | grep -E "ScreenShare|startScreenCapture|uid|error" > debug.log

# Check for:
# - "Starting screen capture..."
# - "Screen capture started successfully"
# - "uid validation passed"
# - No errors about "uid must be > 0"
```

