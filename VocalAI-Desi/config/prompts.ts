/*
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Import the Prompt interface if it's not globally available or needs explicit import
import { Prompt } from '../types';

/**
 * Predefined prompts for VocalAI Desi, focusing on Bengali and South Asian music.
 * These will be displayed in the UI and sent to the Gemini API.
 */
export const VOCALAI_DESI_PROMPTS: Prompt[] = [
  {
    promptId: 'prompt-001',
    text: 'A melancholic Bengali Baul folk piece, with harmonium, tabla, and dotara. Slow tempo, contemplative mood.',
    weight: 1, // Default weight
    cc: 70,    // Default CC for this prompt (adjust as needed)
    color: '#FF6347', // Tomato red
  },
  {
    promptId: 'prompt-002',
    text: 'Energetic Bollywood dance track, featuring dhol, synth pads, and a catchy shehnai melody. Fast tempo, joyful mood.',
    weight: 1,
    cc: 71,
    color: '#FFD700', // Gold
  },
  {
    promptId: 'prompt-003',
    text: 'Classical Indian Carnatic music, focusing on a specific raga like "Mohanam." Solo violin, subtle tanpura drone. Serene mood, medium tempo.',
    weight: 1,
    cc: 72,
    color: '#6A5ACD', // Slate Blue
  },
  {
    promptId: 'prompt-004',
    text: 'Modern South Asian fusion with tabla-loop beat, electronic bass, and a soulful Hindustani vocal sample. Driving rhythm, uplifting mood.',
    weight: 1,
    cc: 73,
    color: '#32CD32', // Lime Green
  },
  {
    promptId: 'prompt-005',
    text: 'Pakistani Ghazal instrumental, with sarangi, harmonium, and gentle percussion. Melancholic and romantic mood, slow tempo.',
    weight: 1,
    cc: 74,
    color: '#ADD8E6', // Light Blue
  },
  // Add more prompts as you develop them in Google AI Studio
  {
    promptId: 'prompt-006',
    text: 'Lively Sri Lankan Baila rhythm, fast tempo, with lively percussion, guitar, and traditional Sinhala melodies.',
    weight: 1,
    cc: 75,
    color: '#FFA07A', // Light Salmon
  },
];
