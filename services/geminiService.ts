
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.warn("API_KEY for Gemini not found in environment variables. AI features will be disabled.");
}

export const suggestAltTextForImage = async (layerName: string): Promise<string> => {
  if (!ai) {
    return "AI features disabled. API_KEY not configured.";
  }
  if (!layerName || layerName.trim() === "") {
    return "Layer name is empty, cannot suggest alt text.";
  }

  const prompt = `Generate a concise and descriptive alt text for an image layer named "${layerName}". The alt text should be suitable for web accessibility. For example, if the layer name is "user_avatar", a good alt text could be "User's profile picture". If the layer name is "btn_submit_form", it could be "Submit form button". Keep it brief.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', 
      contents: prompt,
    });
    return response.text.trim() || `Could not generate alt text for "${layerName}".`;
  } catch (error) {
    console.error("Error generating alt text with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return `Error suggesting alt text: ${errorMessage}`;
  }
};
    