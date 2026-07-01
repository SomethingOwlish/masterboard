// Document parser (B-import). Ingests a generated document — Markdown, HTML, or
// SVG — and reduces it to a flat list of candidate blocks (title + body + optional
// image). The import wizard then lets the GM route each block to a module. This is
// the unstructured/semi-structured counterpart to the JSON import mapper (B8):
// where that maps homogeneous records to one kind, this splits one prose document
// into heterogeneous pieces the GM confirms. Dependency-free, browser-only
// (DOMParser handles HTML/SVG); mirrors the project's static, dependency-light ethos.

export type DocFormat = 'markdown' | 'html' | 'svg'

/** One extracted section of a source document, before it's routed to a module. */
export interface ParsedBlock {
  title: string
  body: string
  image?: string
  level: number // heading depth (1 = top); 1 for flat/paragraph blocks
}

/** Guess the format from an explicit filename first, then the content itself. */
export function detectFormat(text: string, filename?: string): DocFormat {
  const ext = filename?.toLowerCase().match(/\.(\w+)$/)?.[1]
  if (ext === 'svg') return 'svg'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'md' || ext === 'markdown' || ext === 'txt') return 'markdown'
  const head = text.trimStart().slice(0, 400).toLowerCase()
  if (head.startsWith('<svg') || head.includes('<svg')) return 'svg'
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || /<(body|div|h[1-6]|p|table)[\s>]/.test(head))
    return 'html'
  return 'markdown'
}

export function parseDocument(text: string, format: DocFormat): ParsedBlock[] {
  const blocks = format === 'svg' ? parseSvg(text) : format === 'html' ? parseHtml(text) : parseMarkdown(text)
  // Drop blocks that carry neither a title nor any body — pure separators / noise.
  return blocks.filter((b) => b.title.trim() || b.body.trim()).map((b) => ({ ...b, title: b.title.trim(), body: b.body.trim() }))
}

// --- Markdown -------------------------------------------------------------------

/** Strip inline Markdown so a block's body/title reads as plain text. */
function stripMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images (captured separately)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/[*_`~]+/g, '') // emphasis / code marks
    .replace(/^\s*>\s?/gm, '') // blockquote markers
    .replace(/^\s*[-*+]\s+/gm, '') // bullets
    .replace(/^\s*\d+\.\s+/gm, '') // ordered markers
    .trim()
}

function firstImage(s: string): string | undefined {
  const md = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/.exec(s)
  if (md) return md[1]
  const html = /<img[^>]*\bsrc=["']([^"']+)["']/i.exec(s)
  return html?.[1]
}

function parseMarkdown(md: string): ParsedBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const hasHeadings = lines.some((l) => /^#{1,6}\s+\S/.test(l))

  if (!hasHeadings) {
    // No structure to hang blocks on: split on blank lines, first line is the title.
    return md
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean)
      .map((para) => {
        const [head, ...rest] = para.split('\n')
        return { title: stripMd(head), body: stripMd(rest.join('\n')), image: firstImage(para), level: 1 }
      })
  }

  const blocks: ParsedBlock[] = []
  let cur: { level: number; title: string; buf: string[] } | null = null
  const flush = () => {
    if (!cur) return
    const raw = cur.buf.join('\n')
    blocks.push({ title: stripMd(cur.title), body: stripMd(raw), image: firstImage(raw), level: cur.level })
    cur = null
  }
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.*\S)\s*$/.exec(line)
    if (h) {
      flush()
      cur = { level: h[1].length, title: h[2], buf: [] }
    } else if (cur) {
      cur.buf.push(line)
    }
  }
  flush()
  return blocks
}

// --- HTML -----------------------------------------------------------------------

const HEADING_RE = /^H([1-6])$/

function parseHtml(html: string): ParsedBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.body ?? doc.documentElement
  const blocks: ParsedBlock[] = []
  let cur: ParsedBlock | null = null

  const start = (title: string, level: number) => {
    cur = { title, body: '', image: undefined, level }
    blocks.push(cur)
  }
  const appendText = (t: string) => {
    const text = t.replace(/\s+/g, ' ').trim()
    if (!text) return
    if (!cur) start(text.slice(0, 80), 1) // pre-heading prose becomes its own block
    else cur.body = cur.body ? `${cur.body}\n${text}` : text
  }

  // Collapse an element's own text, ignoring any nested <summary> (that title
  // belongs to a child block, not this one).
  const ownText = (el: Element): string => {
    const clone = el.cloneNode(true) as Element
    clone.querySelectorAll('summary').forEach((s) => s.remove())
    return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
  }

  const walk = (node: Element, depth: number) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toUpperCase()
      const hm = HEADING_RE.exec(tag)
      // Headings and <summary> both open a new block. Generated docs often use
      // <details>/<summary> disclosure sections in place of heading tags, so a
      // <summary> is the section title and its <details> siblings are the body.
      if (hm) {
        start((child.textContent ?? '').replace(/\s+/g, ' ').trim(), Number(hm[1]))
        continue
      }
      if (tag === 'SUMMARY') {
        start((child.textContent ?? '').replace(/\s+/g, ' ').trim(), depth)
        continue
      }
      if (tag === 'IMG') {
        const src = child.getAttribute('src')
        if (src && cur && !cur.image) cur.image = src
        continue
      }
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NAV' || tag === 'BUTTON') continue
      // Recurse into containers that hold sub-sections so nested <summary>/heading
      // boundaries are found; otherwise contribute the element's own text (minus
      // any nested summary titles) so we never double-count an ancestor's text.
      if (child.querySelector('summary, h1, h2, h3, h4, h5, h6')) {
        const img = child.querySelector('img')
        if (img && cur && !cur.image) cur.image = img.getAttribute('src') ?? cur.image
        walk(child, tag === 'DETAILS' ? depth + 1 : depth)
      } else {
        appendText(ownText(child))
        const img = child.querySelector('img')
        if (img && cur && !cur.image) cur.image = img.getAttribute('src') ?? cur.image
      }
    }
  }
  walk(root, 1)
  return blocks
}

// --- SVG ------------------------------------------------------------------------

interface SvgLine {
  text: string
  size: number
}

function parseSvg(svg: string): ParsedBlock[] {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return []
  const lines: SvgLine[] = []
  for (const el of Array.from(doc.querySelectorAll('text'))) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    lines.push({ text, size: fontSize(el) })
  }
  if (lines.length === 0) return []

  // Headings by font size when the document uses more than one; the largest tier
  // reads as a title. When type is uniform, fall back to a short-line heuristic.
  const sizes = [...new Set(lines.map((l) => l.size))]
  const max = Math.max(...sizes)
  const varied = sizes.length > 1 && max > 0
  const isHeading = (l: SvgLine, next?: SvgLine): boolean =>
    varied ? l.size >= max * 0.9 : l.text.length <= 60 && !!next && next.text.length > l.text.length

  const blocks: ParsedBlock[] = []
  let cur: ParsedBlock | null = null
  lines.forEach((l, i) => {
    if (isHeading(l, lines[i + 1]) || !cur) {
      cur = { title: l.text, body: '', image: undefined, level: 1 }
      blocks.push(cur)
    } else {
      cur.body = cur.body ? `${cur.body}\n${l.text}` : l.text
    }
  })
  return blocks
}

function fontSize(el: Element): number {
  const attr = el.getAttribute('font-size')
  const style = el.getAttribute('style') ?? ''
  const fromStyle = /font-size\s*:\s*([\d.]+)/i.exec(style)?.[1]
  const n = parseFloat(fromStyle ?? attr ?? '')
  return Number.isFinite(n) ? n : 0
}
