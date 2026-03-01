/**
 * Simple HTML minifier — no external dependencies.
 * Removes unnecessary whitespace and comments (preserves conditional comments).
 */

export function minifyHtml(html: string): string {
  let result = html;

  // Preserve <pre>, <script>, <style>, <textarea> content
  const preserved: string[] = [];
  const preserveRe =
    /(<(?:pre|script|style|textarea)[^>]*>)([\s\S]*?)(<\/(?:pre|script|style|textarea)>)/gi;

  result = result.replace(preserveRe, (match, open, content, close) => {
    const idx = preserved.length;
    preserved.push(match);
    return `__PRESERVE_${idx}__`;
  });

  // Remove HTML comments (but keep conditional comments like <!--[if IE]>)
  result = result.replace(/<!--(?!\[if\s)[\s\S]*?-->/g, "");

  // Collapse whitespace between tags
  result = result.replace(/>\s+</g, "> <");

  // Collapse multiple spaces/newlines into single space
  result = result.replace(/\s{2,}/g, " ");

  // Remove whitespace around block-level tags
  result = result.replace(
    /\s*(<\/?(?:html|head|body|div|section|article|header|footer|nav|main|aside|ul|ol|li|p|h[1-6]|table|tr|td|th|thead|tbody|form|fieldset|blockquote|figure|figcaption|details|summary|br|hr)[^>]*>)\s*/gi,
    "$1"
  );

  // Trim leading/trailing whitespace on each line then rejoin
  result = result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("");

  // Restore preserved blocks
  for (let i = 0; i < preserved.length; i++) {
    result = result.replace(`__PRESERVE_${i}__`, preserved[i]);
  }

  return result;
}
