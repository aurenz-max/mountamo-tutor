// lib/packages/api.ts
class PackageAPI {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000/api/packages') {
    this.baseUrl = baseUrl;
  }

  async getPackages(filters: PackageFilters = {}): Promise<{ packages: PackageCard[]; total_count: number }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const response = await fetch(`${this.baseUrl}/content-packages?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.statusText}`);
    }
    return response.json();
  }

  async getPackageDetail(id: string): Promise<ContentPackage> {
    const response = await fetch(`${this.baseUrl}/content-packages/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch package: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Your API returns { status: "success", package: {...} }
    // So we need to return data.package, not data directly
    return data.package;
  }


  createLearningSessionWebSocket(packageId: string, studentId?: number): WebSocket {
    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId.toString());
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect to your backend server on port 8000, not the frontend on port 3000
    const wsUrl = `${protocol}//localhost:8000/api/packages/${packageId}/learn?${params}`;
    
    return new WebSocket(wsUrl);
  }
}

export const packageAPI = new PackageAPI();