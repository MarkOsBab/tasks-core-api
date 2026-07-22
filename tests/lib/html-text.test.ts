import { describe, expect, it } from 'vitest';
import { htmlToText } from '@/lib/html-text';

describe('htmlToText', () => {
  it('returns null for empty input', () => {
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText(undefined)).toBeNull();
    expect(htmlToText('')).toBeNull();
  });

  it('converts paragraphs and line breaks to newlines', () => {
    expect(htmlToText('<p>one</p><p>two<br>three</p>')).toBe('one\ntwo\nthree');
  });

  it('converts lists to markdown-ish dashes', () => {
    expect(htmlToText('<ul><li>first</li><li>second</li></ul>')).toBe('- first\n- second');
  });

  it('converts emphasis to markdown markers', () => {
    expect(htmlToText('<strong>bold</strong> and <em>italic</em>')).toBe('**bold** and _italic_');
  });

  it('decodes common HTML entities', () => {
    expect(htmlToText('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#039; &nbsp;f')).toBe(
      'a & b <c> "d" \'e\'  f',
    );
  });

  it('collapses excessive blank lines', () => {
    expect(htmlToText('<p>one</p><p></p><p></p><p>two</p>')).toBe('one\n\ntwo');
  });

  it('returns null when nothing is left after stripping tags', () => {
    expect(htmlToText('<p>  </p><div></div>')).toBeNull();
  });
});
