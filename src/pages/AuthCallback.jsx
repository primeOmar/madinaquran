import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Checking authentication status...');

  // Function to ensure user profile exists
const ensureUserProfile = async (user) => {
  try {
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', user.id)
      .single();

    // If profile doesn't exist OR if it has the default name "Student"
    if (profileError || !profile || profile.name === 'Student') {
      // Get the actual name from user metadata (from registration)
      const userName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       (user.email ? user.email.split('@')[0] : 'User');
      
      // Create or update profile with correct name
      const { error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: userName, 
          role: user.user_metadata?.role || 'student',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Profile creation failed:', createError);
      } else {
        console.log('Profile created/updated with name:', userName);
      }
    }
  } catch (err) {
    console.error('Error ensuring user profile:', err);
  }
};


  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // First, check if we have a valid session already
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error('Failed to check authentication status');
        }

        // If user has a valid session, ensure profile exists and redirect
        if (session?.user) {
          console.log('User already authenticated, ensuring profile exists...');
          await ensureUserProfile(session.user);
          navigate('/dashboard', { replace: true });
          return;
        }

        // Check for OAuth tokens in hash fragment (Google, GitHub, etc.)
        const hash = window.location.hash.substring(1);
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');
          
          console.log('OAuth callback detected with tokens:', { 
            hasAccessToken: !!access_token, 
            hasRefreshToken: !!refresh_token 
          });

          if (access_token && refresh_token) {
            setStatus('Completing OAuth authentication...');
            
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token
            });

            if (sessionError) {
              console.error('Session setting error:', sessionError);
              throw new Error(`OAuth authentication failed: ${sessionError.message}`);
            }

            // Get the user after setting session
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
              console.error('User retrieval error:', userError);
            }

            if (user) {
              // Ensure profile exists for OAuth users
              await ensureUserProfile(user);
            }

            setStatus('OAuth authentication successful! Redirecting...');
            navigate('/dashboard', { replace: true });
            return;
          }
        }

        // Check if this is an email confirmation scenario
        // For email confirmation, the user should refresh and get session automatically
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (newSession?.user) {
          console.log('Email confirmation detected, ensuring profile exists...');
          await ensureUserProfile(newSession.user);
          navigate('/dashboard', { replace: true });
          return;
        }

        // Check query parameters for messages
        const message = searchParams.get('message');
        const errorParam = searchParams.get('error');
        
        if (message === 'email_confirmed') {
          setStatus('Email confirmed! Please log in with your credentials.');
          navigate('/login?message=email_confirmed', { replace: true });
          return;
        }

        if (errorParam) {
          throw new Error(decodeURIComponent(errorParam));
        }

        // If we get here with no session and no OAuth tokens, this page was accessed directly
        console.warn('Auth callback accessed directly without authentication parameters');
        setStatus('Redirecting to login...');
        navigate('/login', { replace: true });

      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message);
        setStatus('Authentication failed');
        
        setTimeout(() => {
          navigate('/login?error=' + encodeURIComponent(err.message), { replace: true });
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Status</h2>
          <p className="text-gray-600 mb-4">{status}</p>
        </div>
      </div>
    </div>
  );
}