'use server';
/**
 * @fileOverview An AI flow for generating images.
 *
 * This file defines the AI flow for generating images based on a text prompt. It includes:
 * - The main `generateImage` function that handles the image generation process.
 * - Input and output schemas (GenerateImageInput, GenerateImageOutput) for type safety.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate an image from.'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageUrl: z.string().nullable().describe('The data URI of the generated image, or null if generation failed.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input) => {
    try {
      const { media } = await ai.generate({
          model: 'googleai/imagen-4.0-fast-generate-001',
          prompt: `Album cover art for a song. Cinematic, high-quality, photographic. Style hint: ${input.prompt}`,
      });

      const imageUrl = media.url;
      if (!imageUrl) {
          console.error('Image generation succeeded but returned no URL.');
          return { imageUrl: null };
      }
      
      return { imageUrl };
    } catch (error) {
      console.error('Image generation failed:', error);
      // Instead of throwing, return null to allow for graceful fallback on the client.
      return { imageUrl: null };
    }
  }
);
