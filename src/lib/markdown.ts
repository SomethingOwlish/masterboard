// Minimal, dependency-free Markdown → HTML renderer for the Rules workspace (B9).
// The project ethos is dependency-light/static, so rather than pull in a full
// editor stack we support just the subset a GM needs for house rules: headings,
// bold/italic/inline code, links, ordered/unordered lists, blockquotes, fenced
// code, horizontal rules, and paragraphs. Input is HTML-escaped before any
// transform, so rules text can never inject markup or scripts into the preview.

export interface Heading {
  level: number
  text: string
  slug: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-') || 'section'
  )
}

/** Headings in document order, with collision-free slugs (used for the sidebar). */
export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = []
  const seen = new Map<string, number>()
  for (const line of md.split('\n')) {
    const m = /^(#{1,6})\s+(.*\S)\s*$/.exec(line)
    if (!m) continue
    const text = m[2].trim()
    let slug = slugify(text)
    const n = seen.get(slug) ?? 0
    seen.set(slug, n + 1)
    if (n) slug = `${slug}-${n}`
    out.push({ level: m[1].length, text, slug })
  }
  return out
}

/**
 * Slugs of headings whose section (the heading plus its body up to the next
 * heading) contains `term`, case-insensitive. Powers the Rules search: it jumps
 * the GM to the section a term lives in, not just headings that name it.
 */
export function searchSections(md: string, term: string): Set<string> {
  const needle = term.trim().toLowerCase()
  const hits = new Set<string>()
  if (!needle) return hits
  const headings = extractHeadings(md)
  if (!headings.length) return hits

  const lines = md.split('\n')
  let idx = -1 // index into headings; -1 = preamble before the first heading
  const buf: string[][] = headings.map(() => [])
  for (const line of lines) {
    if (/^#{1,6}\s+\S/.test(line)) {
      idx++
      buf[idx]?.push(line)
    } else if (idx >= 0) {
      buf[idx]?.push(line)
    }
  }
  headings.forEach((h, i) => {
    if (buf[i].join('\n').toLowerCase().includes(needle)) hits.add(h.slug)
  })
  return hits
}

// Inline spans, applied to already-escaped text. Code spans are pulled out first
// so their contents aren't re-processed, then restored at the end. Input is raw
// text; it is HTML-escaped first so markup/scripts in rules can never inject.
function inline(raw: string): string {
  let s = escapeHtml(raw)
  const codes: string[] = []
  s = s.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(c)
    return `@@CODE${codes.length - 1}@@`
  })
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t: string, href: string) => {
    const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#'
    return `<a href="${safe}" target="_blank" rel="noreferrer noopener">${t}</a>`
  })
  return s.replace(/@@CODE(\d+)@@/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`)
}

export function renderMarkdown(md: string): string {
  // Block structure is detected on RAW lines (so `>`, `#`, etc. aren't escaped out
  // from under the matchers); escaping happens per-content in inline()/code fences.
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const headings = extractHeadings(md)
  const out: string[] = []
  let para: string[] = []
  let hIndex = 0
  let i = 0

  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (/^```/.test(line)) {
      flush()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++ // closing fence
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    const h = /^(#{1,6})\s+(.*\S)\s*$/.exec(line)
    if (h) {
      flush()
      const level = h[1].length
      const slug = headings[hIndex]?.slug ?? slugify(h[2])
      hIndex++
      out.push(`<h${level} id="${slug}">${inline(h[2].trim())}</h${level}>`)
      i++
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush()
      out.push('<hr/>')
      i++
      continue
    }

    if (/^>\s?/.test(line)) {
      flush()
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`)
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flush()
      const buf: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ''))
      out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flush()
      const buf: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''))
      out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`)
      continue
    }

    if (/^\s*$/.test(line)) {
      flush()
      i++
      continue
    }

    para.push(line.trim())
    i++
  }
  flush()
  return out.join('\n')
}
