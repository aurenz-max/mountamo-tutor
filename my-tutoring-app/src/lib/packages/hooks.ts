// lib/packages/hooks.ts - REFACTORED TO USE AUTHAPI
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';
import type { PackageFilters, PackageCard, ContentPackage } from './types';

interface UsePackagesResult {
  packages: PackageCard[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function usePackages(filters: PackageFilters = {}): UsePackagesResult {
  const { user, loading: authLoading } = useAuth();
  const [packages, setPackages] = useState<PackageCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPackages = useCallback(async () => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, skipping package fetch');
      return;
    }

    if (!user) {
      console.log('❌ No authenticated user, skipping package fetch');
      setError('Authentication required');
      setLoading(false);
      return;
    }

    console.log('📦 Fetching packages with filters:', filters);
    setLoading(true);
    setError(null);

    try {
      // Use the same authApi that works for curriculum
      const result = await authApi.getContentPackages({
        status: filters.status,
        subject: filters.subject,
        skill: filters.skill,
        limit: filters.limit,
        offset: filters.offset
      });
      
      console.log('✅ Packages fetched successfully:', result);
      
      setPackages(result.packages || []);
      setTotalCount(result.total_count || 0);
    } catch (err) {
      console.error('❌ Error fetching packages:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch packages';
      setError(errorMessage);
      setPackages([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, JSON.stringify(filters)]);

  // Fetch packages when auth state changes or filters change
  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const refetch = useCallback(() => {
    fetchPackages();
  }, [fetchPackages]);

  return {
    packages,
    loading: loading || authLoading,
    error,
    totalCount,
    refetch,
  };
}

interface UsePackageDetailResult {
  package: ContentPackage | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePackageDetail(packageId: string): UsePackageDetailResult {
  const { user, loading: authLoading } = useAuth();
  const [packageData, setPackageData] = useState<ContentPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPackageDetail = useCallback(async () => {
    if (!packageId) {
      console.log('❌ No package ID provided');
      return;
    }

    // Don't fetch if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, skipping package detail fetch');
      return;
    }

    if (!user) {
      console.log('❌ No authenticated user, skipping package detail fetch');
      setError('Authentication required');
      setLoading(false);
      return;
    }

    console.log('📦 Fetching package detail for:', packageId);
    setLoading(true);
    setError(null);

    try {
      // Use the same authApi that works for curriculum
      const result = await authApi.getContentPackageDetail(packageId);
      console.log('✅ Package detail fetched successfully:', result);
      setPackageData(result);
    } catch (err) {
      console.error('❌ Error fetching package detail:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch package details';
      setError(errorMessage);
      setPackageData(null);
    } finally {
      setLoading(false);
    }
  }, [packageId, user, authLoading]);

  useEffect(() => {
    fetchPackageDetail();
  }, [fetchPackageDetail]);

  const refetch = useCallback(() => {
    fetchPackageDetail();
  }, [fetchPackageDetail]);

  return {
    package: packageData,
    loading: loading || authLoading,
    error,
    refetch,
  };
}

// Helper hook for WebSocket connections using authApi
export function usePackageWebSocket(packageId: string, studentId?: number) {
  const { user, userProfile } = useAuth();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (!user || !packageId) {
      setError('Authentication and package ID required');
      return;
    }

    try {
      console.log('🔌 Creating WebSocket connection for package:', packageId);
      const websocket = await authApi.createLearningSessionWebSocket(
        packageId, 
        studentId || userProfile?.student_id
      );
      
      websocket.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnected(true);
        setError(null);
      };
      
      websocket.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setError('WebSocket connection error');
        setConnected(false);
      };
      
      websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setConnected(false);
      };
      
      setWs(websocket);
    } catch (err) {
      console.error('❌ Failed to create WebSocket:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create WebSocket connection';
      setError(errorMessage);
    }
  }, [user, packageId, studentId, userProfile?.student_id]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
      setConnected(false);
    }
  }, [ws]);

  const sendMessage = useCallback((message: any) => {
    if (ws && connected) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('❌ WebSocket not connected, cannot send message');
    }
  }, [ws, connected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  return {
    connect,
    disconnect,
    sendMessage,
    connected,
    error,
    ws
  };
}