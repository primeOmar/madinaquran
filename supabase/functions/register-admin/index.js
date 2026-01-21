// supabase/functions/register-admin/index.js
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
  Deno.env.get('URL') ?? '',              
  Deno.env.get('SERVICE_ROLE_KEY') ?? ''  
);
    // Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Wait a moment to ensure user is fully created in auth.users
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the user exists in auth.users before creating profile
    const { data: userCheck, error: checkError } = await supabaseAdmin
      .from('auth.users')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (checkError || !userCheck) {
      return new Response(
        JSON.stringify({ error: 'Auth user not found after creation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the admin profile with role set to 'admin'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        { 
          id: authData.user.id, 
          email, 
          name: "Administrator", 
          role: 'admin' // Hardcoded as admin
        }
      ])

    if (profileError) {
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        message: 'Admin account created successfully', 
        userId: authData.user.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})