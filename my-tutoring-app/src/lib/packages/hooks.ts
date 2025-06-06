// lib/packages/hooks.ts
import { useState, useEffect } from 'react';
import { packageAPI } from './api';
import type { PackageCard, ContentPackage, PackageFilters } from './types';

export function usePackages(filters: PackageFilters = {}) {
  const [packages, setPackages] = useState<PackageCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await packageAPI.getPackages(filters);
        setPackages(data.packages);
        setTotalCount(data.total_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch packages');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [JSON.stringify(filters)]);

  return { packages, loading, error, totalCount };
}

// Update your usePackageDetail hook with debugging
export function usePackageDetail(packageId: string | null) {
  const [package_, setPackage] = useState<ContentPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    
    if (!packageId) {
      console.log('No packageId provided, skipping fetch');
      return;
    }

    const fetchPackage = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await packageAPI.getPackageDetail(packageId);
        
        setPackage(data);
      } catch (err) {
        console.error('API call failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch package';
        console.log('Setting error state:', errorMessage);
        setError(errorMessage);
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
      }
    };

    fetchPackage();
  }, [packageId]);

  return { package: package_, loading, error };
}