// lib/api/content-packages.ts
export interface ContentPackage {
  id: string;
  subject: string;
  skill: string;
  subskill: string;
  title: string;
  description: string[];
  difficulty_level: string;
  learning_objectives: string[];
  has_visual: boolean;
  has_audio: boolean;
  has_practice: boolean;
  created_at: string;
}

export interface DetailedContentPackage extends ContentPackage {
  master_context: {
    difficulty_level: string;
    core_concepts: string[];
    key_terminology: Record<string, string>;
    learning_objectives: string[];
    real_world_applications: string[];
  };
  content: {
    reading?: {
      title: string;
      content: string;
    };
    visual?: {
      type: string;
      data: string;
    };
    audio?: {
      type: string;
      data: string;
    };
    practice?: {
      problems: Array<{
        id: string;
        problem: string;
        solution: string;
        difficulty: number;
      }>;
    };
  };
}

export interface PackageFilters {
  subject?: string;
  skill?: string;
  subskill?: string;
  status?: string;
  limit?: number;
}

export interface PackageResponse {
  status: 'success' | 'error';
  packages?: ContentPackage[];
  package?: DetailedContentPackage;
  total_count?: number;
  error?: string;
}

export class ContentPackageAPI {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/gemini') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get filtered list of content packages
   */
  async getPackages(filters: PackageFilters = {}): Promise<ContentPackage[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.skill) params.append('skill', filters.skill);
      if (filters.subskill) params.append('subskill', filters.subskill);
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await fetch(`${this.baseUrl}/content-packages?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PackageResponse = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.error || 'Failed to fetch content packages');
      }

      return data.packages || [];
    } catch (error) {
      console.error('Error fetching content packages:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific content package
   */
  async getPackageDetails(packageId: string): Promise<DetailedContentPackage | null> {
    try {
      const response = await fetch(`${this.baseUrl}/content-packages/${packageId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PackageResponse = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.error || 'Failed to fetch package details');
      }

      return data.package || null;
    } catch (error) {
      console.error('Error fetching package details:', error);
      throw error;
    }
  }

  /**
   * Get packages matching a curriculum selection
   */
  async getPackagesForCurriculum(curriculum: {
    subject: string;
    skill?: { id: string; description: string; };
    subskill?: { id: string; description: string; };
  }): Promise<ContentPackage[]> {
    const filters: PackageFilters = {
      subject: curriculum.subject,
      status: 'approved',
      limit: 20
    };

    if (curriculum.skill?.id) {
      filters.skill = curriculum.skill.id;
    }

    if (curriculum.subskill?.id) {
      filters.subskill = curriculum.subskill.id;
    }

    return this.getPackages(filters);
  }

  /**
   * Search packages by text query
   */
  async searchPackages(query: string, filters: Partial<PackageFilters> = {}): Promise<ContentPackage[]> {
    // For now, we'll get all packages and filter client-side
    // In the future, you might want to add a search endpoint to the backend
    const packages = await this.getPackages({
      ...filters,
      limit: 100 // Get more for better search results
    });

    const searchTerm = query.toLowerCase();
    return packages.filter(pkg => 
      pkg.title.toLowerCase().includes(searchTerm) ||
      pkg.description.some(desc => desc.toLowerCase().includes(searchTerm)) ||
      pkg.learning_objectives.some(obj => obj.toLowerCase().includes(searchTerm))
    );
  }
}

// Export a default instance
export const contentPackageApi = new ContentPackageAPI();

// Hook for using content packages in React components
import { useState, useEffect } from 'react';

export interface UseContentPackagesOptions {
  autoLoad?: boolean;
  filters?: PackageFilters;
}

export function useContentPackages(options: UseContentPackagesOptions = {}) {
  const [packages, setPackages] = useState<ContentPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPackages = async (filters?: PackageFilters) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await contentPackageApi.getPackages(filters || options.filters);
      setPackages(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load packages';
      setError(errorMessage);
      setPackages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPackages = async (query: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await contentPackageApi.searchPackages(query, options.filters);
      setPackages(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      setPackages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPackagesForCurriculum = async (curriculum: {
    subject: string;
    skill?: { id: string; description: string; };
    subskill?: { id: string; description: string; };
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await contentPackageApi.getPackagesForCurriculum(curriculum);
      setPackages(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load curriculum packages';
      setError(errorMessage);
      setPackages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (options.autoLoad) {
      loadPackages();
    }
  }, [options.autoLoad]);

  return {
    packages,
    isLoading,
    error,
    loadPackages,
    searchPackages,
    loadPackagesForCurriculum,
    refresh: () => loadPackages(options.filters)
  };
}

// Hook for getting package details
export function usePackageDetails(packageId: string | null) {
  const [packageDetails, setPackageDetails] = useState<DetailedContentPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPackageDetails = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await contentPackageApi.getPackageDetails(id);
      setPackageDetails(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load package details';
      setError(errorMessage);
      setPackageDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (packageId) {
      loadPackageDetails(packageId);
    } else {
      setPackageDetails(null);
      setError(null);
    }
  }, [packageId]);

  return {
    packageDetails,
    isLoading,
    error,
    refresh: () => packageId && loadPackageDetails(packageId)
  };
}

// Utility functions
export const packageUtils = {
  getDifficultyColor: (level: string): string => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-700 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  },

  getDifficultyIcon: (level: string): string => {
    switch (level?.toLowerCase()) {
      case 'beginner': return '🌱';
      case 'intermediate': return '🚀';
      case 'advanced': return '⚡';
      default: return '📚';
    }
  },

  formatCreatedDate: (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  },

  getResourceCount: (pkg: ContentPackage): number => {
    let count = 0;
    if (pkg.has_visual) count++;
    if (pkg.has_audio) count++;
    if (pkg.has_practice) count++;
    return count;
  },

  getResourceTypes: (pkg: ContentPackage): string[] => {
    const types: string[] = [];
    if (pkg.has_visual) types.push('Visual');
    if (pkg.has_audio) types.push('Audio');
    if (pkg.has_practice) types.push('Practice');
    return types;
  }
};