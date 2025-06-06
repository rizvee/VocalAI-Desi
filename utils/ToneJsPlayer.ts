/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Tone from 'tone';
import type { MusicDescription, Prompt } from '../types';

export class ToneJsPlayer {
  private outputNode: Tone.Gain;
  private instruments: Map<string, Tone.Synth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.FMSynth | Tone.AMSynth | Tone.PluckSynth | Tone.MetalSynth | any> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private masterChannel: Tone.Channel;
  private isMusicReady: boolean = false;

  constructor(destinationNode?: AudioNode) {
    this.outputNode = new Tone.Gain(1).toDestination(); // Default to master destination
    this.masterChannel = new Tone.Channel(0, 0).connect(this.outputNode);

    if (destinationNode) {
      this.masterChannel.disconnect(Tone.getDestination());
      // Connect to the provided Web Audio API AudioNode directly
      this.masterChannel.connect(destinationNode);
    }
    Tone.Transport.bpm.value = 120; // Default BPM
  }

  public getOutputNode(): Tone.Gain {
    return this.outputNode;
  }

  public isPlaying(): boolean {
    return Tone.Transport.state === 'started';
  }

  public isReady(): boolean {
    return this.isMusicReady;
  }
  
  private applyEffects(instrument: any, effects: MusicDescription['instruments'][0]['effects']) {
    if (!effects || !instrument.chain) return; 

    const effectNodes = [];
    for (const effectConfig of effects) {
        let effectNode;
        switch (effectConfig.type) {
            case 'Reverb':
                effectNode = new Tone.Reverb({
                    decay: effectConfig.decay ?? 1.5,
                    preDelay: (effectConfig as any).preDelay ?? 0.01,
                    wet: (effectConfig as any).wet ?? 0.5
                });
                break;
            case 'Delay':
                effectNode = new Tone.FeedbackDelay({
                    delayTime: (effectConfig as any).delayTime ?? "8n",
                    feedback: (effectConfig as any).feedback ?? 0.25,
                    wet: (effectConfig as any).wet ?? 0.3
                });
                break;
            case 'Chorus':
                 effectNode = new Tone.Chorus({
                    frequency: (effectConfig as any).frequency ?? 1.5,
                    delayTime: (effectConfig as any).delayTime ?? 3.5,
                    depth: (effectConfig as any).depth ?? 0.7,
                    wet: (effectConfig as any).wet ?? 0.5
                }).start(); // Chorus needs to be started
                break;
            // Add more effects as defined in MusicDescription
            default:
                console.warn(`Unsupported effect type: ${effectConfig.type}`);
                continue;
        }
        if (effectNode) {
            effectNodes.push(effectNode);
        }
    }
    if (effectNodes.length > 0) {
        instrument.chain(...effectNodes, this.masterChannel);
    } else {
        instrument.connect(this.masterChannel);
    }
  }


  public updateMusic(description: MusicDescription): void {
    this.isMusicReady = false; // Set to false until all parts are set up
    Tone.Transport.cancel(); 
    this.parts.forEach(part => part.dispose());
    this.parts.clear();
    this.instruments.forEach(instrument => instrument.dispose());
    this.instruments.clear();

    Tone.Transport.bpm.value = description.tempo || 120;
    if (description.timeSignature) {
        Tone.Transport.timeSignature = description.timeSignature;
    }

    description.instruments.forEach(instrDesc => {
      let instrument;
      const options = instrDesc.options || {};
      switch (instrDesc.type) {
        case 'MembraneSynth':
          instrument = new Tone.MembraneSynth(options);
          break;
        case 'NoiseSynth':
          instrument = new Tone.NoiseSynth(options);
          break;
        case 'FMSynth':
          instrument = new Tone.FMSynth(options);
          break;
        case 'AMSynth':
          instrument = new Tone.AMSynth(options);
          break;
        case 'PluckSynth':
          instrument = new Tone.PluckSynth(options);
          break;
        case 'MetalSynth':
          instrument = new Tone.MetalSynth(options);
          break;
        case 'Synth':
        default:
          instrument = new Tone.Synth(options);
          break;
      }
      instrument.volume.value = instrDesc.volume ?? -12;
      this.applyEffects(instrument, instrDesc.effects);
      if (!instrDesc.effects || instrDesc.effects.length === 0) {
        instrument.connect(this.masterChannel);
      }
      this.instruments.set(instrDesc.name, instrument);
    });

    description.patterns.forEach(patternDesc => {
      const instrument = this.instruments.get(patternDesc.instrumentName);
      if (!instrument) {
        console.warn(`Instrument "${patternDesc.instrumentName}" not found for pattern.`);
        return;
      }

      const events = patternDesc.sequence.map(event => {
        if (typeof event === 'string') return event; 
        return {
          time: event.time,
          note: (event as any).note, 
          duration: event.duration,
          velocity: event.velocity,
        };
      });
      
      const part = new Tone.Part((time, value: any) => {
        if (instrument instanceof Tone.NoiseSynth) {
            instrument.triggerAttackRelease(value.duration || "8n", time, value.velocity || 0.8);
        } else if (instrument.triggerAttackRelease) {
            instrument.triggerAttackRelease(value.note, value.duration, time, value.velocity);
        } else if (instrument.triggerAttack) { 
            instrument.triggerAttack(value.note, time, value.velocity);
        }
      }, events);

      const loopSetting = patternDesc.loop;
      if (typeof loopSetting === 'string') {
        part.loop = true;
        part.loopEnd = loopSetting;
      } else if (typeof loopSetting === 'number') {
        part.loop = loopSetting;
      } else if (typeof loopSetting === 'boolean') {
        part.loop = loopSetting;
      } else {
        part.loop = true;
      }
      
      part.probability = patternDesc.probability ?? 1;
      part.start(0);
      this.parts.set(patternDesc.instrumentName, part);
    });
    this.isMusicReady = true; // Music is now ready
  }

  public play(): void {
    if (Tone.context.state !== 'running') {
      Tone.start().then(() => {
        if (this.isMusicReady) { // Check if music structure is also ready
            Tone.Transport.start();
        } else {
            console.warn("ToneJsPlayer: Play called, context started, but music is not ready.");
        }
      }).catch(err => {
        console.error("ToneJsPlayer: Tone.js failed to start AudioContext:", err);
      });
    } else {
      if (this.isMusicReady) { // Check if music structure is also ready
        Tone.Transport.start();
      } else {
         console.warn("ToneJsPlayer: Play called, context already running, but music is not ready.");
      }
    }
  }

  public pause(): void {
    Tone.Transport.pause();
  }

  public stop(): void {
    Tone.Transport.stop();
    Tone.Transport.position = 0; 
    this.instruments.forEach(instrument => {
        if (instrument.releaseAll) { 
            instrument.releaseAll();
        } else if (instrument.triggerRelease && typeof instrument.triggerRelease === 'function') {
           // This specific handling might be too aggressive or not needed if parts stop correctly.
        }
    });
    this.isMusicReady = false; // Music is no longer considered ready after a full stop.
  }

  public setVolume(level: number): void { 
    this.outputNode.gain.value = level; 
  }
}
