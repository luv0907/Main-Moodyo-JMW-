/**
 * @fileoverview This file initializes the Genkit AI plugin and exports the `ai` object.
 *
 * It is used by all other files that interact with Genkit.
 */
import {genkit, GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

import * as z from 'zod';

export const ai = genkit({
  plugins: [
    googleAI({ apiVersion: 'v1beta' }),
  ],
});
