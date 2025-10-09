// src/lib/videoDebugHelper.js
async function debugAgoraConnection(meetingId, userId) {
  console.log('\n🔍 ===== AGORA CONNECTION DEBUG =====');
  
  try {
    // 1. Check videoApi module
    console.log('📦 Step 1: Checking videoApi module...');
    const videoApi = await import('./videoApi'); // Note: relative path changed
    console.log('✅ videoApi imported:', {
      hasDefault: !!videoApi.default,
      hasGenerateToken: typeof videoApi.default?.generateAgoraToken,
      hasEndSession: typeof videoApi.default?.endVideoSession
    });
    
    // 2. Generate token
    console.log('\n🎫 Step 2: Generating token...');
    const tokenData = await videoApi.default.generateAgoraToken(meetingId, userId);
    console.log('Token data received:', {
      hasAppId: !!tokenData.appId,
      appIdType: typeof tokenData.appId,
      appIdValue: tokenData.appId ? '***' + tokenData.appId.slice(-4) : 'UNDEFINED',
      appIdLength: tokenData.appId?.length || 0,
      hasToken: !!tokenData.token,
      isFallback: tokenData.isFallback,
      mode: tokenData.mode
    });
    
    // 3. Validate App ID
    console.log('\n✓ Step 3: Validating App ID...');
    if (!tokenData.appId) {
      throw new Error('❌ CRITICAL: tokenData.appId is undefined!');
    }
    if (typeof tokenData.appId !== 'string') {
      throw new Error(`❌ CRITICAL: appId is ${typeof tokenData.appId}, expected string`);
    }
    if (tokenData.appId.length !== 32) {
      throw new Error(`❌ CRITICAL: appId length is ${tokenData.appId.length}, expected 32`);
    }
    console.log('✅ App ID validation passed');
    
    // 4. Test Agora SDK
    console.log('\n🎮 Step 4: Testing Agora SDK...');
    const AgoraRTC = await import('agora-rtc-sdk-ng');
    console.log('✅ Agora SDK imported');
    
    // 5. Create client
    console.log('\n🏗️ Step 5: Creating Agora client...');
    const client = AgoraRTC.default.createClient({ 
      mode: 'rtc', 
      codec: 'h264' 
    });
    console.log('✅ Client created');
    
    // 6. Try to join (this is where it fails)
    console.log('\n🚀 Step 6: Attempting to join channel...');
    console.log('Join parameters:', {
      appId: tokenData.appId ? '***' + tokenData.appId.slice(-4) : 'UNDEFINED',
      channel: meetingId,
      token: tokenData.token ? 'present' : 'null',
      uid: userId
    });
    
    const uid = await client.join(
      tokenData.appId,
      meetingId,
      tokenData.token,
      userId
    );
    
    console.log('✅ Successfully joined! UID:', uid);
    
    // Clean up
    await client.leave();
    console.log('✅ Debug test complete\n');
    
    return { success: true, tokenData };
    
  } catch (error) {
    console.error('\n❌ DEBUG TEST FAILED:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return { success: false, error };
  }
}

export default debugAgoraConnection;
