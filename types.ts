/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface Prompt {
  readonly promptId: string;
  text: string;
  weight: number; // Represents intensity/influence, typically 0-2 from knob
  cc: number; // MIDI Control Change number
  color: string; // UI color for the prompt
}

export interface ControlChange {
  channel: number;
  cc: number;
  value: number; // MIDI CC value 0-127
}

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';

// Describes the structure of the JSON expected from Gemini for Tone.js
export interface MusicDescription {
  tempo: number; // e.g., 120
  timeSignature: [number, number]; // e.g. [4,4]
  overallKey: string; // e.g. "C major"
  instruments: Array<{
    name: string; // Unique name for this instrument instance, e.g., "TablaBass"
    type: "Synth" | "MembraneSynth" | "NoiseSynth" | "FMSynth" | "AMSynth" | "PluckSynth" | "MetalSynth"; // Tone.js instrument type
    volume?: number; // Decibels, e.g., -6
    effects?: Array<
      | { type: "Reverb"; decay?: number; preDelay?: number; wet?: number }
      | { type: "Delay"; delayTime?: string | number; feedback?: number; wet?: number }
      | { type: "Chorus"; frequency?: number; delayTime?: number; depth?: number; wet?: number }
      | { type: "Phaser"; frequency?: number; octaves?: number; baseFrequency?: number; wet?: number }
      | { type: "Tremolo"; frequency?: number; depth?: number; wet?: number }
      | { type: "Vibrato"; frequency?: number; depth?: number; wet?: number }
      | { type: "Distortion"; distortion?: number; wet?: number }
      // Add more effect types as needed
    >;
    options?: any; // Specific Tone.js constructor options for the instrument
  }>;
  patterns: Array<{
    instrumentName: string; // Must match a name in the instruments array
    sequence: Array<
      | { time: string; note: string; duration: string; velocity?: number } // For pitched instruments
      | { time: string; duration?: string; velocity?: number } // For unpitched (e.g. NoiseSynth trigger)
    >;
    loop?: boolean | number | string; // Tone.js loop parameter
    probability?: number; // (0-1)
  }>;
  // Optionally, add master bus effects or global parameters
  masterEffects?: Array<any>; 
}
