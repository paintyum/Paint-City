// Content filter for slurs and offensive language
// Base slur words (without obfuscation)
const BASE_SLUR_WORDS = [
  'nigger', 'nigga',
  'faggot', 'fag',
  'kike',
  'chink',
  'spic',
  'wetback',
  'towelhead',
  'sandnigger',
  'gook',
  'jap',
  'paki',
  'retard',
  'tranny',
  'dyke',
  'cunt',
  'bitch',
  'whore',
  'slut'
];

// Create patterns that match obfuscated versions
function createSlurPattern(baseWord) {
  // Replace letters with character class that matches letters and common obfuscation
  const pattern = baseWord.split('').map(char => {
    if (char === 'a' || char === 'A') return '[aA4@]';
    if (char === 'e' || char === 'E') return '[eE3]';
    if (char === 'i' || char === 'I') return '[iI1!]';
    if (char === 'o' || char === 'O') return '[oO0]';
    if (char === 's' || char === 'S') return '[sS5$]';
    if (char === 't' || char === 'T') return '[tT7]';
    if (char === 'g' || char === 'G') return '[gG9]';
    return char;
  }).join('');
  return pattern;
}

// Check if text contains any slurs
export function containsSlur(text) {
  const lowerText = text.toLowerCase();
  
  for (const baseSlur of BASE_SLUR_WORDS) {
    // Check for base word
    const baseRegex = new RegExp(`\\b${baseSlur}\\b`, 'i');
    if (baseRegex.test(text)) {
      return true;
    }
    
    // Check for obfuscated versions
    const obfuscatedPattern = createSlurPattern(baseSlur);
    const obfuscatedRegex = new RegExp(`\\b${obfuscatedPattern}\\b`, 'i');
    if (obfuscatedRegex.test(text)) {
      return true;
    }
    
    // Also check normalized version (remove special chars)
    const normalized = lowerText.replace(/[^a-z]/g, '');
    const normalizedSlur = baseSlur.toLowerCase();
    if (normalized.includes(normalizedSlur)) {
      return true;
    }
  }
  
  return false;
}

// Censor slurs in text by replacing with asterisks
export function censorSlurs(text) {
  let censored = text;
  
  for (const baseSlur of BASE_SLUR_WORDS) {
    // Censor base word
    const baseRegex = new RegExp(`\\b${baseSlur}\\b`, 'gi');
    censored = censored.replace(baseRegex, (match) => {
      return '*'.repeat(match.length);
    });
    
    // Censor obfuscated versions
    const obfuscatedPattern = createSlurPattern(baseSlur);
    const obfuscatedRegex = new RegExp(`\\b${obfuscatedPattern}\\b`, 'gi');
    censored = censored.replace(obfuscatedRegex, (match) => {
      return '*'.repeat(match.length);
    });
  }
  
  return censored;
}

// Check if text contains URLs/links - comprehensive detection
export function containsLink(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Normalize text for better detection (remove common obfuscation)
  const normalized = text.toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\[\](){}]/g, ''); // Remove brackets that might hide URLs
  
  // Comprehensive URL patterns - catch various formats and obfuscations
  const urlPatterns = [
    /https?:\/\/[^\s]+/gi,                    // http:// or https://
    /www\.[^\s]+/gi,                          // www.example.com
    /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/gi,    // domain.com or domain.com/path
    /[a-zA-Z0-9-]+\.(com|net|org|io|co|uk|us|ca|au|de|fr|jp|cn|ru|br|in|it|es|nl|pl|se|no|dk|fi|be|at|ch|cz|ie|pt|gr|tr|kr|mx|ar|za|nz|sg|my|th|ph|id|vn|tw|hk)[^\s]*/gi, // Common TLDs
    /bit\.ly\/[^\s]+/gi,                      // bit.ly short links
    /tinyurl\.com\/[^\s]+/gi,                 // tinyurl.com short links
    /t\.co\/[^\s]+/gi,                        // Twitter short links
    /goo\.gl\/[^\s]+/gi,                      // Google short links
    /youtu\.be\/[^\s]+/gi,                    // YouTube short links
    /youtube\.com\/[^\s]+/gi,                 // YouTube links
    /discord\.gg\/[^\s]+/gi,                  // Discord invites
    /discord\.com\/[^\s]+/gi,                  // Discord links
    /steamcommunity\.com\/[^\s]+/gi,          // Steam links
    /reddit\.com\/[^\s]+/gi,                  // Reddit links
    /github\.com\/[^\s]+/gi,                   // GitHub links
    /[a-zA-Z0-9-]+\[\.\][a-zA-Z]{2,}/gi,      // domain[.]com obfuscation
    /[a-zA-Z0-9-]+\(\.\)[a-zA-Z]{2,}/gi,      // domain(.)com obfuscation
    /[a-zA-Z0-9-]+\s*\.\s*[a-zA-Z]{2,}/gi,    // domain . com (spaces)
    /[a-zA-Z0-9-]+dot[a-zA-Z]{2,}/gi,          // domaindotcom
    /[a-zA-Z0-9-]+\[dot\][a-zA-Z]{2,}/gi,      // domain[dot]com
  ];
  
  for (const pattern of urlPatterns) {
    if (pattern.test(text) || pattern.test(normalized)) {
      return true;
    }
  }
  
  // Check for IP addresses (potential URLs)
  const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi;
  if (ipPattern.test(text)) {
    return true;
  }
  
  // Check for common URL schemes
  const schemePattern = /(ftp|file|mailto|tel|sms|data):/gi;
  if (schemePattern.test(text)) {
    return true;
  }
  
  return false;
}

