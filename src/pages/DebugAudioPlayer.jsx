import { useState, useEffect, useRef } from 'react';
import { getSecureAudioUrl, testAudioAccess } from './supabase';

const DebugAudioPlayer = ({ audioUrl, submissionId }) => {
  const [debugInfo, setDebugInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secureUrl, setSecureUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const debugAudio = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🔊 Audio Player Debug Start:', { audioUrl, submissionId });

        // Step 1: Test the original URL
        const testResult = await testAudioAccess(audioUrl);
        setDebugInfo(prev => ({ ...prev, directTest: testResult }));

        if (!testResult.accessible) {
          console.log('🔄 Original URL failed, trying secure URL...');
          
          // Step 2: Extract file path and get secure URL
          const urlParts = audioUrl.split('/assignment-audio/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            console.log('📁 Extracted file path:', filePath);
            
            const signedUrl = await getSecureAudioUrl(filePath);
            console.log('🔐 Secure URL generated:', signedUrl);
            
            if (signedUrl) {
              setSecureUrl(signedUrl);
              
              // Test the secure URL
              const secureTest = await testAudioAccess(signedUrl);
              setDebugInfo(prev => ({ ...prev, secureTest }));
            }
          }
        }

      } catch (err) {
        console.error('💥 Audio debug error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (audioUrl) {
      debugAudio();
    }
  }, [audioUrl, submissionId]);

  const handleAudioError = (e) => {
    const audioEl = e.target;
    console.error('🎵 Audio element error:', {
      error: audioEl.error,
      networkState: audioEl.networkState,
      readyState: audioEl.readyState,
      src: audioEl.src,
      currentTime: audioEl.currentTime,
      duration: audioEl.duration
    });
    
    setError(`Audio playback failed: ${audioEl.error?.message || 'Unknown error'}`);
  };

  const handleAudioLoad = (e) => {
    console.log('✅ Audio loaded successfully:', {
      duration: e.target.duration,
      src: e.target.src,
      readyState: e.target.readyState
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="text-sm text-blue-700">Testing audio access...</div>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold mb-2">Audio Player Debug</h3>
      
      {/* Debug Information */}
      <div className="mb-4 p-3 bg-white rounded border text-sm">
        <h4 className="font-medium mb-2">Debug Info:</h4>
        <pre className="text-xs overflow-auto max-h-32">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <h4 className="font-medium text-red-800 mb-1">Error:</h4>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Audio Player */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">
          {secureUrl ? 'Secure URL (Signed)' : 'Original URL'}
        </label>
        <audio
          ref={audioRef}
          controls
          className="w-full mt-2 rounded-lg"
          src={secureUrl || audioUrl}
          onError={handleAudioError}
          onLoadedData={handleAudioLoad}
          onCanPlayThrough={handleAudioLoad}
          preload="metadata"
          crossOrigin="anonymous"
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* URL Information */}
      <div className="text-xs text-gray-600 space-y-1">
        <div>
          <strong>Original URL:</strong> 
          <div className="truncate">{audioUrl}</div>
        </div>
        {secureUrl && (
          <div>
            <strong>Secure URL:</strong> 
            <div className="truncate">{secureUrl}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugAudioPlayer;
