/**
 * Simple Readability Calculator (Flesch-Kincaid)
 */

export function calculateReadabilityScore(text: string | null | undefined): number {
  if (!text || text.trim().length === 0) return 0;
  
  const cleanText = text.replace(/<[^>]*>?/gm, " ").trim();
  if (cleanText.length === 0) return 0;

  const sentences = cleanText.split(/[.!?]+/).filter(Boolean).length || 1;
  const words = cleanText.split(/\s+/).filter(Boolean).length || 1;
  
  // Very rough syllable estimation: vowels usually equal syllables, 
  // subtract one for silent 'e' at end of words.
  let syllables = 0;
  const wordsArray = cleanText.split(/\s+/).filter(Boolean);
  for (const word of wordsArray) {
    const w = word.toLowerCase();
    const match = w.match(/[aeiouy]{1,2}/g);
    let sCount = match ? match.length : 1;
    if (w.endsWith("e") && sCount > 1) {
      sCount--;
    }
    syllables += Math.max(1, sCount);
  }

  // Flesch Reading Ease
  // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
