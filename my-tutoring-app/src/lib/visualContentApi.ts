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
  _previewSize?: { width: number; height: number };
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
  },

  /**
   * Get visual content by category - alias for getVisualImages
   * This method is added to match the expected API in VisualSceneManager
   */
  getVisualByCategory: async (category: string): Promise<VisualContentApiResponse<ImageInfo[]>> => {
    console.log(`Getting visual content for category: ${category}`);
    try {
      // First try to get from the regular API
      const result = await visualContentApi.getVisualImages(category);
      
      if (result.status === 'success' && result.images && result.images.length > 0) {
        return result;
      }
      
      // If no results or error, try to provide fallbacks for common categories
      if (category === 'shapes') {
        console.log('No images found, using fallback shapes');
        // Provide fallback SVG shapes
        return {
          status: 'success',
          images: [
            {
              id: 'circle_fallback',
              name: 'circle',
              category: 'shapes',
              type: 'svg',
              data_uri: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="blue" />
              </svg>`
            },
            {
              id: 'triangle_fallback',
              name: 'triangle',
              category: 'shapes',
              type: 'svg',
              data_uri: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,10 90,90 10,90" stroke="black" stroke-width="2" fill="green" />
              </svg>`
            },
            {
              id: 'square_fallback',
              name: 'square',
              category: 'shapes',
              type: 'svg',
              data_uri: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="80" height="80" stroke="black" stroke-width="2" fill="red" />
              </svg>`
            }
          ]
        };
      }
      
      // Return the original result if no fallbacks apply
      return result;
    } catch (error) {
      console.error(`Error in getVisualByCategory for ${category}:`, error);
      return { status: 'error', images: [] };
    }
  }
};

export default visualContentApi;