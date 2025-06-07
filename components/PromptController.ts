/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { WeightKnob } from './WeightKnob';
import type { MidiDispatcher } from '../utils/MidiDispatcher';
import type { Prompt, ControlChange } from '../types';

/** A single prompt input associated with a MIDI CC. */
@customElement('prompt-controller')
export class PromptController extends LitElement {
  static override styles = css`
    .prompt {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between; /* Distribute space */
      height: 100%;
      padding-bottom: 0.5vmin; /* Add some padding at the bottom */
      box-sizing: border-box;
    }
    weight-knob {
      width: 70%;
      flex-shrink: 0;
      margin-bottom: 0.75vmin; /* Space between knob and text */
    }
    #midi {
      font-family: monospace;
      text-align: center;
      font-size: 1.5vmin;
      border: 0.2vmin solid #aaa; /* Lighter border for dark theme */
      border-radius: 0.5vmin;
      padding: 2px 5px;
      color: #ccc; /* Lighter text for dark theme */
      background: rgba(0,0,0,0.4); /* Darker background */
      cursor: pointer;
      visibility: hidden;
      user-select: none;
      margin-top: 0.5vmin; /* Space between text and MIDI CC */
      .learn-mode & {
        color: #FFD600; /* Accent color for learn mode */
        border-color: #FFD600;
      }
      .show-cc & {
        visibility: visible;
      }
    }
    #text-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 4.5vmin; /* Ensure space for 2 lines of text */
    }
    #text {
      font-family: 'Google Sans', sans-serif;
      font-weight: 500;
      font-size: 1.6vmin; /* Slightly smaller for more text */
      max-width: 90%;
      min-width: 2vmin;
      padding: 0.2em 0.4em;
      border-radius: 0.3vmin;
      text-align: center;
      white-space: normal; /* Allow wrapping */
      word-break: break-word;
      overflow-wrap: break-word; /* Ensure long words break */
      overflow-y: auto; /* Allow scroll if too much text */
      max-height: 4.2vmin; /* Limit height to approx 2 lines */
      border: none;
      outline: none;
      -webkit-font-smoothing: antialiased;
      background: rgba(0,0,0,0.3); /* Darker background for text field */
      color: #e0e0e0; /* Light text */
      line-height: 1.3;
      scrollbar-width: thin;
      scrollbar-color: #FFD600 #333;
      &:focus {
        background: rgba(0,0,0,0.5);
        box-shadow: 0 0 0 1px #FFD600;
      }
    }
    :host([filtered=true]) #text {
      background: #b71c1c; /* Darker red for filtered */
      color: #fff;
    }
    @media only screen and (max-width: 700px) {
      #text {
        font-size: 1.8vmin;
        max-height: 5vmin;
      }
      weight-knob {
        width: 65%;
      }
      #midi {
        font-size: 1.8vmin;
      }
    }

    @media only screen and (max-width: 480px) {
      #text {
        font-size: 2.2vmin; /* Increased from 1.8vmin for smaller screens */
        max-height: 6vmin; /* Allow a bit more height if font is larger */
      }
      weight-knob {
        width: 75%; /* Increased from 65% */
        margin-bottom: 1vmin; /* Adjusted spacing */
      }
      #midi {
        font-size: 2vmin; /* Increased from 1.8vmin */
      }
      .prompt {
        padding-bottom: 1vmin; /* Adjusted spacing */
      }
      #text-container {
        min-height: 6.5vmin; /* Adjusted for larger font */
      }
    }
  `;

  @property({ type: String }) promptId = '';
  @property({ type: String }) text = '';
  @property({ type: Number }) weight = 0;
  @property({ type: String }) color = '';

  @property({ type: Number }) cc = 0;
  @property({ type: Number }) channel = 0; // Not currently used

  @state() private learnMode = false; // Use @state for internal reactive properties
  @property({ type: Boolean, reflect: true }) showCC = false; // reflect to use in CSS :host selector

  @query('weight-knob') private weightInput!: WeightKnob;
  @query('#text') private textInput!: HTMLDivElement; // Use div for contenteditable

  @property({ type: Object })
  midiDispatcher: MidiDispatcher | null = null;

  @property({ type: Number }) audioLevel = 0;
  @property({ type: Boolean, reflect: true }) filtered = false;


  private lastValidText!: string;

  override connectedCallback() {
    super.connectedCallback();
    this.midiDispatcher?.addEventListener('cc-message', this.handleMidiMessage);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.midiDispatcher?.removeEventListener('cc-message', this.handleMidiMessage);
  }
  
  private handleMidiMessage = (e: Event) => {
      const customEvent = e as CustomEvent<ControlChange>;
      const { channel, cc, value } = customEvent.detail;
      if (this.learnMode) {
        this.cc = cc;
        // this.channel = channel; // If you plan to use channel
        this.learnMode = false;
        this.dispatchPromptChange();
      } else if (cc === this.cc) {
        // Assuming MIDI CC 0-127 maps to weight 0-2
        this.weight = (value / 127) * 2;
        this.dispatchPromptChange();
      }
    };

  override firstUpdated() {
    this.textInput.textContent = this.text;
    this.lastValidText = this.text;
  }

  override updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has('showCC') && !this.showCC) {
      this.learnMode = false; // Exit learn mode if MIDI display is hidden
    }
    if (changedProperties.has('text')) {
      if (this.textInput && this.textInput.textContent !== this.text) {
         this.textInput.textContent = this.text;
         this.lastValidText = this.text;
      }
    }
  }

  private dispatchPromptChange() {
    this.dispatchEvent(
      new CustomEvent<Prompt>('prompt-changed', {
        bubbles: true, // Allow event to bubble up
        composed: true, // Allow event to cross shadow DOM boundaries
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          cc: this.cc,
          color: this.color,
        },
      }),
    );
  }

  private handleTextInput(e: Event) {
    // For contenteditable, text is updated on blur or can be forced on input
    // For simplicity, we update on blur. If real-time update from text is needed,
    // this needs to be handled carefully with caret position etc.
  }

  private handleTextBlur() {
    const newText = this.textInput.textContent?.trim().replace(/\s+/g, ' '); // Normalize spaces
    if (newText && newText !== this.text) {
      this.text = newText;
      this.lastValidText = newText;
      this.dispatchPromptChange();
    } else if (!newText && this.lastValidText) {
        // Revert to last valid text if input is cleared
        this.textInput.textContent = this.lastValidText;
        this.text = this.lastValidText; // ensure state matches
    }
  }


  private onFocus() {
    // Select all text in contenteditable div
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(this.textInput);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchPromptChange();
  }

  private toggleLearnMode() {
    if (!this.showCC) return; // Can only enter learn mode if CCs are visible
    this.learnMode = !this.learnMode;
  }

  override render() {
    // classMap needs boolean values.
    const hostClasses = {
        'learn-mode': this.learnMode && this.showCC, // learnMode only active if showCC is true
        'show-cc': this.showCC
    };

    return html`
    <div class="prompt ${classMap(hostClasses)}">
      <weight-knob
        id="weight"
        .value=${this.weight}
        .color=${this.color}
        .audioLevel=${this.audioLevel}
        @input=${this.updateWeight}
        aria-label="Weight for prompt ${this.text}"
        aria-valuenow=${this.weight}
        aria-valuemin="0"
        aria-valuemax="2"
      ></weight-knob>
      <div id="text-container">
        <div
            id="text"
            contenteditable="true"
            spellcheck="false"
            @focus=${this.onFocus}
            @blur=${this.handleTextBlur}
            @input=${this.handleTextInput}
            role="textbox"
            aria-label="Prompt text"
            aria-multiline="true"
        >${this.text}</div>
      </div>
      <div 
        id="midi" 
        @click=${this.toggleLearnMode} 
        role="button" 
        tabindex="0"
        aria-pressed=${this.learnMode}
        aria-label=${this.learnMode ? `Learning MIDI CC. Send a CC message.` : `Assign MIDI CC. Current: ${this.cc}. Click to learn.`}
      >
        ${this.learnMode && this.showCC ? 'Learn...' : `CC: ${this.cc}`}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-controller': PromptController;
  }
}
