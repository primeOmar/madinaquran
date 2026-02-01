# Screen Share Debug Quick Reference

## Log Keywords
- **Teacher:** Search console for `SCREEN_SHARE`
- **Student:** Search console for `SCREEN_TRACK_STUDENT`

## Critical UID Math
```
SCREEN_SHARE_UID = TeacherUID + 10000
Example: Teacher joins with UID=9 → Screen share UID=1009
```

## Expected Flow

### Teacher Initiates Screen Share
```
1. joinChannel() → SCREEN_SHARE_UID = 9 + 10000 = 1009
2. Click "Share Screen" button
3. Fallback UID check (already set, skip)
4. Fetch token for UID 1009
5. Call AgoraScreenShare.startScreenShare({uid: 1009, ...})
6. Native service starts (check logcat on Android)
```

### Student Receives Screen Share
```
1. Agora fires user-published event with UID=1009
2. setupAgoraEventListeners() checks:
   expectedScreenUid = 9 + 10000 = 1009 ✓
   isTeacherScreen = (1009 === 1009) → TRUE ✓
3. setTeacherScreenSharing(true)
4. JSX renders screen fullscreen
```

## One-Liner Debugging in Console (Teacher)

```javascript
// Check current screen share UID
console.log("SCREEN_SHARE_UID:", window.__SCREEN_SHARE_UID__ || "NOT SET");

// Check session info
console.log("Session UID:", sessionState?.sessionInfo?.uid);
```

## One-Liner Debugging in Console (Student)

```javascript
// Check expected screen UID
const teacherUid = 9; // Replace with actual
console.log("Expected screen UID:", teacherUid + 10000);

// Check if remote tracks has screen
const remoteTracks = new Map(); // From component state
console.log("Remote UIDs:", Array.from(remoteTracks.keys()));
```

## Common Error Patterns

| Error | Meaning | Fix |
|-------|---------|-----|
| `uid must be > 0` | SCREEN_SHARE_UID is null/0 | Wait for joinChannel() to complete |
| `Token fetch failed` | Backend returned error | Check backend endpoint returns screen token |
| Screen not visible | Student doesn't get user-published event | Verify UID math: teacher_uid=9 → screen=1009 |
| Permission denied | User clicked "Don't Allow" on Android | App needs RECORD_AUDIO or CAPTURE_VIDEO permission in manifest |

## Key Variables to Watch

- `SCREEN_SHARE_UID` - must be set before toggleScreenShare() called
- `sessionState.sessionInfo?.uid` - teacher's UID from joinChannel()
- `currentTeacherUid` - student's reference to teacher UID
- `teacherScreenSharing` - boolean state controlling screen display

## Build & Test Commands

```bash
# Build Android
npm run android

# Test on device
npm run android:test

# View Android logs
adb logcat | grep -E "ScreenShare|uid"

# View web console (F12 on desktop/tablet)
# Filter: SCREEN_SHARE or SCREEN_TRACK_STUDENT
```

## Next Steps if Still Failing

1. **Teacher doesn't initiate:** Check button is clickable, no JS errors in console
2. **UID still null:** Add breakpoint at `toggleScreenShare()` line 1660, inspect sessionState
3. **Token fetch fails:** Test endpoint manually with Postman
4. **Student doesn't see:** Compare teacher UID (e.g., 9) with received UID (should be 1009)
5. **Permission error:** Check Android manifest includes required permissions

