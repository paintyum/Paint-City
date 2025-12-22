// XSS Protection Utilities
// Functions to safely escape HTML and create DOM elements

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for HTML
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape HTML for use in HTML attributes (like onclick)
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for HTML attributes
 */
export function escapeHtmlAttr(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape text for use in JavaScript strings (for onclick handlers)
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for JavaScript strings
 */
export function escapeJs(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

