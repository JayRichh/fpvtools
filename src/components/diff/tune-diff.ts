import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tokenStyles } from '../primitives/tokens.css.js'
import { I18nController } from '../primitives/I18nController.js'
import '../primitives/index.js'

type ParsedDiff = Record<string, Record<string, string>>

type Category = 'PID' | 'Filters' | 'Rates' | 'Features'

function parseDiff(text: string): ParsedDiff {
  const result: ParsedDiff = {}
  let section = 'header'
  if (!result[section]) result[section] = {}

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const sectionMatch = line.match(/^(profile|rateprofile)\s+(\d+)$/)
    if (sectionMatch) {
      section = `${sectionMatch[1]} ${sectionMatch[2]}`
      if (!result[section]) result[section] = {}
      continue
    }

    const setMatch = line.match(/^set\s+(\w+)\s*=\s*(.+)$/)
    if (setMatch) {
      if (!result[section]) result[section] = {}
      result[section][setMatch[1]] = setMatch[2].trim()
    }
  }

  return result
}

function flattenParsed(parsed: ParsedDiff): Record<string, string> {
  const flat: Record<string, string> = {}
  for (const section of Object.values(parsed)) {
    for (const [k, v] of Object.entries(section)) {
      flat[k] = v
    }
  }
  return flat
}

function categorize(key: string): Category {
  if (/^[pidf]_(pitch|roll|yaw)$/.test(key)) return 'PID'
  if (/lpf|filter/.test(key)) return 'Filters'
  if (/^(roll|pitch|yaw)_(rc_rate|expo|super_factor)|^rates_type$/.test(key)) return 'Rates'
  return 'Features'
}

const CATEGORY_ORDER: Category[] = ['PID', 'Filters', 'Rates', 'Features']

interface DiffEntry {
  key: string
  a: string | undefined
  b: string | undefined
  changed: boolean
}

@customElement('tune-diff')
export class TuneDiff extends LitElement {
  static styles = [
    tokenStyles,
    css`
      :host {
        display: block;
      }
      .textareas {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--fpv-space-md);
        margin-bottom: var(--fpv-space-md);
      }
      .ta-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-xs);
      }
      .ta-label {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      textarea {
        width: 100%;
        height: 180px;
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-sm);
        color: var(--fpv-text);
        font-family: var(--fpv-font-mono);
        font-size: 12px;
        padding: var(--fpv-space-sm);
        outline: none;
        resize: vertical;
        transition: border-color 0.15s;
        box-sizing: border-box;
      }
      textarea:focus {
        border-color: var(--fpv-primary);
      }
      textarea::placeholder {
        color: var(--fpv-text-muted);
        opacity: 0.5;
      }
      .results {
        display: flex;
        flex-direction: column;
        gap: var(--fpv-space-md);
      }
      .empty-state {
        padding: var(--fpv-space-lg);
        text-align: center;
        color: var(--fpv-text-muted);
        font-size: var(--fpv-font-label);
        background: var(--fpv-surface-2);
        border: 1px solid var(--fpv-border);
        border-radius: var(--fpv-radius-md);
      }
      .cat-header {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: var(--fpv-space-xs);
        padding-bottom: var(--fpv-space-xs);
        border-bottom: 1px solid var(--fpv-border);
      }
      .diff-table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--fpv-font-mono);
        font-size: 12px;
      }
      .diff-table th {
        text-align: left;
        color: var(--fpv-text-muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 4px var(--fpv-space-sm);
        border-bottom: 1px solid var(--fpv-border);
        font-weight: normal;
      }
      .diff-table td {
        padding: 4px var(--fpv-space-sm);
        vertical-align: middle;
        border-bottom: 1px solid var(--fpv-border);
        color: var(--fpv-text);
      }
      .diff-table td.key-col {
        color: var(--fpv-text-muted);
        width: 40%;
      }
      .diff-table td.val-a {
        width: 28%;
      }
      .diff-table td.val-b {
        width: 28%;
      }
      .changed {
        background: var(--fpv-accent);
        color: #fff;
        border-radius: var(--fpv-radius-sm);
        padding: 2px 6px;
        display: inline-block;
      }
      .missing {
        color: var(--fpv-text-muted);
        opacity: 0.4;
        font-style: italic;
      }
      .summary {
        font-size: var(--fpv-font-label);
        color: var(--fpv-text-muted);
        padding: var(--fpv-space-xs) 0 var(--fpv-space-sm);
      }
      .summary strong {
        color: var(--fpv-primary);
      }
    `,
  ]

  private _i18n = new I18nController(this)

  @state() private _textA = ''
  @state() private _textB = ''

  private _getDiffEntries(flatA: Record<string, string>, flatB: Record<string, string>, bothSides: boolean): DiffEntry[] {
    const allKeys = new Set([...Object.keys(flatA), ...Object.keys(flatB)])
    const entries: DiffEntry[] = []
    for (const key of allKeys) {
      const a = flatA[key]
      const b = flatB[key]
      const changed = a !== b
      if (bothSides && !changed) continue
      entries.push({ key, a, b, changed })
    }
    return entries
  }

  private _renderDiffGroups(entries: DiffEntry[], bothSides: boolean) {
    const grouped: Record<Category, DiffEntry[]> = {
      PID: [],
      Filters: [],
      Rates: [],
      Features: [],
    }

    for (const entry of entries) {
      grouped[categorize(entry.key)].push(entry)
    }

    const changedCount = entries.filter((e) => e.changed).length

    return html`
      <div class="summary">
        ${bothSides
          ? html`Showing <strong>${changedCount}</strong> changed setting${changedCount !== 1 ? 's' : ''} out of ${entries.length + (entries.length - changedCount)} total`
          : html`Showing <strong>${entries.length}</strong> parsed settings`}
      </div>
      ${CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat]
        if (!items.length) return ''
        return html`
          <fpv-card>
            <div class="cat-header">${cat}</div>
            <table class="diff-table">
              <thead>
                <tr>
                  <th>${this._i18n.t('diff.table_setting')}</th>
                  <th>${bothSides ? this._i18n.t('diff.label_config_a') : this._i18n.t('diff.table_value')}</th>
                  ${bothSides ? html`<th>${this._i18n.t('diff.label_config_b')}</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${items.map(({ key, a, b, changed }) => html`
                  <tr>
                    <td class="key-col">${key}</td>
                    <td class="val-a">
                      ${a !== undefined
                        ? html`<span class=${changed ? 'changed' : ''}>${a}</span>`
                        : html`<span class="missing">—</span>`}
                    </td>
                    ${bothSides
                      ? html`<td class="val-b">
                          ${b !== undefined
                            ? html`<span class=${changed ? 'changed' : ''}>${b}</span>`
                            : html`<span class="missing">—</span>`}
                        </td>`
                      : ''}
                  </tr>
                `)}
              </tbody>
            </table>
          </fpv-card>
        `
      })}
    `
  }

  private _renderResults() {
    const hasA = this._textA.trim().length > 0
    const hasB = this._textB.trim().length > 0

    if (!hasA && !hasB) {
      return html`
        <div class="empty-state">
          ${this._i18n.t('diff.empty_initial')}
        </div>
      `
    }

    const parsedA = hasA ? flattenParsed(parseDiff(this._textA)) : {}
    const parsedB = hasB ? flattenParsed(parseDiff(this._textB)) : {}
    const bothSides = hasA && hasB
    const entries = this._getDiffEntries(parsedA, parsedB, bothSides)

    if (!entries.length) {
      return html`
        <div class="empty-state">
          ${bothSides ? this._i18n.t('diff.empty_identical') : this._i18n.t('diff.empty_invalid')}
        </div>
      `
    }

    return this._renderDiffGroups(entries, bothSides)
  }

  render() {
    return html`
      <div class="textareas">
        <div class="ta-wrap">
          <span class="ta-label">${this._i18n.t('diff.label_config_a')}</span>
          <textarea
            placeholder=${this._i18n.t('diff.placeholder_a')}
            .value=${this._textA}
            @input=${(e: InputEvent) => {
              this._textA = (e.target as HTMLTextAreaElement).value
            }}
          ></textarea>
        </div>
        <div class="ta-wrap">
          <span class="ta-label">${this._i18n.t('diff.label_config_b')}</span>
          <textarea
            placeholder=${this._i18n.t('diff.placeholder_b')}
            .value=${this._textB}
            @input=${(e: InputEvent) => {
              this._textB = (e.target as HTMLTextAreaElement).value
            }}
          ></textarea>
        </div>
      </div>
      <div class="results">${this._renderResults()}</div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tune-diff': TuneDiff
  }
}
