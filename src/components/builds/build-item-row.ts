import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import type { BuildItem } from '@core/builds/types.js'

@customElement('build-item-row')
export class BuildItemRow extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host { display: block; }

      .row {
        display: grid;
        grid-template-columns: 44px 1fr auto;
        align-items: start;
        gap: var(--fpv-space-sm);
        padding: var(--fpv-space-sm) 0;
        border-bottom: 1px solid var(--fpv-border);
      }
      .row:last-child { border-bottom: none; }

      .check-col {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
      }

      input[type="checkbox"] {
        width: 20px; height: 20px;
        accent-color: var(--fpv-primary);
        cursor: pointer;
      }

      .info-col {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-top: 10px;
      }

      .item-name {
        font-size: var(--fpv-font-body);
        color: var(--fpv-text);
        font-weight: 500;
      }
      .item-name.bought {
        text-decoration: line-through;
        color: var(--fpv-text-muted);
      }

      .item-meta {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-xs);
        flex-wrap: wrap;
      }

      .price {
        font-family: var(--fpv-font-mono);
        font-size: var(--fpv-font-label);
        color: var(--fpv-text);
      }

      .dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        display: inline-block;
      }
      .dot-confirmed { background: var(--fpv-success); }
      .dot-estimate { background: var(--fpv-text-muted); }

      .badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 99px;
        font-weight: 500;
        border: 1px solid;
      }
      .badge-in { color: var(--fpv-success); border-color: color-mix(in srgb, var(--fpv-success) 40%, transparent); }
      .badge-out { color: var(--fpv-error); border-color: color-mix(in srgb, var(--fpv-error) 40%, transparent); }
      .badge-check { color: var(--fpv-accent); border-color: color-mix(in srgb, var(--fpv-accent) 40%, transparent); }
      .badge-verified { color: var(--fpv-primary); border-color: color-mix(in srgb, var(--fpv-primary) 40%, transparent); }

      .note {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        font-style: italic;
        margin-top: 2px;
      }

      .note-edit-row {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-xs);
        margin-top: var(--fpv-space-xs);
      }

      textarea {
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-primary);
        border-radius: var(--fpv-radius-sm);
        color: var(--fpv-text);
        padding: 6px 8px;
        font-family: var(--fpv-font-sans);
        font-size: var(--fpv-font-label);
        resize: vertical;
        min-height: 60px;
        width: 100%;
        box-sizing: border-box;
      }

      .action-row {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-xs);
        flex-wrap: wrap;
        margin-top: var(--fpv-space-xs);
      }

      .action-row.delete-confirm {
        background: color-mix(in srgb, var(--fpv-error) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--fpv-error) 30%, transparent);
        border-radius: var(--fpv-radius-sm);
        padding: 4px var(--fpv-space-xs);
      }

      .btn {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: var(--fpv-radius-sm);
        font-size: 12px;
        font-family: var(--fpv-font-sans);
        cursor: pointer;
        border: 1px solid;
        min-height: 30px;
        white-space: nowrap;
        text-decoration: none;
      }
      .btn-link {
        background: transparent;
        border-color: var(--fpv-border);
        color: var(--fpv-text-muted);
      }
      .btn-link:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }
      .btn-ghost {
        background: transparent;
        border-color: transparent;
        color: var(--fpv-text-muted);
      }
      .btn-ghost:hover { color: var(--fpv-text); }
      .btn-danger {
        background: transparent;
        border-color: color-mix(in srgb, var(--fpv-error) 40%, transparent);
        color: var(--fpv-error);
      }
      .btn-danger:hover { background: color-mix(in srgb, var(--fpv-error) 12%, transparent); }
      .btn-primary {
        background: transparent;
        border-color: color-mix(in srgb, var(--fpv-primary) 50%, transparent);
        color: var(--fpv-primary);
      }
      .btn-primary:hover { background: color-mix(in srgb, var(--fpv-primary) 12%, transparent); }
      .btn-sm-confirm { font-size: 11px; padding: 3px 8px; min-height: 26px; }

      .sep { color: var(--fpv-border); }
    `,
  ]

  @property({ type: Object }) item!: BuildItem
  @property({ type: Boolean }) bought = false
  @property({ type: String }) noteOverride = ''

  @state() private _editingNote = false
  @state() private _noteEdit = ''
  @state() private _deletePending = false

  private _dispatch(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private _toggleBought() { this._dispatch('item-bought', { id: this.item.id, value: !this.bought }) }
  private _editNote() { this._noteEdit = this.noteOverride || this.item.note; this._editingNote = true }
  private _saveNote() { this._dispatch('item-note', { id: this.item.id, value: this._noteEdit }); this._editingNote = false }
  private _cancelNote() { this._editingNote = false }
  private _requestDelete() { this._deletePending = true }
  private _confirmDelete() { this._dispatch('item-delete', { id: this.item.id }); this._deletePending = false }
  private _cancelDelete() { this._deletePending = false }
  private _requestEdit() { this._dispatch('item-edit', { id: this.item.id }) }

  private _stockBadge() {
    if (this.item.stock === 'in') return html`<span class="badge badge-in">In Stock</span>`
    if (this.item.stock === 'out') return html`<span class="badge badge-out">Out of Stock</span>`
    return html`<span class="badge badge-check">Check</span>`
  }

  private _displayNote() { return this.noteOverride || this.item.note }

  render() {
    const note = this._displayNote()
    return html`
      <div class="row">
        <div class="check-col">
          <input type="checkbox" .checked=${this.bought} @change=${this._toggleBought} aria-label="Mark as bought" />
        </div>
        <div class="info-col">
          <span class="item-name ${this.bought ? 'bought' : ''}">${this.item.name}</span>
          <div class="item-meta">
            <span class="price">NZD $${this.item.price.toFixed(2)}</span>
            <span class="dot ${this.item.confirmed ? 'dot-confirmed' : 'dot-estimate'}" title="${this.item.confirmed ? 'Price confirmed' : 'Estimated price'}"></span>
            ${this._stockBadge()}
            ${this.item.verified ? html`<span class="badge badge-verified">✓ Verified</span>` : ''}
          </div>

          ${note && !this._editingNote ? html`<div class="note">${note}</div>` : ''}

          ${this._editingNote ? html`
            <div class="note-edit-row">
              <textarea .value=${this._noteEdit} @input=${(e: Event) => this._noteEdit = (e.target as HTMLTextAreaElement).value}></textarea>
              <div class="action-row">
                <button class="btn btn-primary btn-sm-confirm" @click=${this._saveNote}>Save</button>
                <button class="btn btn-ghost btn-sm-confirm" @click=${this._cancelNote}>Cancel</button>
              </div>
            </div>
          ` : ''}

          ${!this._editingNote && !this._deletePending ? html`
            <div class="action-row">
              ${this.item.url ? html`<a class="btn btn-link" href=${this.item.url} target="_blank" rel="noopener noreferrer">Buy at ${this.item.store} →</a>` : ''}
              ${this.item.backups.map(b => html`<a class="btn btn-link" href=${b.url} target="_blank" rel="noopener noreferrer">${b.label} →</a>`)}
              <button class="btn btn-ghost" @click=${this._editNote}>Edit note</button>
              <button class="btn btn-ghost" @click=${this._requestEdit}>Edit item</button>
              <button class="btn btn-danger" @click=${this._requestDelete}>Delete</button>
            </div>
          ` : ''}

          ${this._deletePending ? html`
            <div class="action-row delete-confirm">
              <span>Remove from build?</span>
              <button class="btn btn-danger btn-sm-confirm" @click=${this._confirmDelete}>Confirm</button>
              <button class="btn btn-ghost btn-sm-confirm" @click=${this._cancelDelete}>Cancel</button>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'build-item-row': BuildItemRow }
}
