// Create a separate file for visual content API
// src/lib/visualContentApi.ts

const VISUAL_API_BASE_URL = 'http://localhost:8000/api/visual';

export interface ImageCategory {
  category: string;
}

export interface ImageInfo {
  id: string;
  name: string;
  category: string;
  type: string;
  data_uri?: string;
  thumbnail_url?: string;
}

export interface VisualContentApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  categories?: string[];
  images?: ImageInfo[];
  image?: ImageInfo;
  [key: string]: any;
}

export const visualContentApi = {
  /**
   * Get available image categories
   * @returns {Promise<VisualContentApiResponse<string[]>>}
   */
  getVisualCategories: async (): Promise<VisualContentApiResponse<string[]>> => {
    try {
      const response = await fetch(`${VISUAL_API_BASE_URL}/categories`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Return a fallback value instead of throwing
      return { status: 'error', categories: [] };
    }
  },

  /**
   * Get images for a specific category
   * @param {string} category - Category name
   * @returns {Promise<VisualContentApiResponse<ImageInfo[]>>}
   */
  getVisualImages: async (category: string): Promise<VisualContentApiResponse<ImageInfo[]>> => {
    try {
      const response = await fetch(`${VISUAL_API_BASE_URL}/images?category=${encodeURIComponent(category)}`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching images:', error);
      // Return a fallback value instead of throwing
      return { status: 'error', images: [] };
    }
  },

  /**
   * Get a specific image by ID
   * @param {string} imageId - Image ID
   * @returns {Promise<VisualContentApiResponse<ImageInfo>>}
   */
  getVisualImage: async (imageId: string): Promise<VisualContentApiResponse<ImageInfo>> => {
    try {
      const response = await fetch(`${VISUAL_API_BASE_URL}/image/${encodeURIComponent(imageId)}`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching image:', error);
      return { status: 'error', image: null };
    }
  },

  /**
   * Create a counting scene
   * @param {Object} request - Scene creation request
   * @returns {Promise<VisualContentApiResponse<any>>}
   */
  createCountingScene: async (request: any): Promise<VisualContentApiResponse<any>> => {
    try {
      const response = await fetch(`${VISUAL_API_BASE_URL}/scene/counting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating scene:', error);
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

export default visualContentApi;