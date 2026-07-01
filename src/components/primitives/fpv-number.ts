import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tokenStyles } from './tokens.css.js'

@customElement('fpv-number')
export class FpvNumber extends LitElement {
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

      .input-wrap {
        flex: 1;
        display: flex;
        align-items: center;
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        padding: 6px var(--fpv-space-sm);
        min-height: 44px;
        box-sizing: border-box;
        transition: border-color 0.15s;
      }

      .input-wrap:focus-within {
        border-color: var(--fpv-primary);
        box-shadow: 0 0 0 2px var(--fpv-focus-ring);
      }

      input[type='number'] {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--fpv-text);
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-body);
        min-width: 0;
        padding: 0;
        -moz-appearance: textfield;
      }

      input[type='number']::-webkit-inner-spin-button,
      input[type='number']::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .unit {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        margin-left: 2px;
        flex-shrink: 0;
      }
    `,
  ]

  @property({ type: String }) label = ''
  @property({ type: Number }) value = 0
  @property({ type: Number }) min = -Infinity
  @property({ type: Number }) max = Infinity
  @property({ type: Number }) step = 1
  @property({ type: String }) unit = ''

  private _commitBlocked = false

  private _decimalPlaces(step: number): number {
    const s = step.toString()
    const dot = s.indexOf('.')
    return dot < 0 ? 0 : s.length - dot - 1
  }

  private _clampSnap(raw: number): number {
    const clamped = Math.min(this.max, Math.max(this.min, raw))
    if (this.step > 0 && isFinite(this.step)) {
      const snapped = Math.round((clamped - this.min) / this.step) * this.step + this.min
      const dp = this._decimalPlaces(this.step)
      return parseFloat(Math.min(this.max, Math.max(this.min, snapped)).toFixed(dp))
    }
    return clamped
  }

  private _commit(input: HTMLInputElement) {
    const raw = Number(input.value)
    if (!isNaN(raw)) {
      const newValue = this._clampSnap(raw)
      this.value = newValue
      // Keep the displayed value in sync with the committed (clamped/snapped) value
      input.value = String(newValue)
      this.dispatchEvent(
        new CustomEvent('value-change', {
          detail: newValue,
          bubbles: true,
          composed: true,
        })
      )
    }
  }

  private _onChange(e: Event) {
    if (this._commitBlocked) { this._commitBlocked = false; return }
    this._commit(e.target as HTMLInputElement)
  }

  private _onKeydown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement
    if (e.key === 'Enter') {
      e.preventDefault()
      this._commitBlocked = true
      this._commit(input)
      input.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this._commitBlocked = true
      // Revert displayed value to the last committed prop value
      input.value = String(this.value)
      input.blur()
    }
  }

  render() {
    return html`
      <div class="row">
        <span class="label">${this.label}</span>
        <div class="input-wrap">
          <input
            type="number"
            .value=${String(this.value)}
            min=${this.min}
            max=${this.max}
            step=${this.step}
            @focus=${(e: FocusEvent) => { this._commitBlocked = false; (e.target as HTMLInputElement).select() }}
            @change=${this._onChange}
            @keydown=${this._onKeydown}
          />
          ${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-number': FpvNumber
  }
}
