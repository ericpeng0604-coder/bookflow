import type { BookOcrDraft } from "@/lib/marketplace/free-ocr";
import type { Book } from "@/lib/types";

const IMAGE_SEARCH_QUERY_LIMIT = 180;
const IMAGE_SEARCH_CANDIDATE_LIMIT = 8;
const IMAGE_SEARCH_TOKEN_LIMIT = 10;

export type ImageSearchScoreTokens = {
  title: string[];
  author: string[];
  edition: string[];
  publisher: string[];
};

export type ImageSearchPlan = {
  displayQuery: string;
  candidateQueries: string[];
  scoreTokens: ImageSearchScoreTokens;
};

export type ImageSearchResult = {
  book: Book;
  score: number;
  matchedFields: string[];
};

function cleanQueryPart(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: unknown) {
  return cleanQueryPart(value)
    .toLowerCase()
    .replace(/[()[\]{}"'`~!@#$%^&*_+=|\\:;,.?，。；：、！？／/<>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueParts(parts: string[], limit = IMAGE_SEARCH_TOKEN_LIMIT) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const cleaned = cleanQueryPart(part);
    const key = normalizeForMatch(cleaned);
    if (!cleaned || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= limit) break;
  }
  return result;
}

function tokenize(value: unknown) {
  const normalized = normalizeForMatch(value);
  if (!normalized) return [];
  return uniqueParts(
    normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 || /^\d+$/.test(token)),
  );
}

function addCandidate(candidates: string[], parts: string[]) {
  const query = uniqueParts(parts, 5).join(" ").slice(0, IMAGE_SEARCH_QUERY_LIMIT).trim();
  if (!query) return;
  if (!candidates.some((item) => normalizeForMatch(item) === normalizeForMatch(query))) {
    candidates.push(query);
  }
}

export function buildImageSearchPlan(draft: BookOcrDraft): ImageSearchPlan {
  const title = cleanQueryPart(draft.title);
  const author = cleanQueryPart(draft.author);
  const edition = cleanQueryPart(draft.edition);
  const publisher = cleanQueryPart(draft.publisher);
  const displayQuery = uniqueParts([title, author, edition]).join(" ").slice(0, IMAGE_SEARCH_QUERY_LIMIT).trim();
  const titleTokens = tokenize(title);
  const authorTokens = tokenize(author);
  const editionTokens = tokenize(edition);
  const publisherTokens = tokenize(publisher);
  const candidateQueries: string[] = [];

  addCandidate(candidateQueries, [title, edition]);
  addCandidate(candidateQueries, [title, author]);
  addCandidate(candidateQueries, [title]);
  addCandidate(candidateQueries, [titleTokens.slice(0, 4).join(" ")]);
  if (!title && authorTokens.length > 1) addCandidate(candidateQueries, [author]);

  return {
    displayQuery,
    candidateQueries: candidateQueries.slice(0, IMAGE_SEARCH_CANDIDATE_LIMIT),
    scoreTokens: {
      title: uniqueParts([title, ...titleTokens]),
      author: uniqueParts([author, ...authorTokens]),
      edition: uniqueParts([edition, ...editionTokens]),
      publisher: uniqueParts([publisher, ...publisherTokens]),
    },
  };
}

function fieldContains(fieldValue: string, token: string) {
  const field = normalizeForMatch(fieldValue);
  const normalizedToken = normalizeForMatch(token);
  return Boolean(field && normalizedToken && field.includes(normalizedToken));
}

function addScore(
  matchedFields: Set<string>,
  book: Book,
  field: keyof Book,
  tokens: string[],
  points: number,
) {
  const value = String(book[field] ?? "");
  const matches = tokens.filter((token) => fieldContains(value, token));
  if (matches.length === 0) return 0;
  matchedFields.add(String(field));
  return matches.length * points;
}

export function rankImageSearchResults(books: Book[], plan: ImageSearchPlan): ImageSearchResult[] {
  const titlePhrase = plan.scoreTokens.title[0] ?? "";
  const results = books.map((book) => {
    const matchedFields = new Set<string>();
    let score = 0;
    const normalizedBookTitle = normalizeForMatch(book.title);
    const normalizedTitlePhrase = normalizeForMatch(titlePhrase);

    if (normalizedBookTitle && normalizedTitlePhrase && normalizedBookTitle === normalizedTitlePhrase) {
      score += 120;
      matchedFields.add("title");
    } else if (
      normalizedBookTitle
      && normalizedTitlePhrase
      && (normalizedBookTitle.includes(normalizedTitlePhrase) || normalizedTitlePhrase.includes(normalizedBookTitle))
    ) {
      score += 80;
      matchedFields.add("title");
    }

    score += addScore(matchedFields, book, "title", plan.scoreTokens.title, 18);
    score += addScore(matchedFields, book, "author", plan.scoreTokens.author, 16);
    score += addScore(matchedFields, book, "edition", plan.scoreTokens.edition, 15);
    score += addScore(matchedFields, book, "publisher", plan.scoreTokens.publisher, 12);
    score += addScore(matchedFields, book, "course", plan.scoreTokens.title, 7);
    score += addScore(matchedFields, book, "description", plan.scoreTokens.title, 5);
    score += addScore(matchedFields, book, "subject", plan.scoreTokens.title, 7);
    score += addScore(matchedFields, book, "volume", plan.scoreTokens.edition, 10);
    score += addScore(matchedFields, book, "semester", plan.scoreTokens.edition, 8);
    score += matchedFields.size * 3;

    return { book, score, matchedFields: [...matchedFields] };
  });

  return results
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.book.createdAt).getTime() - new Date(left.book.createdAt).getTime();
    });
}

export function buildImageSearchQuery(draft: BookOcrDraft) {
  return buildImageSearchPlan(draft).displayQuery;
}
