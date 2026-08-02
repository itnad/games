const SUBJECT_PRONOUNS = {
  "나": "내가",
  "너": "네가",
  "저": "제가",
};

const DIGIT_FINAL_CONSONANTS = {
  "0": 21,
  "1": 8,
  "2": 0,
  "3": 16,
  "4": 0,
  "5": 0,
  "6": 1,
  "7": 8,
  "8": 8,
  "9": 0,
};

function finalConsonantIndex(value) {
  const word = String(value ?? "").trim();
  const lastCharacter = Array.from(word).reverse().find((character) => /[가-힣0-9A-Za-z]/.test(character));
  if (!lastCharacter) return 0;

  const code = lastCharacter.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (/\d/.test(lastCharacter)) return DIGIT_FINAL_CONSONANTS[lastCharacter];
  return 0;
}

export function hasKoreanFinalConsonant(value) {
  return finalConsonantIndex(value) !== 0;
}

export function withKoreanSubject(value) {
  const word = String(value ?? "").trim();
  if (SUBJECT_PRONOUNS[word]) return SUBJECT_PRONOUNS[word];
  return `${word}${hasKoreanFinalConsonant(word) ? "이" : "가"}`;
}

export function withKoreanTopic(value) {
  const word = String(value ?? "").trim();
  return `${word}${hasKoreanFinalConsonant(word) ? "은" : "는"}`;
}

export function withKoreanObject(value) {
  const word = String(value ?? "").trim();
  return `${word}${hasKoreanFinalConsonant(word) ? "을" : "를"}`;
}

export function withKoreanAnd(value) {
  const word = String(value ?? "").trim();
  return `${word}${hasKoreanFinalConsonant(word) ? "과" : "와"}`;
}

export function withKoreanDirection(value) {
  const word = String(value ?? "").trim();
  const finalIndex = finalConsonantIndex(word);
  return `${word}${finalIndex === 0 || finalIndex === 8 ? "로" : "으로"}`;
}
