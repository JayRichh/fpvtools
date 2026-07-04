import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { activeSetup, type ActiveSetup } from '@core/setup/store'

/**
 * Compact cross-tool setup chip. Shows the active setup summary; the host tool
 * listens for `setup-apply` (fill my inputs from the setup) and `setup-save`
 * (write my current values into the setup). Nothing is applied automatically —
 * no surprise overwrites.
 */
@customElement('fpv-setup-chip')
export class FpvSetupChip extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host { display: block; }

      .chip {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--fpv-space-xs) var(--fpv-space-sm);
        padding: var(--fpv-space-xs) var(--fpv-space-sm);
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        margin-bottom: var(--fpv-space-md);
        min-height: 40px;
      }

      .label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }

      .summary {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-label);
        color: var(--fpv-text);
        display: flex;
        flex-wrap: wrap;
        gap: 2px var(--fpv-space-sm);
        flex: 1;
        min-width: 0;
      }

      .summary span { white-space: nowrap; }

      .empty {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        font-style: italic;
        flex: 1;
      }

      button {
        background: transparent;
        border: 1px solid var(--fpv-border);
        color: var(--fpv-text-muted);
        border-radius: var(--fpv-radius-sm);
        padding: 4px 12px;
        cursor: pointer;
        font-family: var(--fpv-font-sans);
        font-size: var(--fpv-font-label);
        min-height: 30px;
        white-space: nowrap;
        transition: border-color 0.12s, color 0.12s;
      }

      button:hover {
        border-color: var(--fpv-primary);
        color: var(--fpv-primary);
      }

      button.primary {
        border-color: color-mix(in srgb, var(--fpv-primary) 40%, transparent);
        color: var(--fpv-primary);
      }

      button.clear {
        padding: 4px 8px;
      }
    `,
  ]

  private _unsub: (() => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    this._unsub = activeSetup.subscribe(() => this.requestUpdate())
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsub?.()
  }

  private _apply() {
    const setup = activeSetup.get()
    if (!setup) return
    this.dispatchEvent(new CustomEvent<ActiveSetup>('setup-apply', {
      detail: setup, bubbles: true, composed: true,
    }))
  }

  private _save() {
    this.dispatchEvent(new CustomEvent('setup-save', {
      bubbles: true, composed: true,
    }))
  }

  private _summaryParts(s: ActiveSetup): string[] {
    const parts: string[] = []
    if (s.auwG !== undefined) parts.push(`${s.auwG} g`)
    if (s.cellCount !== undefined) {
      parts.push(`${s.cellCount}S${s.parallelCount && s.parallelCount > 1 ? `${s.parallelCount}P` : ''}`)
    }
    if (s.chemistry) parts.push(s.chemistry === 'lipo' ? 'LiPo' : 'Li-ion')
    if (s.capacityPerCellMah !== undefined) parts.push(`${s.capacityPerCellMah} mAh`)
    if (s.hoverEfficiencyGPerW !== undefined) parts.push(`${s.hoverEfficiencyGPerW.toFixed(1)} g/W`)
    if (s.motorName) parts.push(s.motorName)
    if (s.propName) parts.push(s.propName)
    if (s.vtxPowerMw !== undefined) parts.push(`${s.vtxPowerMw} mW VTX`)
    return parts
  }

  render() {
    const setup = activeSetup.hasData() ? activeSetup.get() : null
    return html`
      <div class="chip">
        <span class="label">Setup</span>
        ${setup
          ? html`
              <div class="summary" title="Shared across Motors, Power, Flight Time and RF">
                ${this._summaryParts(setup).map(p => html`<span>${p}</span>`)}
              </div>
              <button class="primary" @click=${this._apply}>Apply here</button>
            `
          : html`<span class="empty">No active setup yet: save one from any tool</span>`}
        <button @click=${this._save}>Save from this tool</button>
        ${setup ? html`<button class="clear" title="Clear setup" @click=${() => activeSetup.clear()}>×</button>` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fpv-setup-chip': FpvSetupChip
  }
}
