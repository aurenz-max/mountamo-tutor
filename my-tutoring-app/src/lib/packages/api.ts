// lib/packages/api.ts - FIXED WITH AUTHENTICATION
import type { PackageFilters, PackageCard, ContentPackage } from './types';

class PackageAPI {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000/api/packages') {
    this.baseUrl = baseUrl;
  }

  // 🔥 NEW: Helper method to get auth token
  private async getAuthToken(): Promise<string | null> {
    // Import auth dynamically to avoid SSR issues
    const { auth } = await import('@/lib/firebase');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.warn('❌ No authenticated user found');
      return null;
    }
    
    try {
      const token = await currentUser.getIdToken();
      console.log('✅ Got auth token for API call');
      return token;
    } catch (error) {
      console.error('❌ Failed to get auth token:', error);
      return null;
    }
  }

  // 🔥 NEW: Helper method to make authenticated requests
  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAuthToken();
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    console.log('🌐 Making authenticated request to:', url);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('📨 Response:', { status: response.status, ok: response.ok });

    return response;
  }

  async getPackages(filters: PackageFilters = {}): Promise<{ packages: PackageCard[]; total_count: number }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const url = `${this.baseUrl}/content-packages?${params}`;
    
    try {
      const response = await this.makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch packages:', { status: response.status, error: errorText });
        throw new Error(`Failed to fetch packages: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Packages fetched successfully:', data.total_count, 'packages');
      return data;
    } catch (error) {
      console.error('❌ Error fetching packages:', error);
      throw error;
    }
  }

  async getPackageDetail(id: string): Promise<ContentPackage> {
    const url = `${this.baseUrl}/content-packages/${id}`;
    
    try {
      const response = await this.makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch package detail:', { status: response.status, error: errorText });
        throw new Error(`Failed to fetch package: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Package detail fetched successfully for:', id);
      
      // Your API returns { status: "success", package: {...} }
      // So we return data.package, not data directly
      return data.package;
    } catch (error) {
      console.error('❌ Error fetching package detail:', error);
      throw error;
    }
  }

  createLearningSessionWebSocket(packageId: string, studentId?: number): WebSocket {
    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId.toString());
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect to your backend server on port 8000, not the frontend on port 3000
    const wsUrl = `${protocol}//localhost:8000/api/packages/${packageId}/learn?${params}`;
    
    console.log('🔌 Creating WebSocket connection to:', wsUrl);
    return new WebSocket(wsUrl);
  }
}

export const packageAPI = new PackageAPI();