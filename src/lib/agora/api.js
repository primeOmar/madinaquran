// lib/api.js - REACT VERSION
import axios from 'axios';

// Create axios instance with proper configuration
const api = axios.create({
  // Base URL will be handled per-request
  timeout: 15000, // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies if needed
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('❌ Response error:', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url
    });
    
    // Handle specific error cases
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      error.message = 'Network error. Please check your connection.';
    } else if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please try again.';
    } else if (error.response?.status === 404) {
      error.message = 'Service temporarily unavailable.';
    } else if (error.response?.status === 401) {
      error.message = 'Authentication required.';
      // Optionally redirect to login
      // window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      error.message = 'Server error. Please try again later.';
    }
    
    return Promise.reject(error);
  }
);

export default api;
