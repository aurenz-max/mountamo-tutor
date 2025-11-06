// contexts/AuthContext.tsx - FIXED VERSION
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  student_id: number;
  grade_level?: string;
  // Engagement & Progression System fields
  total_xp?: number;
  current_level?: number;
  xp_for_next_level?: number;
  current_streak?: number;
  longest_streak?: number;
  last_activity_date?: string;
  badges?: string[];
  // Legacy fields (backward compatibility)
  total_points?: number;
  level?: number;
  created_at?: string;
  last_activity?: string;
  preferences?: Record<string, any>;
  email_verified?: boolean;
  last_login?: string;
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
  updateUserProfile: (updates: Partial<UserProfile>) => void;
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

  console.log('🔄 AuthProvider render - State:', {
    hasUser: !!user,
    userEmail: user?.email,
    hasProfile: !!userProfile,
    loading,
    timestamp: new Date().toISOString()
  });

  const getApiUrl = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    console.log('🌐 API URL:', url);
    return url;
  }, []);

  // FIXED: Accept user parameter instead of relying on state
  const getAuthToken = useCallback(async (userParam?: User): Promise<string | null> => {
    const currentUser = userParam || user;
    console.log('🔑 getAuthToken called, user exists:', !!currentUser);

    if (!currentUser) {
      console.warn('❌ No user available for token generation');
      return null;
    }

    try {
      console.log('🎫 Calling Firebase getIdToken...');
      const token = await currentUser.getIdToken();
      console.log('✅ Token received:', {
        exists: !!token,
        length: token?.length || 0,
        preview: token?.substring(0, 20) + '...'
      });
      return token;
    } catch (error) {
      console.error('❌ Failed to get token:', error);
      return null;
    }
  }, [user]);

  // FIXED: Accept user parameter to avoid race condition
  const fetchUserProfile = useCallback(async (userParam: User): Promise<UserProfile | null> => {
    console.log('📊 Fetching user profile for:', userParam.email);

    try {
      const token = await getAuthToken(userParam);
      if (!token) {
        console.error('❌ No token available for profile fetch');
        return null;
      }

      const apiUrl = getApiUrl();
      const profileUrl = `${apiUrl}/api/user-profiles/profile`;

      console.log('🌐 Fetching from:', profileUrl);
      console.log('🔑 Using token preview:', token.substring(0, 20) + '...');

      const response = await fetch(profileUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📨 Profile response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const profile = await response.json();
        console.log('✅ Profile data received:', profile);

        // Ensure student_id is a number
        if (profile.student_id && typeof profile.student_id === 'string') {
          profile.student_id = parseInt(profile.student_id, 10);
        }

        return profile as UserProfile;
      } else if (response.status === 404) {
        console.log('ℹ️ Profile not found - will be created automatically');
        return null;
      } else {
        const errorText = await response.text();
        console.error('❌ Profile fetch failed:', {
          status: response.status,
          error: errorText
        });
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      return null;
    }
  }, [getAuthToken, getApiUrl]);

  const refreshUserProfile = useCallback(async () => {
    console.log('🔄 Refreshing user profile...');
    if (!user) return;

    try {
      const profile = await fetchUserProfile(user);
      setUserProfile(profile);
      console.log('✅ Profile refreshed');
    } catch (error) {
      console.error('❌ Error refreshing user profile:', error);
    }
  }, [user, fetchUserProfile]);

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    console.log('🔄 Updating user profile with:', updates);
    if (!userProfile) return;

    setUserProfile(prev => prev ? { ...prev, ...updates } : null);
    console.log('✅ Profile updated locally');
  }, [userProfile]);

  const register = async (email: string, password: string, displayName: string, gradeLevel?: string) => {
    try {
      console.log('📝 Registering user:', email);
      
      const apiUrl = getApiUrl();
      const registerUrl = `${apiUrl}/api/auth/register`;
      
      console.log('🌐 Registration URL:', registerUrl);

      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          grade_level: gradeLevel || 'K',
        }),
      });

      console.log('📨 Registration response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Registration failed:', errorData);
        throw new Error(errorData.detail || 'Registration failed');
      }

      console.log('✅ Backend registration successful, signing in...');
      
      // Sign in with Firebase
      await signInWithEmailAndPassword(auth, email, password);
      
      if (displayName) {
        await updateProfile(auth.currentUser!, { displayName });
      }
      
      console.log('✅ Registration complete');
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('🔑 Logging in user:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Login successful');
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out...');
      await signOut(auth);
      setUserProfile(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  // Auth state listener - set up immediately on component mount
  useEffect(() => {
    console.log('🎯 Setting up auth state listener immediately...');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔔 Auth state changed:', {
        hasUser: !!firebaseUser,
        userEmail: firebaseUser?.email,
        userUID: firebaseUser?.uid,
        emailVerified: firebaseUser?.emailVerified,
        timestamp: new Date().toISOString()
      });

      if (firebaseUser) {
        console.log('👤 User signed in, setting user state...');
        setUser(firebaseUser);

        console.log('📊 Fetching user profile with firebaseUser...');

        // Pass firebaseUser directly to avoid race condition
        try {
          const profile = await fetchUserProfile(firebaseUser);
          console.log('📊 Profile fetch result:', !!profile);
          setUserProfile(profile);
        } catch (error) {
          console.error('❌ Profile fetch error:', error);
          setUserProfile(null);
        } finally {
          console.log('✅ Setting loading to false');
          setLoading(false);
        }
      } else {
        console.log('👋 User signed out');
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth listener');
      unsubscribe();
    };
  }, []); // Empty dependency array - set up once on mount

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    login,
    register,
    logout,
    getAuthToken,
    refreshUserProfile,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};