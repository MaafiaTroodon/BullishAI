/**
 * Screen Explanation Provider Configuration
 * Toggle between mock, Groq, and Gemini providers
 */

export type ExplanationProvider = 'mock' | 'groq' | 'gemini'

export const EXPLANATION_PROVIDER: ExplanationProvider = 'mock'

export const PROVIDER_CONFIG = {
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash',
  },
}

