import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { tokenStyles } from './tokens.css.js'

@customElement('fpv-slider')
export class FpvSlider extends LitElement {
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
        min-height: 44px;
      }

      .label {
        min-width: 80px;
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        flex-shrink: 0;
      }

      input[type='range'] {
        flex: 1;
        appearance: none;
        height: 4px;
        background: var(--fpv-border);
        border-radius: 999px;
        outline: none;
        cursor: pointer;
      }

      input[type='range']::-webkit-slider-thumb {
        appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--fpv-primary);
        cursor: pointer;
        transition: transform 0.1s;
      }

      input[type='range']::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }

      input[type='range']::-moz-range-thumb {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--fpv-primary);
        border: none;
        cursor: pointer;
      }

      .value {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-label);
        color: var(--fpv-text);
        min-width: 48px;
        text-align: right;
        flex-shrink: 0;
        cursor: pointer;
        user-select: none;
      }

      .value:hover {
        color: var(--fpv-primary);
      }

      .value-input {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-label);
        color: var(--fpv-text);
        min-width: 48px;
        width: 64px;
        text-align: right;
        flex-shrink: 0;
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-primary);
        border-radius: var(--fpv-radius-sm);
        outline: none;
        padding: 2px 4px;
        box-sizing: border-box;
        -moz-appearance: textfield;
      }

      .value-input::-webkit-inner-spin-button,
      .value-input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    `,
  ]

  @property({ type: String }) label = ''
  @property({ type: Number }) value = 0
  @property({ type: Number }) min = 0
  @property({ type: Number }) max = 100
  @property({ type: Number }) step = 1
  @property({ type: String }) unit = ''

  @state() private _editing = false
  private _editBlocked = false

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

  private _emit(v: number) {
    this.dispatchEvent(
      new CustomEvent('value-change', {
        detail: v,
        bubbles: true,
        composed: true,
      })
    )
  }

  private _onInput(e: Event) {
    const input = e.target as HTMLInputElement
    const newValue = Number(input.value)
    this.value = newValue
    this._emit(newValue)
  }

  private _onValueClick() {
    this._editBlocked = false
    this._editing = true
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>('.value-input')
      if (input) { input.focus(); input.select() }
    })
  }

  private _onEditBlur(e: FocusEvent) {
    if (this._editBlocked) { this._editBlocked = false; return }
    const input = e.target as HTMLInputElement
    const raw = Number(input.value)
    if (!isNaN(raw)) {
      const v = this._clampSnap(raw)
      this.value = v
      this._emit(v)
    }
    this._editing = false
  }

  private _onEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      this._editBlocked = true
      const input = e.target as HTMLInputElement
      const raw = Number(input.value)
      if (!isNaN(raw)) {
        const v = this._clampSnap(raw)
        this.value = v
        this._emit(v)
      }
      this._editing = false
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this._editBlocked = true
      this._editing = false
    }
  }

  render() {
    return html`
      <div class="row">
        <span class="label">${this.label}</span>
        <input
          type="range"
          .value=${String(this.value)}
          min=${this.min}
          max=${this.max}
          step=${this.step}
          @input=${this._onInput}
        />
        ${this._editing
          ? html`<input
              class="value-input"
              type="number"
              .value=${String(this.value)}
              min=${this.min}
              max=${this.max}
              step=${this.step}
              @blur=${this._onEditBlur}
              @keydown=${this._onEditKeydown}
            />`
          : html`<span class="value" @click=${this._onValueClick}>${this.value}${this.unit}</span>`
        }
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-slider': FpvSlider
  }
}
