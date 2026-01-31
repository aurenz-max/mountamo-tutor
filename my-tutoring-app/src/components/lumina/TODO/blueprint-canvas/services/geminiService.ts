import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BuildingData, FurnitureItem } from "../types";

const BUILDING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "A creative name for the building structure" },
    summary: { type: Type.STRING, description: "A short architectural description of the style and layout" },
    totalWidthMeters: { type: Type.NUMBER, description: "Estimated total width in meters" },
    totalDepthMeters: { type: Type.NUMBER, description: "Estimated total depth in meters" },
    totalHeightMeters: { type: Type.NUMBER, description: "Estimated total height in meters" },
    rooms: {
      type: Type.ARRAY,
      description: "List of rooms inferred from the plan",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          x: { type: Type.NUMBER, description: "X coordinate (0-100 scale)" },
          y: { type: Type.NUMBER, description: "Y coordinate (0-100 scale)" },
          width: { type: Type.NUMBER, description: "Width (0-100 scale relative to total width)" },
          height: { type: Type.NUMBER, description: "Height/Depth (0-100 scale relative to total depth)" },
        },
        required: ["id", "name", "x", "y", "width", "height"]
      }
    },
    walls: {
      type: Type.ARRAY,
      description: "List of wall segments",
      items: {
        type: Type.OBJECT,
        properties: {
          x1: { type: Type.NUMBER },
          y1: { type: Type.NUMBER },
          x2: { type: Type.NUMBER },
          y2: { type: Type.NUMBER },
          type: { type: Type.STRING, enum: ["outer", "inner"] }
        },
        required: ["x1", "y1", "x2", "y2", "type"]
      }
    },
    elevation: {
      type: Type.OBJECT,
      description: "Data for the side/front view",
      properties: {
        roof: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["gable", "flat", "shed"] },
            height: { type: Type.NUMBER, description: "Roof height as percentage of total height (0-100)" }
          }
        },
        features: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["window", "door", "garage", "chimney"] },
              x: { type: Type.NUMBER, description: "X pos 0-100" },
              y: { type: Type.NUMBER, description: "Y pos 0-100 from bottom" },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER }
            },
            required: ["type", "x", "y", "width", "height"]
          }
        }
      },
      required: ["roof", "features"]
    }
  },
  required: ["name", "rooms", "walls", "elevation", "totalWidthMeters", "totalDepthMeters", "totalHeightMeters"]
};

const INTERIOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          type: { 
            type: Type.STRING, 
            enum: ['bed', 'sofa', 'table', 'chair', 'cabinet', 'toilet', 'sink', 'shower', 'other'] 
          },
          x: { type: Type.NUMBER, description: "Center X position (0-100 relative to room)" },
          y: { type: Type.NUMBER, description: "Center Y position (0-100 relative to room)" },
          width: { type: Type.NUMBER, description: "Width (0-100 relative to room)" },
          height: { type: Type.NUMBER, description: "Height (0-100 relative to room)" },
          rotation: { type: Type.NUMBER, description: "Rotation in degrees" }
        },
        required: ["id", "name", "type", "x", "y", "width", "height", "rotation"]
      }
    }
  },
  required: ["items"]
};

export const generateBlueprint = async (base64Image: string): Promise<BuildingData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

  const prompt = `
    Analyze this architectural sketch. 
    It is a rough top-down or perspective drawing of a building.
    Interpret the lines as walls and spaces.
    
    1. Reconstruct a floor plan (Top View) normalized to a 0-100 grid.
    2. Infer a Front Elevation (Side View) based on typical architectural logic for the rooms identified.
    3. Provide dimensions in meters.
    4. Be creative but structurally logical.
    
    Return pure JSON matching the schema provided.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: BUILDING_SCHEMA,
        temperature: 0.4,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as BuildingData;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateInterior = async (base64Image: string, roomName: string): Promise<FurnitureItem[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

  const prompt = `
    Analyze this sketch of a ${roomName}.
    Identify furniture, fixtures, and layout elements drawn.
    
    Return a list of items with their positions and dimensions.
    The coordinates (x, y) and dimensions (width, height) must be normalized to a 0-100 scale relative to the room boundaries.
    Center X/Y is the center of the object.
    
    Use standard furniture types where possible.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: INTERIOR_SCHEMA,
        temperature: 0.4,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const data = JSON.parse(text);
    return data.items as FurnitureItem[];
  } catch (error) {
    console.error("Gemini Interior API Error:", error);
    throw error;
  }
};