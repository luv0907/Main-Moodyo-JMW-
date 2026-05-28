
'use server';
/**
 * @fileOverview A custom mood generator AI flow.
 *
 * This file defines the AI flow for generating custom moods. It includes:
 * - The main `generateMood` function that orchestrates the generation process.
 * - Input and output schemas (GenerateMoodInput, GenerateMoodOutput) for type safety.
 * - A Genkit prompt that instructs the AI on how to generate the mood's theme and playlist.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateMoodInputSchema = z.object({
  name: z.string().describe('The name of the mood, e.g., "Cosmic Jazz".'),
  emoji: z.string().describe('An emoji that represents the mood, e.g., "🎷".'),
  description: z.string().describe('A short description of the vibe, e.g., "Late night jazz in a space lounge."'),
});
export type GenerateMoodInput = z.infer<typeof GenerateMoodInputSchema>;

const GenerateMoodOutputSchema = z.object({
  title: z.string().describe('The creative title for the mood playlist.'),
  subtitle: z.string().describe('A catchy subtitle for the mood.'),
  theme: z.object({
    start: z.string().describe('A vibrant starting hex color for the background gradient.'),
    end: z.string().describe('A complementary ending hex color for the background gradient.'),
    accent: z.string().describe('An accent hex color for UI elements like buttons.'),
  }),
  playlist: z.array(z.object({
    title: z.string().describe('A unique, imaginary song title.'),
    artist: z.string().describe('A fictional artist name that fits the mood.'),
  })).length(10).describe('A list of 10 generated songs.'),
});
export type GenerateMoodOutput = z.infer<typeof GenerateMoodOutputSchema>;

export async function generateMood(input: GenerateMoodInput): Promise<GenerateMoodOutput> {
  return generateMoodFlow(input);
}

const moodPrompt = ai.definePrompt({
  name: 'moodPrompt',
  input: { schema: GenerateMoodInputSchema },
  output: { schema: GenerateMoodOutputSchema },
  model: 'googleai/gemini-1.5-flash-latest',
  prompt: `
    You are a creative AI assistant for a mood-based music app called "MoodyO".
    Your task is to generate a complete theme and a playlist for a new, custom mood based on the user's input.

    User Input:
    - Mood Name: {{{name}}}
    - Emoji: {{{emoji}}}
    - Description: {{{description}}}

    Instructions:
    1.  **Title and Subtitle**: Create a creative and engaging title and subtitle for this mood. The main title should be based on the user's mood name.
    2.  **Color Theme**: Generate a visually appealing color theme with three hex color codes:
        - \`start\`: A starting color for a background gradient.
        - \`end\`: An ending color for the background gradient.
        - \`accent\`: An accent color for buttons and highlights that contrasts well with the background. The accent color should be provided in HSL format like 'hsl(175, 90%, 45%)'.
    3.  **Playlist**: Generate a list of exactly 10 unique, imaginary song titles and fictional artist names that perfectly match the described vibe. The song titles and artists should be creative and sound plausible.

    Ensure the final output strictly follows the JSON schema provided.
  `,
});

const generateMoodFlow = ai.defineFlow(
  {
    name: 'generateMoodFlow',
    inputSchema: GenerateMoodInputSchema,
    outputSchema: GenerateMoodOutputSchema,
  },
  async (input) => {
    const { output } = await moodPrompt(input);
    if (!output) {
      throw new Error('Failed to generate mood. The AI model did not return a valid output.');
    }
    return output;
  }
);
