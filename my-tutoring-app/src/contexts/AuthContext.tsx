// contexts/AuthContext.tsx - FULLY UPDATED VERSION
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  student_id?: string;
  grade_level?: string;
  total_points?: number;
  current_streak?: number;
  badges?: string[];
  level?: number;
  created_at?: string;
  last_activity?: string;
  preferences?: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, gradeLevel?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Get the backend API URL
  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  };

  // Get auth token for API calls
  const getAuthToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  // Safe JSON parsing helper
  const safeParseJSON = async (response: Response) => {
    const text = await response.text();
    console.log('Backend response text:', text); // Debug log
    
    if (!text) {
      throw new Error('Empty response from server');
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse JSON response:', text);
      throw new Error(`Server returned invalid JSON: ${text.substring(0, 100)}...`);
    }
  };

  // Fetch user profile from your backend with improved error handling
  const fetchUserProfile = async (authToken: string): Promise<UserProfile | null> => {
    try {
      const apiUrl = getApiUrl();
      console.log('Fetching user profile from:', `${apiUrl}/api/user-profiles/profile`);
      
      const response = await fetch(`${apiUrl}/api/user-profiles/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Profile response status:', response.status);

      if (response.ok) {
        const profile = await safeParseJSON(response);
        console.log('Profile data:', profile);
        return profile;
      } else if (response.status === 404) {
        // User profile doesn't exist yet, this is normal for new users
        console.log('User profile not found, will be created automatically by backend');
        return null;
      } else if (response.status === 401) {
        // Handle authentication errors gracefully
        try {
          const errorData = await safeParseJSON(response);
          console.warn('Authentication issue:', errorData);
          
          // If email not verified, we can still proceed in development
          if (errorData.detail?.includes('Email not verified')) {
            console.log('Email not verified - continuing in development mode');
            return null; // Backend will create profile when needed
          }
          
          // For other auth errors, don't throw - let the app continue
          console.warn('Auth error when fetching profile:', errorData.detail);
          return null;
        } catch (parseError) {
          console.warn('Could not parse auth error response');
          return null;
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch user profile:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // Don't throw errors for profile fetching - let the app continue
      // The profile will be created when the user first accesses protected endpoints
      return null;
    }
  };

  // Refresh user profile
  const refreshUserProfile = async () => {
    if (!user) return;
    
    try {
      const token = await getAuthToken();
      if (token) {
        const profile = await fetchUserProfile(token);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      // Don't throw - just log the error
    }
  };

  // Register new user with improved error handling
  const register = async (email: string, password: string, displayName: string, gradeLevel?: string) => {
    try {
      const apiUrl = getApiUrl();
      const registerUrl = `${apiUrl}/api/auth/register`;
      
      console.log('Registering user at:', registerUrl);
      console.log('Registration data:', { email, display_name: displayName, grade_level: gradeLevel });

      // First register with your backend (which creates Firebase user)
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          grade_level: gradeLevel || 'K',
        }),
      });

      console.log('Registration response status:', response.status);
      console.log('Registration response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `Registration failed with status ${response.status}`;
        
        try {
          const errorData = await safeParseJSON(response);
          console.error('Registration error data:', errorData);
          
          // Handle specific error types
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              // Validation errors from Pydantic
              const validationErrors = errorData.detail.map((err: any) => {
                if (err.loc && err.msg) {
                  return `${err.loc.join('.')}: ${err.msg}`;
                }
                return err.msg || JSON.stringify(err);
              }).join(', ');
              errorMessage = `Validation error: ${validationErrors}`;
            } else {
              errorMessage = errorData.detail;
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If we can't parse the error, get the raw text
          const errorText = await response.text();
          console.error('Raw error response:', errorText);
          errorMessage = `Server error: ${errorText.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }

      const registrationResult = await safeParseJSON(response);
      console.log('Registration successful:', registrationResult);

      // Then sign in with Firebase (frontend)
      console.log('Signing in with Firebase...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Update display name if it wasn't set
      if (userCredential.user && displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      console.log('Firebase sign-in successful');

    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      } else if (error.message.includes('CORS')) {
        throw new Error('CORS error. Please check backend CORS configuration.');
      } else if (error.message.includes('TypeError: Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else {
        // Re-throw the error with the original message
        throw error;
      }
    }
  };

  // Login user with improved error handling
  const login = async (email: string, password: string) => {
    try {
      console.log('Logging in user:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide user-friendly error messages
      let userMessage = 'Login failed';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            userMessage = 'No account found with this email address';
            break;
          case 'auth/wrong-password':
            userMessage = 'Incorrect password';
            break;
          case 'auth/invalid-email':
            userMessage = 'Invalid email address';
            break;
          case 'auth/user-disabled':
            userMessage = 'This account has been disabled';
            break;
          case 'auth/too-many-requests':
            userMessage = 'Too many failed attempts. Please try again later';
            break;
          case 'auth/network-request-failed':
            userMessage = 'Network error. Please check your connection and try again';
            break;
          default:
            userMessage = error.message || 'Login failed';
        }
      } else {
        userMessage = error.message || 'Login failed';
      }
      
      throw new Error(userMessage);
    }
  };

  // Logout user with improved error handling
  const logout = async () => {
    try {
      // Call backend logout endpoint to revoke tokens
      const token = await getAuthToken();
      if (token) {
        const apiUrl = getApiUrl();
        try {
          const response = await fetch(`${apiUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            console.warn('Backend logout failed, but continuing with local logout');
          }
        } catch (error) {
          console.warn('Backend logout failed, proceeding with local logout:', error);
        }
      }
      
      // Sign out from Firebase
      await signOut(auth);
      setUserProfile(null);
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      // Still sign out locally even if backend call fails
      try {
        await signOut(auth);
        setUserProfile(null);
      } catch (firebaseError) {
        console.error('Firebase logout also failed:', firebaseError);
      }
    }
  };

  // Listen to auth state changes with improved error handling
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in, fetch their profile
        try {
          const token = await firebaseUser.getIdToken();
          const profile = await fetchUserProfile(token);
          setUserProfile(profile);
          
          // If no profile exists, it will be created automatically by the backend
          // when the user first accesses protected endpoints
          if (!profile) {
            console.log('No user profile found - will be created on first API call');
          }
        } catch (error) {
          console.error('Error setting up user profile:', error);
          // Don't prevent login if profile fetch fails
          setUserProfile(null);
        }
      } else {
        // User is signed out
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    login,
    register,
    logout,
    getAuthToken,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};