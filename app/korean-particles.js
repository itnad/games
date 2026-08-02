const SUBJECT_PRONOUNS = {
  "나": "내가",
  "너": "네가",
  "저": "제가",
};

const DIGITS_WITH_FINAL_CONSONANT = new Set(["0", "1", "3", "6", "7", "8"]);

export function hasKoreanFinalConsonant(value) {
  const word = String(value ?? "").trim();
  const lastCharacter = Array.from(word).at(-1);
  if (!lastCharacter) return false;

  const code = lastCharacter.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/\d/.test(lastCharacter)) return DIGITS_WITH_FINAL_CONSONANT.has(lastCharacter);
  return false;
}

export function withKoreanSubject(value) {
  const word = String(value ?? "").trim();
  if (SUBJECT_PRONOUNS[word]) return SUBJECT_PRONOUNS[word];
  return `${word}${hasKoreanFinalConsonant(word) ? "이" : "가"}`;
}
