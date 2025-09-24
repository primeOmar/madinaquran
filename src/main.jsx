// main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'  
import './index.css'
import App from './App.jsx'
import { AuthProvider } from "./components/AuthContext"



const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider> 
        <App />
        </AuthProvider> 
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
