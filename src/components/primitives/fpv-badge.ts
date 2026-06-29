import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from './tokens.css.js'

@customElement('fpv-badge')
export class FpvBadge extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: inline-block;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 2px var(--fpv-space-sm);
        font-size: var(--fpv-font-label);
        font-family: var(--fpv-font-sans);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
      }

      .badge.success {
        color: var(--fpv-success);
        background: color-mix(in srgb, var(--fpv-success) 20%, transparent);
      }

      .badge.warning {
        color: var(--fpv-accent);
        background: color-mix(in srgb, var(--fpv-accent) 20%, transparent);
      }

      .badge.error {
        color: var(--fpv-error);
        background: color-mix(in srgb, var(--fpv-error) 20%, transparent);
      }

      .badge.info {
        color: var(--fpv-info);
        background: color-mix(in srgb, var(--fpv-info) 20%, transparent);
      }
    `,
  ]

  @property({ type: String }) variant: 'success' | 'warning' | 'error' | 'info' = 'info'

  render() {
    return html`
      <span class="badge ${this.variant}">
        <slot></slot>
      </span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-badge': FpvBadge
  }
}
