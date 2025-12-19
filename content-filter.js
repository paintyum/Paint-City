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

