import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import { parseBlackboxCsv } from '@core/blackbox/parse'

@customElement('bbl-dropzone')
export class BblDropzone extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
        margin-bottom: var(--fpv-space-lg);
      }

      .dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--fpv-space-xs);
        border: 2px dashed var(--fpv-border);
        border-radius: var(--fpv-radius-md);
        padding: var(--fpv-space-xl) var(--fpv-space-lg);
        cursor: pointer;
        color: var(--fpv-text-muted);
        transition: border-color 0.15s ease, background 0.15s ease;
        user-select: none;
        min-height: 140px;
      }

      .dropzone:hover {
        border-color: var(--fpv-primary);
        background: color-mix(in srgb, var(--fpv-primary) 5%, transparent);
      }

      .dropzone.drag-over {
        border-color: var(--fpv-primary);
        background: color-mix(in srgb, var(--fpv-primary) 12%, transparent);
      }

      .icon {
        font-size: 2.2rem;
        line-height: 1;
        pointer-events: none;
      }

      .label {
        font-size: var(--fpv-font-body);
        font-weight: 600;
        color: var(--fpv-text);
        pointer-events: none;
      }

      .sublabel {
        font-size: var(--fpv-font-label);
        opacity: 0.65;
        pointer-events: none;
      }

      .filename {
        margin-top: var(--fpv-space-xs);
        font-size: var(--fpv-font-label);
        color: var(--fpv-primary);
        font-family: monospace;
        pointer-events: none;
      }

      .error {
        margin-top: var(--fpv-space-xs);
        font-size: var(--fpv-font-label);
        color: var(--fpv-error);
        pointer-events: none;
      }

      input[type='file'] {
        display: none;
      }
    `,
  ]

  private _i18n = new I18nController(this)

  @state() private _dragOver = false
  @state() private _fileName = ''
  @state() private _error = ''

  // ─── Drag-and-drop ──────────────────────────────────────────────────────────

  private _onDragOver(e: DragEvent) {
    e.preventDefault()
    this._dragOver = true
  }

  private _onDragLeave() {
    this._dragOver = false
  }

  private _onDrop(e: DragEvent) {
    e.preventDefault()
    this._dragOver = false
    const file = e.dataTransfer?.files[0]
    if (file) this._processFile(file)
  }

  // ─── Click-to-browse ────────────────────────────────────────────────────────

  private _onClick() {
    this.renderRoot.querySelector<HTMLInputElement>('input[type=file]')!.click()
  }

  private _onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) this._processFile(file)
  }

  // ─── Processing ─────────────────────────────────────────────────────────────

  private _processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this._error = this._i18n.t('blackbox.error_not_csv')
      return
    }

    this._error    = ''
    this._fileName = file.name

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      try {
        const log = parseBlackboxCsv(text)
        this.dispatchEvent(
          new CustomEvent('log-loaded', {
            detail:   log,
            bubbles:  true,
            composed: true,
          })
        )
      } catch (err) {
        this._error = this._i18n.t('blackbox.error_parse', { message: err instanceof Error ? err.message : String(err) })
      }
    }
    reader.onerror = () => {
      this._error = this._i18n.t('blackbox.error_read')
    }
    reader.readAsText(file)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  render() {
    return html`
      <div
        class="dropzone ${this._dragOver ? 'drag-over' : ''}"
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
        @click=${this._onClick}
      >
        <div class="icon">&#128196;</div>
        <div class="label">${this._i18n.t('blackbox.dropzone_label')}</div>
        <div class="sublabel">${this._i18n.t('blackbox.dropzone_sub')}</div>
        ${this._fileName
          ? html`<div class="filename">${this._fileName}</div>`
          : ''}
        ${this._error
          ? html`<div class="error">${this._error}</div>`
          : ''}
      </div>
      <input type="file" accept=".csv" @change=${this._onFileChange} />
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbl-dropzone': BblDropzone
  }
}
