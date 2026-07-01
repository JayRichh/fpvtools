// GoatCounter analytics — SPA pageview tracking.
//
// count.js is loaded with { no_onload: true } (see index.html), so the first
// load and every client-side navigation are recorded here with an explicit,
// clean route path. Passing `path` bypasses count.js's own URL resolution,
// which would otherwise fold every hash-history route onto the canonical "/".

interface GoatCounter {
  count(vars: { path: string }): void
  no_onload?: boolean
}

declare global {
  interface Window {
    goatcounter?: Partial<GoatCounter>
  }
}

const queue: string[] = []
let poll: number | undefined

function flush(): void {
  const gc = window.goatcounter
  if (typeof gc?.count !== 'function') return
  while (queue.length) gc.count({ path: queue.shift()! })
  if (poll !== undefined) {
    window.clearInterval(poll)
    poll = undefined
  }
}

/** Record a pageview for a route path such as "/pid" or "/build/:slug/store". */
export function trackPageview(path: string): void {
  queue.push(path)
  flush()
  // count.js loads async; if it wasn't ready yet, poll until it is (~10s cap).
  if (queue.length > 0 && poll === undefined) {
    let attempts = 0
    poll = window.setInterval(() => {
      flush()
      if (++attempts > 33 && poll !== undefined) {
        window.clearInterval(poll)
        poll = undefined
      }
    }, 300)
  }
}
