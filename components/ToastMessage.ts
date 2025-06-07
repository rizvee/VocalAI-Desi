/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

@customElement('toast-message')
export class ToastMessage extends LitElement {
  static override styles = css`
    .toast {
      line-height: 1.6;
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #000;
      color: white;
      padding: 15px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      min-width: 200px;
      max-width: 80vw;
      transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
    }
    button {
      border-radius: 100px;
      aspect-ratio: 1;
      border: none;
      color: #000;
      cursor: pointer;
    }
    .toast:not(.showing) {
      transition-duration: 1s;
      transform: translate(-50%, -200%);
    }
    .toast--danger {
      background-color: #b71c1c; /* A dark red color */
      color: white;
    }
    .toast--danger button { /* Assuming default button is light */
      color: #b71c1c;
      background-color: white;
    }
  `;

  @property({ type: String }) message = '';
  @property({ type: Boolean }) showing = false;
  @property({ type: String }) private currentIntent = '';

  override render() {
    return html`<div class=${classMap({
      showing: this.showing,
      toast: true,
      [`toast--${this.currentIntent}`]: !!this.currentIntent,
    })}>
      <div class="message">${this.message}</div>
      <button @click=${this.hide}>✕</button>
    </div>`;
  }

  show(options: { message: string; intent?: string, icon?: string }) { // Added icon to options for future use, though not used in this step
    this.message = options.message;
    this.currentIntent = options.intent || '';
    this.showing = true;
  }

  hide() {
    this.showing = false;
    // It's good practice to reset intent when hiding, though not strictly necessary if show always sets it.
    // this.currentIntent = ''; // Let's not reset here, show() will overwrite. Resetting might cause a flicker if hide is slow.
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'toast-message': ToastMessage
  }
}
