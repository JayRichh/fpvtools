import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from './tokens.css.js'

export interface SelectOption {
  value: string
  label: string
}

@customElement('fpv-select')
export class FpvSelect extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }

      .row {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
      }

      .label {
        min-width: 80px;
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        flex-shrink: 0;
      }

      select {
        flex: 1;
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        color: var(--fpv-text);
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        padding: 8px 32px 8px var(--fpv-space-sm);
        min-height: 44px;
        outline: none;
        cursor: pointer;
        transition: border-color 0.15s;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M0 0l6 6 6-6' stroke='%238888a0' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
      }

      select:focus {
        border-color: var(--fpv-primary);
        box-shadow: 0 0 0 2px var(--fpv-focus-ring);
      }
    `,
  ]

  @property({ type: String }) label = ''
  @property({ type: String }) value = ''
  @property({ type: Array }) options: SelectOption[] = []

  private _onChange(e: Event) {
    const select = e.target as HTMLSelectElement
    this.value = select.value
    this.dispatchEvent(
      new CustomEvent('select-change', {
        detail: this.value,
        bubbles: true,
        composed: true,
      })
    )
  }

  render() {
    return html`
      <div class="row">
        ${this.label ? html`<span class="label">${this.label}</span>` : ''}
        <select .value=${this.value} @change=${this._onChange}>
          ${this.options.map(
            (opt) => html`
              <option value=${opt.value} ?selected=${opt.value === this.value}>
                ${opt.label}
              </option>
            `
          )}
        </select>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-select': FpvSelect
  }
}
