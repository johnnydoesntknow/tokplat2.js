// src/services/huggingfaceNew.js
import { HfInference } from '@huggingface/inference';

// Debug the environment variable
const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
console.log('Environment API Key:', apiKey); // This will show what's actually being loaded

// If the API key is not loading correctly, use this as a temporary fix
const FALLBACK_KEY = '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';

// Use fallback if env var is not working
const finalKey = (apiKey && apiKey !== 'undefined' && apiKey !== 'fraction') 
  ? apiKey 
  : FALLBACK_KEY;

console.log('Using API key:', finalKey.substring(0, 10) + '...');

const hf = new HfInference(finalKey);

export async function generateImageHF(prompt, modelName = null) {
  try {
    const model = modelName || import.meta.env.VITE_HF_MODEL || 'black-forest-labs/FLUX.1-schnell';
    console.log('🎨 Generating with FLUX model:', model);
    
    const result = await hf.textToImage({
      model: model,
      inputs: prompt,
    });
    
    const url = URL.createObjectURL(result);
    return { success: true, image: url, model };
  } catch (error) {
    console.error('FLUX generation error:', error);
    return { success: false, error: error.message };
  }
}

// Generate multiple variations
export async function generateVariations(prompt, count = 4) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    const variedPrompt = `${prompt}, variation ${i + 1}`;
    promises.push(generateImageHF(variedPrompt));
  }
  
  const results = await Promise.all(promises);
  return results.filter(r => r.success);
}

export default {
  generateImageHF,
  generateVariations
};