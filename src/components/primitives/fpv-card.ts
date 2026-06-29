import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from './tokens.css.js'

@customElement('fpv-card')
export class FpvCard extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }

      .card {
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        padding: var(--fpv-space-md);
      }

      .header {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: var(--fpv-space-sm);
      }
    `,
  ]

  @property({ type: String }) header = ''

  render() {
    return html`
      <div class="card">
        ${this.header ? html`<div class="header">${this.header}</div>` : ''}
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-card': FpvCard
  }
}
