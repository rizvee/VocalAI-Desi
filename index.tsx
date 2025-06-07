/**
 * @fileoverview Control real time music with a MIDI controller using Gemini and Tone.js
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import * as Tone from 'tone';

import { throttle } from './utils/throttle';
import { AudioAnalyser } from './utils/AudioAnalyser';
import { MidiDispatcher } from './utils/MidiDispatcher';
import { ToneJsPlayer } from './utils/ToneJsPlayer';

import './components/WeightKnob';
import './components/PromptController';
import { PlayPauseButton } from './components/PlayPauseButton';
import { ToastMessage } from './components/ToastMessage';

import type { Prompt, PlaybackState, MusicDescription } from './types';

// Ensure API_KEY is used as per guidelines
const ai = new GoogleGenAI({ apiKey: "AIzaSyAY88xufPi5r_wkRQCBWcW7HtvFEpjBRC4" });
const model = 'gemini-2.5-flash-preview-04-17';

const DEFAULT_PROMPTS: Array<Omit<Prompt, 'promptId' | 'weight' | 'cc'>> = [
  { color: '#FF6D00', text: 'Bengali Baul Melody' }, // Orange
  { color: '#FFD600', text: 'Bollywood Dhol Beat' }, // Yellow
  { color: '#76FF03', text: 'Sitar Raga Ambience' }, // Light Green
  { color: '#00E5FF', text: 'Tabla Rhythm Cycle' },  // Cyan
  { color: '#AA00FF', text: 'Harmonium Drone' },     // Purple
  { color: '#FF1744', text: 'Qawwali Vocal Style' }, // Red
  { color: '#2979FF', text: 'Indipop Synth Lead' },  // Blue
  { color: '#F50057', text: 'Carnatic Violin' },     // Pink
  { color: '#00C853', text: 'Bhangra Groove' },      // Green
  { color: '#FFAB00', text: 'Ghazal Mood' },         // Amber
  { color: '#651FFF', text: 'Thumri Essence' },      // Deep Purple
  { color: '#1DE9B6', text: 'Sufi Rock Fusion' },    // Teal
  { color: '#FF7043', text: 'Rajasthani Folk Tune' },// Deep Orange
  { color: '#8D6E63', text: 'Khayal Alaap' },        // Brown
  { color: '#4DB6AC', text: 'Rabindra Sangeet' },    // Teal Light
  { color: '#FF8A80', text: 'Lavani Dance Energy' }, // Light Red
];

/** The main application component. */
@customElement('vocal-ai-desi')
class VocalAiDesi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      position: relative;
      font-family: 'Google Sans', sans-serif;
      background-color: #1e1e1e;
      color: #e0e0e0;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #111; // Fallback
      opacity: 0.8;
    }
    #grid {
      width: 85vmin; /* Keep for now, evaluate later */
      height: 85vmin; /* Keep for now, evaluate later */
      max-width: 900px;
      max-height: 900px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px; /* Changed from 2vmin to fixed 16px */
      margin-top: 8vmin;
    }
    prompt-controller {
      width: 100%;
    }
    play-pause-button {
      position: relative;
      width: 15vmin;
      max-width: 120px;
      margin-top: 3vmin;
    }
    #buttons {
      position: absolute;
      top: 10px;
      left: 10px;
      padding: 5px;
      display: flex;
      gap: 10px;
      align-items: center;
      background-color: rgba(0,0,0,0.3);
      border-radius: 8px;
      padding: 8px;
    }
    button, select {
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      color: #e0e0e0;
      background: rgba(255, 255, 255, 0.1);
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      user-select: none;
      padding: 8px 12px;
      transition: background-color 0.2s ease, border-color 0.2s ease;
      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.5);
      }
      &.active {
        background-color: #FFD600; /* Accent color */
        color: #111;
        border-color: #FFD600;
      }
    }
    select {
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      color: #e0e0e0;
      border-radius: 6px;
      border: 1.5px solid rgba(255, 255, 255, 0.3);
      outline: none;
    }
    option {
      background-color: #333;
      color: #e0e0e0;
    }
    #title {
      font-size: 3vmin;
      color: #FFD600; /* Accent color for title */
      margin-bottom: 2vmin;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.5);
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;
  
  private audioAnalyser?: AudioAnalyser;
  private tonePlayer?: ToneJsPlayer;
  private audioComponentsInitialized = false;

  @state() private playbackState: PlaybackState = 'stopped';
  @state() private audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @property({ type: Boolean }) private showMidi = false;
  
  @state() private filteredPrompts = new Set<string>();

  private audioLevelRafId: number | null = null;
  private isGenerating = false;

  @query('play-pause-button') private playPauseButton!: PlayPauseButton;
  @query('toast-message') private toastMessage!: ToastMessage;

  constructor(
    prompts: Map<string, Prompt>,
    midiDispatcher: MidiDispatcher,
  ) {
    super();
    this.prompts = prompts;
    this.midiDispatcher = midiDispatcher;
    this.updateAudioLevel = this.updateAudioLevel.bind(this);
  }

  override async firstUpdated() {
    if (!Tone.supported) {
      this.toastMessage?.show({ message: "Audio features disabled: Web Audio API not supported by your browser." });
      console.error("VocalAI Desi: Web Audio API not supported. Audio functionality will be limited.");
    }

    this.midiDispatcher.getMidiAccess().then(ids => {
      this.midiInputIds = ids;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
      if (ids.length === 0) {
        this.toastMessage?.show({ message: "MIDI controller access failed or is unavailable. MIDI control features will be limited." });
      }
    });
    this.requestUpdate();
    this.loadPromptsFromStorage();
    window.addEventListener('beforeunload', this.savePromptsToStorage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.audioLevelRafId) {
      cancelAnimationFrame(this.audioLevelRafId);
      this.audioLevelRafId = null;
    }
    this.tonePlayer?.stop();
    window.removeEventListener('beforeunload', this.savePromptsToStorage);
  }

  private async ensureAudioComponentsInitialized(): Promise<boolean> {
    if (this.audioComponentsInitialized) return true;

    if (!Tone.supported) {
        this.toastMessage?.show({ message: "Web Audio API is not supported in this browser. Audio features are disabled." });
        console.error("VocalAI Desi: Tone.js (Web Audio API) is not supported.");
        return false;
    }
    
    if (Tone.context.state !== 'running') {
        console.warn("VocalAI Desi: ensureAudioComponentsInitialized - AudioContext is not running. Needs user gesture (e.g. Play button).");
        return false; // Don't attempt to initialize if context isn't running
    }

    try {
      const rawCtx = Tone.context.rawContext;
      const isValidAudioContext = rawCtx && typeof rawCtx.createGain === 'function' && typeof rawCtx.currentTime === 'number';

      if (!isValidAudioContext) {
          console.error("VocalAI Desi: Failed to get valid AudioContext from Tone.js, even though state is 'running'.");
          console.error(`Tone.context.rawContext type: ${typeof rawCtx}`);
           if (rawCtx) {
            console.error(`rawCtx.createGain type: ${typeof (rawCtx as any).createGain}`);
            console.error(`rawCtx.currentTime type: ${typeof (rawCtx as any).currentTime}`);
          }
          this.toastMessage?.show({ message: "Audio system error: Invalid context state. Please try refreshing." });
          return false;
      }

      this.audioAnalyser = new AudioAnalyser(rawCtx as AudioContext);
      this.tonePlayer = new ToneJsPlayer(this.audioAnalyser.node);
      this.audioComponentsInitialized = true;
      
      if (!this.audioLevelRafId) {
          this.updateAudioLevel();
      }
      console.log("VocalAI Desi: Audio components initialized successfully.");
      return true;

    } catch (error: any) {
      console.error("VocalAI Desi: Audio component initialization (Analyser/Player) failed.");
      let errorName = 'Unknown Error';
      let errorMessageText = '(No message)';
      let errorStack = '(No stack trace)';

      if (error instanceof Error) {
        errorName = error.name;
        errorMessageText = error.message || errorMessageText;
        errorStack = error.stack || errorStack;
      } else if (typeof error === 'string') {
        errorMessageText = error;
      }
      
      console.error(`Error Name: ${errorName}`);
      console.error(`Error Message: ${errorMessageText}`);
      console.error(`Error Stack: ${errorStack}`);
      if (typeof error === 'object' && error !== null && !(error instanceof Error)) {
        console.error("Raw error object (details below):");
        console.error(error);
      } else if (typeof error !== 'string' && !(error instanceof Error)) {
        console.error("Raw error (primitive or unknown type):");
        console.error(error);
      }
      
      let userMessage = "Audio component setup failed. Please try refreshing.";
      if (errorName === 'NotAllowedError' || (errorMessageText && errorMessageText.toLowerCase().includes('user gesture'))) {
        userMessage = "Audio Error: Browser requires interaction. Click Play or tap screen.";
      } else if (errorName === 'InvalidStateError') {
        userMessage = "Audio Error: Audio system is in an unexpected state. Try refreshing.";
      } else if (errorName === 'InvalidAccessError') {
        userMessage = "Audio Error: Audio access denied. Check browser or iframe permissions.";
      } else if (errorMessageText && errorMessageText !== '(No message)') {
        const lowerCaseMessage = errorMessageText.toLowerCase();
        if (lowerCaseMessage.includes('permission denied')) {
            userMessage = "Audio Error: Permission denied. Check browser settings.";
        } else if (lowerCaseMessage.includes('circular structure')) {
            userMessage = "An unexpected audio error occurred. If refreshing doesn't help, please report the issue.";
        } else {
            userMessage = `Audio Init Error: ${errorMessageText.substring(0, 80)}`;
        }
      }
      
      this.toastMessage?.show({
        message: userMessage,
        intent: 'danger',
        icon: 'error',
      });
      this.audioComponentsInitialized = false;
      return false;
    }
  }

  private getActivePrompts() {
    return Array.from(this.prompts.values())
      .filter(p => p.weight > 0.05 && !this.filteredPrompts.has(p.text));
  }

  private generateMusicDescription = throttle(async () => {
    if (this.isGenerating) return;

    if (!this.audioComponentsInitialized) {
      const ready = await this.ensureAudioComponentsInitialized(); // This won't call Tone.start()
      if (!ready || !this.tonePlayer) {
        this.toastMessage?.show({ message: "Audio system not active. Please click the play button first." });
        this.isGenerating = false; 
        if (this.playbackState === 'loading') this.playbackState = 'paused';
        return;
      }
    }
    // tonePlayer should be initialized if audioComponentsInitialized is true
    if (!this.tonePlayer) { 
        console.error("VocalAI Desi: generateMusicDescription - tonePlayer is not initialized despite audioComponentsInitialized being true. This should not happen.");
        this.toastMessage?.show({ message: "Critical audio player error. Please refresh." });
        this.isGenerating = false;
        if (this.playbackState === 'loading') this.playbackState = 'paused';
        return;
    }

    const activePrompts = this.getActivePrompts();
    if (activePrompts.length === 0) {
      this.toastMessage.show({ message: 'Turn up a knob to add a musical element.' });
      if (this.playbackState === 'playing' || this.playbackState === 'loading') {
        this.pause();
      }
      this.isGenerating = false; 
      return;
    }

    this.isGenerating = true;
    if (this.playbackState !== 'paused') { 
        this.playbackState = 'loading';
    }

    const promptText = activePrompts
      .map(p => `${p.text} (weight: ${p.weight.toFixed(2)})`)
      .join(', ');

    const systemInstruction = `You are an expert music theorist specializing in South Asian music and its fusion with modern genres. Generate a musical description for Tone.js.
Focus on creating a cohesive piece based on the user's prompts.
Output ONLY a valid JSON object following this exact structure:
{
  "tempo": number (bpm, between 60-180),
  "timeSignature": [number, number] (e.g. [4,4] or [3,4]),
  "overallKey": string (e.g. "C major", "D minor", "A# lydian"),
  "instruments": [ { "name": string (e.g., "SitarLead", "TablaBass", "HarmoniumPad", "DholKick"), "type": "Synth" | "MembraneSynth" | "NoiseSynth" | "FMSynth" | "AMSynth" | "PluckSynth" | "MetalSynth", "volume": number (-60 to 0), "effects": [{"type": "Reverb", "decay": number (0.1-5)}, {"type": "Delay", "delayTime": string ("8n", "4n.")}] } ],
  "patterns": [ { "instrumentName": string, "sequence": [ { "time": string (Tone.js time, e.g. "0:0:0", "0:1", "+1m"), "note": string (e.g. "C4", "D#3"), "duration": string (e.g. "8n", "4t", "1m"), "velocity": number (0.1-1.0) } ], "loop": boolean } ]
}
Ensure instrument names in patterns match those in instruments. Create short, interesting, and stylistically relevant patterns. Use a variety of note timings and durations.
The music should be inspired by: ${promptText}.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{text: `Describe music for: ${promptText}`}] }],
        config: {
          systemInstruction: { role: 'system', parts: [{text: systemInstruction }]},
          responseMimeType: "application/json",
        },
      });

      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }
      let description;
      try {
        description = JSON.parse(jsonStr) as MusicDescription;
      } catch (parseError: any) {
        console.error('VocalAI Desi: Failed to parse AI response:', parseError.message);
        this.toastMessage?.show({
          message: "AI Error: Unexpected response format from AI. Please try again.",
          intent: 'danger',
          icon: 'error',
        });
        // throw parseError; // Re-throw to be caught by the outer catch - No, handle here and exit.
        if (this.playbackState === 'loading') {
            this.playbackState = 'paused';
        }
        return; // Exit if parsing fails
      }
      this.tonePlayer.updateMusic(description); 
      
      if (this.playbackState === 'loading') {
         this.playbackState = 'playing';
      }

    } catch (e: any) {
      console.error('VocalAI Desi: Error generating music description.');
      let errorName = 'Unknown Error';
      let errorMessageText = '(No message)';
      let errorStack = '(No stack trace)';
      let userErrorMessage = 'AI Error: Failed to generate music description.';

      if (e instanceof Error) {
        errorName = e.name;
        errorMessageText = e.message || errorMessageText;
        errorStack = e.stack || errorStack;
      } else if (typeof e === 'string') {
        errorMessageText = e;
      } else if (e && typeof e.message === 'string') { // Handle cases where e might be an object with a message
        errorMessageText = e.message;
      }

      console.error(`Error Name: ${errorName}`);
      console.error(`Error Message: ${errorMessageText}`);
      console.error(`Error Stack: ${errorStack}`);
      // Log the raw error object if it's not a standard Error instance
      if (typeof e === 'object' && e !== null && !(e instanceof Error)) {
        console.error("Raw error object (details below):");
        console.error(e);
      } else if (typeof e !== 'string' && !(e instanceof Error)) {
         console.error("Raw error (primitive or unknown type):");
         console.error(e);
      }
      
      if (errorMessageText) {
        const lowerCaseMessage = errorMessageText.toLowerCase();
        if (lowerCaseMessage.includes('api key not valid')) {
          userErrorMessage = 'AI Error: Invalid API Key. Please check the key.';
        } else if (lowerCaseMessage.includes('quota')) {
          userErrorMessage = 'AI Error: Quota exceeded. Please try again later.';
        } else if (lowerCaseMessage.includes('text not available') || lowerCaseMessage.includes('no response')) {
            userErrorMessage = 'AI Error: No response from AI. Please try again.';
        } else if (lowerCaseMessage.includes('network error') || lowerCaseMessage.includes('failed to fetch')) {
            userErrorMessage = 'AI Error: Network issue. Please check your connection and try again.';
        } else if (errorName !== 'Unknown Error' && errorName !== 'Error') {
            userErrorMessage = `AI Error: ${errorName}. ${errorMessageText.substring(0,100)}`;
        } else {
            userErrorMessage = `AI Error: ${errorMessageText.substring(0,100)}`;
        }
      }

      this.toastMessage?.show({
        message: userErrorMessage,
        intent: 'danger',
        icon: 'error',
      });

      if (this.playbackState === 'loading') {
         this.playbackState = 'paused'; // Ensure playback state is reset
      }
    } finally {
      this.isGenerating = false;
      // Ensure playbackState is reset if it was loading, regardless of success or failure within try/catch
      if (this.playbackState === 'loading') {
        this.playbackState = this.tonePlayer?.isPlaying() ? 'playing' : 'paused';
      }
    }
  }, 500);

  private updateAudioLevel() {
    this.audioLevelRafId = requestAnimationFrame(this.updateAudioLevel);
    if (this.audioComponentsInitialized && this.audioAnalyser) {
      this.audioLevel = this.audioAnalyser.getCurrentLevel();
    } else {
      this.audioLevel = 0;
    }
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight, cc } = e.detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) {
      console.error('Prompt not found:', promptId);
      return;
    }

    prompt.text = text;
    prompt.weight = weight;
    prompt.cc = cc;
    
    this.prompts.set(promptId, prompt);
    this.requestUpdate('prompts');
    
    if (this.tonePlayer && (this.playbackState === 'playing' || this.playbackState === 'loading' || (this.playbackState === 'paused' && this.tonePlayer.isReady()))) {
       this.generateMusicDescription();
    }
    this.savePromptsToStorage();
  }
  
  private setPrompts(newPrompts: Map<string, Prompt>) {
    this.prompts = newPrompts;
    this.requestUpdate();
    if (this.tonePlayer && (this.playbackState === 'playing' || this.playbackState === 'loading' || (this.playbackState === 'paused' && this.tonePlayer.isReady()))) {
       this.generateMusicDescription();
    }
    this.savePromptsToStorage();
  }

  private readonly makeBackground = throttle(() => {
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
    const MAX_WEIGHT_EFFECT = 1.0;
    const MAX_ALPHA = 0.5;

    const bg: string[] = [];
    if (!this.prompts) return ''; 
    [...this.prompts.values()].forEach((p, i) => {
      const scaledWeight = p.weight / 2;
      const alphaPct = clamp01(scaledWeight / MAX_WEIGHT_EFFECT) * MAX_ALPHA;
      const alpha = Math.round(alphaPct * 0xff).toString(16).padStart(2, '0');
      const stop = scaledWeight * 50;
      const x = (i % 4) / 3;
      const y = Math.floor(i / 4) / 3;
      const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop}%)`;
      bg.push(s);
    });
    return bg.join(', ');
  }, 30);

  private async play() {
    try {
      if ((Tone.context.state as AudioContextState) !== 'running') {
        console.log("VocalAI Desi: play() - AudioContext not running. Attempting Tone.start().");
        await Tone.start();
        console.log("VocalAI Desi: play() - Tone.start() attempt completed. New state:", Tone.context.state);
        if (Tone.context.state !== 'running') {
            this.toastMessage?.show({ message: "Failed to start audio. Please click play again or check browser permissions." });
            this.playbackState = 'stopped';
            return;
        }
      }
    } catch (error: any) {
      console.error("VocalAI Desi: Tone.start() in play() failed.");
      let errorName = 'Unknown Error';
      let errorMessageText = 'Failed to start audio context.';
       if (error instanceof Error) {
        errorName = error.name;
        errorMessageText = error.message || errorMessageText;
      }
      console.error(`Error Name: ${errorName}`);
      console.error(`Error Message: ${errorMessageText}`);
      let userMessage = "Audio Start Failed: Could not enable audio. Please ensure your browser allows sound and try clicking Play again.";
      if (errorName === 'NotAllowedError' || (errorMessageText && errorMessageText.toLowerCase().includes('user gesture'))) {
        userMessage = "Audio Error: Browser requires interaction to start audio. Click Play or tap screen.";
      } else if (errorMessageText && !errorMessageText.toLowerCase().includes('failed to start audio context')) {
        // Provide a more specific message if available, otherwise keep the default.
        userMessage = `Audio Start Failed: ${errorMessageText}. Please try again.`;
      }
      this.toastMessage?.show({
        message: userMessage,
        intent: 'danger',
        icon: 'error',
      });
      this.playbackState = 'stopped';
      return;
    }

    const audioReady = await this.ensureAudioComponentsInitialized();
    if (!audioReady || !this.tonePlayer) {
      // ensureAudioComponentsInitialized will show its own toast if it fails
      this.playbackState = this.playbackState === 'loading' ? 'paused' : 'stopped';
      return;
    }
    
    if (!this.tonePlayer.isReady() || this.getActivePrompts().length === 0) {
        this.toastMessage.show({ message: 'Generating initial soundscape...' });
        this.playbackState = 'loading';
        await this.generateMusicDescription(); 
        
        if (!this.tonePlayer.isReady() && this.getActivePrompts().length === 0) {
            this.playbackState = 'paused';
            this.toastMessage.show({ message: 'Please activate a prompt by turning its knob up.' });
            return;
        }
        if (!this.tonePlayer.isReady()){ // Could have failed during generateMusicDescription
            this.playbackState = 'paused';
            // generateMusicDescription would have shown a toast.
            return;
        }
    }
    this.tonePlayer.play();
    this.playbackState = 'playing';
  }

  private pause() {
    if (!this.tonePlayer) return;
    this.tonePlayer.pause();
    this.playbackState = 'paused';
  }

  private stop() {
    if (!this.tonePlayer) return;
    this.tonePlayer.stop();
    this.playbackState = 'stopped';
  }

  private async handlePlayPause() {
    try {
      if (this.isGenerating && this.playbackState === 'loading') {
        this.toastMessage.show({ message: 'Music is currently generating...' });
        return;
      }

      if (this.playbackState === 'playing') {
        this.pause();
      } else if (this.playbackState === 'paused' || this.playbackState === 'stopped') {
        await this.play();
      }
    } catch (error: any) {
        console.error("VocalAI Desi: Error during play/pause operation.");
        let errorName = 'Unknown Error';
        let errorMessageText = '(No message)';
        let errorStack = '(No stack trace)';

        if (error instanceof Error) {
            errorName = error.name;
            errorMessageText = error.message || errorMessageText;
            errorStack = error.stack || errorStack;
        } else if (typeof error === 'string') {
            errorMessageText = error;
        }
        console.error(`Error Name: ${errorName}`);
        console.error(`Error Message: ${errorMessageText}`);
        console.error(`Error Stack: ${errorStack}`);
        if (typeof error === 'object' && error !== null && !(error instanceof Error)) {
            console.error("Raw error object (details below):");
            console.error(error);
        } else if (typeof error !== 'string' && !(error instanceof Error)) {
            console.error("Raw error (primitive or unknown type):");
            console.error(error);
        }

        let userErrorMessage = 'Operation failed. Please try again.';
         if (errorMessageText && errorMessageText !== '(No message)') {
            const lowerCaseMessage = errorMessageText.toLowerCase();
            if (lowerCaseMessage.includes('circular structure') || lowerCaseMessage.includes('converting circular structure')) {
                userErrorMessage = "A complex operation error occurred. Check console.";
            } else {
                userErrorMessage = errorMessageText.substring(0,100);
            }
        } else if (errorName !== 'Unknown Error') {
            userErrorMessage = `${errorName}: Playback operation failed.`;
        }

        if (this.toastMessage) {
            this.toastMessage.show({
              message: `Playback Error: ${userErrorMessage}`,
              intent: 'danger',
              icon: 'error',
            });
        }
        this.tonePlayer?.stop(); 
        this.playbackState = 'stopped'; 
    }
  }

  private async toggleShowMidi() {
    this.showMidi = !this.showMidi;
    if (this.showMidi && this.midiInputIds.length === 0) {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
       if (inputIds.length === 0) {
        this.toastMessage?.show({ message: "No MIDI devices detected after attempting access. Ensure MIDI is enabled in browser/iframe and connected." });
      }
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private resetAllPrompts() {
    this.setPrompts(buildDefaultPrompts());
    if (this.playbackState !== 'stopped' && this.tonePlayer) { 
        this.generateMusicDescription();
    }
  }

  private savePromptsToStorage = () => {
    const promptsToStore = Array.from(this.prompts.values());
    localStorage.setItem('vocalAiDesiPrompts', JSON.stringify(promptsToStore));
  }

  private loadPromptsFromStorage() {
    const storedPromptsJson = localStorage.getItem('vocalAiDesiPrompts');
    if (storedPromptsJson) {
      try {
        const storedPromptsArray = JSON.parse(storedPromptsJson) as Prompt[];
        const loadedPrompts = new Map(storedPromptsArray.map(p => [p.promptId, p]));
        this.prompts = loadedPrompts;
        this.requestUpdate('prompts');
      } catch (e) {
        console.error("VocalAI Desi: Failed to load prompts from storage, using defaults.", e);
        this.prompts = buildDefaultPrompts();
      }
    } else {
      this.prompts = buildDefaultPrompts();
    }
  }

  override render() {
    const bg = styleMap({ backgroundImage: this.makeBackground() });
    return html`
      <div id="background" style=${bg}></div>
      <h1 id="title">VocalAI Desi</h1>
      <div id="buttons">
        <button
          @click=${this.toggleShowMidi}
          class=${this.showMidi ? 'active' : ''}
          aria-pressed=${this.showMidi}
          aria-label="Toggle MIDI Settings"
        >MIDI</button>
        <select
          @change=${this.handleMidiInputChange}
          .value=${this.activeMidiInputId || ''}
          style=${this.showMidi ? '' : 'display: none'}
          aria-label="Select MIDI Input Device"
        >
          ${this.midiInputIds.length > 0
            ? this.midiInputIds.map(id => html`
                <option value=${id}>
                  ${this.midiDispatcher.getDeviceName(id) || `Device ${id.substring(0,6)}`}
                </option>`)
            : html`<option value="">No MIDI devices found</option>`
          }
        </select>
        <button @click=${this.resetAllPrompts} aria-label="Reset all prompts">Reset Prompts</button>
      </div>
      <div id="grid" role="grid" aria-label="Music Prompt Controllers">
        ${this.renderPrompts()}
      </div>
      <play-pause-button
        .playbackState=${this.playbackState}
        @click=${this.handlePlayPause}
        aria-label=${this.playbackState === 'playing' ? 'Pause music' : 'Play music'}
      ></play-pause-button>
      <toast-message></toast-message>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => { 
      return html`<prompt-controller
        role="gridcell"
        .promptId=${prompt.promptId}
        .filtered=${this.filteredPrompts.has(prompt.text)}
        .cc=${prompt.cc}
        .text=${prompt.text}
        .weight=${prompt.weight}
        .color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        .audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}
        aria-label="Controller for prompt: ${prompt.text}, MIDI CC ${prompt.cc}"
      ></prompt-controller>`;
    });
  }
}

function buildDefaultPrompts(): Map<string, Prompt> {
  const prompts = new Map<string, Prompt>();
  const initialActiveIndices = [0, 1, 3]; 

  DEFAULT_PROMPTS.forEach((promptData, i) => {
    const promptId = `prompt-${i}`;
    prompts.set(promptId, {
      promptId,
      text: promptData.text,
      weight: initialActiveIndices.includes(i) ? 0.5 : 0,
      cc: i, 
      color: promptData.color,
    });
  });
  return prompts;
}

// Main execution
function main(parent: HTMLElement) {
  const midiDispatcher = new MidiDispatcher();
  const initialPrompts = buildDefaultPrompts();
  const app = new VocalAiDesi(initialPrompts, midiDispatcher);
  parent.appendChild(app);
}

main(document.body);