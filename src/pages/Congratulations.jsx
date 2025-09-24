import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Congratulations() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      // 1️⃣ Get hash fragment from URL (tokens)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          // 2️⃣ Save session in Supabase
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) console.error("Session Error:", error.message);
        }

        // 3️⃣ Clean the URL (remove hash fragment)
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 4️⃣ Get user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate("/"); 
      else setUser(user);
    };

    handleAuth();
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-100 p-4">
      <h1 className="text-4xl font-bold text-green-700 mb-4">🎉 Congratulations!</h1>
      <p className="text-gray-700 mb-6">Your account has been successfully created.</p>
      <button
        onClick={() => navigate("/dashboard")}
        className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
