
import { useState, useEffect } from 'react';
import { makeApiRequest, supabase, testAuthentication } from '../lib/supabaseClient';

export default function ConnectionTest() {
  const [testResults, setTestResults] = useState([]);
  const [isTesting, setIsTesting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);

  const addTestResult = (testName, status, message, details = null) => {
    setTestResults(prev => [...prev, {
      testName,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runAllTests = async () => {
    setIsTesting(true);
    clearResults();

    try {
      // Test 1: Check Supabase Session
      addTestResult('Session Check', 'info', 'Checking Supabase session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        addTestResult('Session Check', 'error', `Session error: ${sessionError.message}`);
      } else if (!session) {
        addTestResult('Session Check', 'error', 'No active session found');
      } else {
        setSessionInfo({
          user: session.user.email,
          expires: session.expires_at,
          tokenLength: session.access_token?.length || 0
        });
        addTestResult('Session Check', 'success', `Session found for: ${session.user.email}`);
      }

      // Test 2: Check Backend Connectivity
      addTestResult('Backend Connectivity', 'info', 'Testing connection to backend...');
      try {
        const response = await fetch('https://madina-quran-backend.onrender.com/api/student/profile', {
          method: 'GET',
          headers: session ? {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          } : {}
        });
        
        if (response.ok) {
          addTestResult('Backend Connectivity', 'success', 'Backend is reachable');
        } else {
          addTestResult('Backend Connectivity', 'error', `Backend returned status: ${response.status}`);
        }
      } catch (error) {
        addTestResult('Backend Connectivity', 'error', `Cannot reach backend: ${error.message}`);
      }

      // Test 3: Test API Endpoints (only if session exists)
      if (session) {
        const endpoints = [
          { name: 'Stats', path: '/student/stats' },
          { name: 'Profile', path: '/student/profile' },
          { name: 'Teacher Check', path: '/student/teacher-check' },
          { name: 'Classes', path: '/student/classes' },
          { name: 'Assignments', path: '/student/assignments' },
          { name: 'Payments', path: '/student/payments' }
        ];

        for (const endpoint of endpoints) {
          addTestResult(endpoint.name, 'info', `Testing ${endpoint.path}...`);
          
          try {
            const startTime = Date.now();
            const response = await fetch(`https://madina-quran-backend.onrender.com/api${endpoint.path}`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            });
            const duration = Date.now() - startTime;

            if (response.ok) {
              const data = await response.json();
              addTestResult(
                endpoint.name, 
                'success', 
                `✅ Success (${duration}ms)`,
                { status: response.status, data: Object.keys(data) }
              );
            } else {
              const errorText = await response.text();
              addTestResult(
                endpoint.name, 
                'error', 
                `❌ Failed: ${response.status} ${response.statusText}`,
                { status: response.status, error: errorText.substring(0, 200) }
              );
            }
          } catch (error) {
            addTestResult(
              endpoint.name, 
              'error', 
              `❌ Request failed: ${error.message}`,
              { error: error.message }
            );
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Test 4: Test makeApiRequest function
      if (session) {
        addTestResult('makeApiRequest Function', 'info', 'Testing custom API function...');
        try {
          const result = await makeApiRequest('/student/profile');
          addTestResult(
            'makeApiRequest Function', 
            'success', 
            'Function works correctly',
            { data: result ? 'Received data' : 'No data' }
          );
        } catch (error) {
          addTestResult(
            'makeApiRequest Function', 
            'error', 
            `Function failed: ${error.message}`,
            { error: error.message }
          );
        }
      }

    } catch (error) {
      addTestResult('Test Suite', 'error', `Test suite crashed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const testWithoutAuth = async () => {
    setIsTesting(true);
    clearResults();

    addTestResult('No-Auth Test', 'info', 'Testing backend without authentication...');
    
    try {
      const response = await fetch('https://madina-quran-backend.onrender.com/api/student/stats');
      const text = await response.text();
      
      addTestResult(
        'No-Auth Test', 
        response.status === 401 ? 'success' : 'warning',
        `Response: ${response.status} ${response.statusText}`,
        { 
          status: response.status,
          contentType: response.headers.get('content-type'),
          responsePreview: text.substring(0, 300) 
        }
      );
    } catch (error) {
      addTestResult('No-Auth Test', 'error', `Request failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const checkLocalStorage = () => {
    addTestResult('Local Storage', 'info', 'Checking browser storage...');
    
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || key.includes('sb-')
    );
    
    const storageData = supabaseKeys.map(key => ({
      key,
      value: localStorage.getItem(key)?.substring(0, 100) + '...'
    }));
    
    addTestResult(
      'Local Storage', 
      'info', 
      `Found ${supabaseKeys.length} Supabase keys`,
      { keys: supabaseKeys, storageData }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔧 Connection Test Suite</h1>
        
        {/* Session Info */}
        {sessionInfo && (
          <div className="bg-blue-900/30 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-2">Current Session</h2>
            <pre className="text-sm">{JSON.stringify(sessionInfo, null, 2)}</pre>
          </div>
        )}

        {/* Control Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={runAllTests}
            disabled={isTesting}
            className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 px-4 py-3 rounded-lg font-semibold"
          >
            {isTesting ? '🔄 Testing...' : '🚀 Run Full Test Suite'}
          </button>
          
          <button
            onClick={testWithoutAuth}
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 px-4 py-3 rounded-lg font-semibold"
          >
            🔒 Test Without Auth
          </button>
          
          <button
            onClick={checkLocalStorage}
            className="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-lg font-semibold"
          >
            💾 Check Local Storage
          </button>
        </div>

        <button
          onClick={clearResults}
          className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg mb-4"
        >
          🗑️ Clear Results
        </button>

        {/* Results */}
        <div className="space-y-4">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                result.status === 'success' 
                  ? 'bg-green-900/20 border-green-500' 
                  : result.status === 'error' 
                  ? 'bg-red-900/20 border-red-500'
                  : result.status === 'warning'
                  ? 'bg-yellow-900/20 border-yellow-500'
                  : 'bg-blue-900/20 border-blue-500'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{result.testName}</h3>
                  <p className="text-sm opacity-80">{result.message}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  result.status === 'success' ? 'bg-green-700' :
                  result.status === 'error' ? 'bg-red-700' :
                  result.status === 'warning' ? 'bg-yellow-700' : 'bg-blue-700'
                }`}>
                  {result.status.toUpperCase()}
                </span>
              </div>
              
              {result.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm opacity-70">Details</summary>
                  <pre className="text-xs bg-black/30 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
              
              <div className="text-xs opacity-50 mt-1">
                {new Date(result.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Fix Suggestions */}
        {testResults.some(r => r.status === 'error') && (
          <div className="mt-8 p-4 bg-yellow-900/20 rounded-lg">
            <h3 className="font-semibold text-yellow-400 mb-2">💡 Quick Fix Suggestions</h3>
            <ul className="text-sm space-y-1">
              <li>• Check if backend URL is correct: https://madina-quran-backend.onrender.com</li>
              <li>• Verify CORS is enabled on your backend</li>
              <li>• Ensure environment variables are set in Vercel</li>
              <li>• Check if Supabase project URL and anon key are correct</li>
              <li>• Verify the user has a valid profile in the database</li>
            </ul>
          </div>
        )}

        {/* Environment Info */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-2">🌍 Environment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Frontend URL:</strong> {window.location.href}
            </div>
            <div>
              <strong>Backend URL:</strong> https://madina-quran-backend.onrender.com
            </div>
            <div>
              <strong>Supabase URL:</strong> {process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
            </div>
            <div>
              <strong>Supabase Key:</strong> {process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
