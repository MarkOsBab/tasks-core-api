// Task descriptions are stored as rich-text HTML; MCP clients (LLM agents) read markdown-ish
// plain text better and it costs fewer tokens. Best-effort conversion, not a full HTML parser.
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<(strong|b)(\s[^>]*)?>/gi, '**')
    .replace(/<\/(strong|b)>/gi, '**')
    .replace(/<(em|i)(\s[^>]*)?>/gi, '_')
    .replace(/<\/(em|i)>/gi, '_')
    .replace(/<[^>]+>/g, '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'");
  const cleaned = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned === '' ? null : cleaned;
}
