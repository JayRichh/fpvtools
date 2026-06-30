import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import type { BuildItem, ItemCategory, StockStatus } from '@core/builds/types.js'

const CAT_OPTIONS: ItemCategory[] = ['Airframe', 'Ground Station', 'Power', 'Consumables', 'QOL']

function emptyItem(cat: ItemCategory = 'Airframe'): BuildItem {
  return {
    id: '', name: '', cat, price: 0, confirmed: false,
    store: '', url: '', stock: 'check', verified: false, note: '', backups: [],
  }
}

@customElement('build-item-form')
export class BuildItemForm extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host { display: block; }

      .form {
        background: var(--fpv-surface);
        border: 1px solid var(--fpv-primary);
        border-radius: var(--fpv-radius-md);
        padding: var(--fpv-space-md);
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-sm);
      }

      .form-title {
        font-size: var(--fpv-font-label);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--fpv-text-muted);
        margin-bottom: 4px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .field label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--fpv-text-muted);
      }

      .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--fpv-space-sm);
      }

      input[type="text"], input[type="number"], input[type="url"], select, textarea {
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        color: var(--fpv-text);
        padding: 8px 10px;
        font-family: var(--fpv-font-sans);
        font-size: var(--fpv-font-body);
        min-height: 44px;
        width: 100%;
        box-sizing: border-box;
      }
      input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: var(--fpv-primary);
      }

      .stock-seg {
        display: flex;
        gap: 0;
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        overflow: hidden;
      }
      .stock-seg button {
        flex: 1;
        padding: 8px;
        background: transparent;
        color: var(--fpv-text-muted);
        border: none;
        cursor: pointer;
        font-family: var(--fpv-font-sans);
        font-size: 12px;
        min-height: 44px;
        transition: background 0.12s, color 0.12s;
        border-right: 1px solid var(--fpv-border);
      }
      .stock-seg button:last-child { border-right: none; }
      .stock-seg button.active {
        background: var(--fpv-primary);
        color: var(--fpv-surface);
        font-weight: 600;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: var(--fpv-space-sm);
        min-height: 44px;
      }
      .toggle-row label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: none;
        letter-spacing: 0;
        cursor: pointer;
      }
      input[type="checkbox"] {
        width: 18px; height: 18px;
        accent-color: var(--fpv-primary);
        cursor: pointer;
      }

      .backup-row {
        display: grid;
        grid-template-columns: 1fr 2fr auto;
        gap: var(--fpv-space-xs);
        align-items: center;
      }
      .backup-row input { min-height: 36px; }

      .btn-add-backup {
        background: transparent;
        border: 1px dashed var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        color: var(--fpv-text-muted);
        padding: 6px 12px;
        cursor: pointer;
        font-size: 12px;
        min-height: 36px;
        font-family: var(--fpv-font-sans);
        transition: border-color 0.12s, color 0.12s;
      }
      .btn-add-backup:hover { border-color: var(--fpv-primary); color: var(--fpv-primary); }

      .btn-remove {
        background: transparent;
        border: none;
        color: var(--fpv-error);
        cursor: pointer;
        padding: 4px 8px;
        font-size: 16px;
        min-height: 36px;
        border-radius: var(--fpv-radius-sm);
      }
      .btn-remove:hover { background: color-mix(in srgb, var(--fpv-error) 12%, transparent); }

      .form-actions {
        display: flex;
        gap: var(--fpv-space-sm);
        padding-top: var(--fpv-space-xs);
      }

      .btn {
        display: inline-flex;
        align-items: center;
        padding: 0 var(--fpv-space-md);
        border-radius: var(--fpv-radius-sm);
        font-size: var(--fpv-font-body);
        font-family: var(--fpv-font-sans);
        cursor: pointer;
        min-height: 44px;
        border: 1px solid transparent;
      }
      .btn-primary { background: var(--fpv-primary); color: var(--fpv-surface); font-weight: 600; border: none; }
      .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
      .btn-ghost { background: transparent; color: var(--fpv-text-muted); border-color: var(--fpv-border); }
      .btn-ghost:hover { color: var(--fpv-text); }
    `,
  ]

  @property({ type: Object }) initialItem: BuildItem | null = null
  @property({ type: String }) defaultCat: ItemCategory = 'Airframe'

  @state() private _item: BuildItem = emptyItem()

  connectedCallback() {
    super.connectedCallback()
    this._item = this.initialItem ? { ...this.initialItem, backups: [...this.initialItem.backups] } : emptyItem(this.defaultCat)
  }

  private _set<K extends keyof BuildItem>(k: K, v: BuildItem[K]) {
    this._item = { ...this._item, [k]: v }
  }

  private _addBackup() {
    if (this._item.backups.length >= 3) return
    this._item = { ...this._item, backups: [...this._item.backups, { label: '', url: '' }] }
  }

  private _removeBackup(i: number) {
    const b = [...this._item.backups]
    b.splice(i, 1)
    this._item = { ...this._item, backups: b }
  }

  private _setBackup(i: number, k: 'label' | 'url', v: string) {
    const b = [...this._item.backups]
    b[i] = { ...b[i], [k]: v }
    this._item = { ...this._item, backups: b }
  }

  private _save() {
    if (!this._item.name.trim()) return
    const item: BuildItem = {
      ...this._item,
      id: this._item.id || crypto.randomUUID(),
      name: this._item.name.trim(),
      store: this._item.store.trim(),
    }
    this.dispatchEvent(new CustomEvent('item-save', { detail: item, bubbles: true, composed: true }))
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('item-cancel', { bubbles: true, composed: true }))
  }

  render() {
    const item = this._item
    return html`
      <div class="form">
        <div class="form-title">${this.initialItem ? 'Edit Item' : 'Add Item'}</div>

        <div class="field">
          <label>Name *</label>
          <input type="text" .value=${item.name} placeholder="Item name" @input=${(e: Event) => this._set('name', (e.target as HTMLInputElement).value)} />
        </div>

        <div class="field-row">
          <div class="field">
            <label>Category</label>
            <select .value=${item.cat} @change=${(e: Event) => this._set('cat', (e.target as HTMLSelectElement).value as ItemCategory)}>
              ${CAT_OPTIONS.map(c => html`<option value=${c} ?selected=${item.cat === c}>${c}</option>`)}
            </select>
          </div>
          <div class="field">
            <label>Price (NZD)</label>
            <input type="number" .value=${String(item.price)} min="0" step="0.01" @input=${(e: Event) => this._set('price', parseFloat((e.target as HTMLInputElement).value) || 0)} />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Store</label>
            <input type="text" .value=${item.store} placeholder="Store name" @input=${(e: Event) => this._set('store', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>Buy URL</label>
            <input type="url" .value=${item.url} placeholder="https://…" @input=${(e: Event) => this._set('url', (e.target as HTMLInputElement).value)} />
          </div>
        </div>

        <div class="field">
          <label>Stock</label>
          <div class="stock-seg">
            ${(['in', 'check', 'out'] as StockStatus[]).map(s => html`
              <button class=${item.stock === s ? 'active' : ''} @click=${() => this._set('stock', s)}>
                ${s === 'in' ? 'In Stock' : s === 'check' ? 'Check' : 'Out of Stock'}
              </button>
            `)}
          </div>
        </div>

        <div class="toggle-row">
          <input type="checkbox" id="confirmed" .checked=${item.confirmed} @change=${(e: Event) => this._set('confirmed', (e.target as HTMLInputElement).checked)} />
          <label for="confirmed">Price confirmed on live product page</label>
        </div>

        <div class="toggle-row">
          <input type="checkbox" id="verified" .checked=${item.verified} @change=${(e: Event) => this._set('verified', (e.target as HTMLInputElement).checked)} />
          <label for="verified">Link verified this session</label>
        </div>

        <div class="field">
          <label>Note</label>
          <textarea .value=${item.note} rows="2" @input=${(e: Event) => this._set('note', (e.target as HTMLTextAreaElement).value)}></textarea>
        </div>

        <div class="field">
          <label>Backup links (max 3)</label>
          ${item.backups.map((b, i) => html`
            <div class="backup-row">
              <input type="text" .value=${b.label} placeholder="Label" @input=${(e: Event) => this._setBackup(i, 'label', (e.target as HTMLInputElement).value)} />
              <input type="url" .value=${b.url} placeholder="https://…" @input=${(e: Event) => this._setBackup(i, 'url', (e.target as HTMLInputElement).value)} />
              <button class="btn-remove" @click=${() => this._removeBackup(i)} aria-label="Remove backup">×</button>
            </div>
          `)}
          ${item.backups.length < 3 ? html`
            <button class="btn-add-backup" @click=${this._addBackup}>+ Add backup link</button>
          ` : ''}
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" ?disabled=${!item.name.trim()} @click=${this._save}>
            ${this.initialItem ? 'Save' : 'Add Item'}
          </button>
          <button class="btn btn-ghost" @click=${this._cancel}>Cancel</button>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'build-item-form': BuildItemForm }
}
