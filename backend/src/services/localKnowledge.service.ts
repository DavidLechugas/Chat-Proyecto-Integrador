import knowledgeBase from "../data/knowledgeBase.json";
import { Message } from "./types";

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

type KnowledgeItem = {
  id: string;
  keywords: string[];
  answer: string;
};

const rows = knowledgeBase as KnowledgeItem[];

const splitTokens = (text: string): string[] =>
  normalize(text)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2);

const isFollowUp = (text: string): boolean => {
  const t = normalize(text.trim());
  if (t.length <= 18) {
    return true;
  }

  const followUps = [
    "y eso",
    "y si",
    "y cuanto",
    "y cada cuanto",
    "cual recomiendas",
    "que recomiendas",
    "sirve",
    "compatible",
    "por que",
  ];

  return followUps.some((item) => t.startsWith(item));
};

const buildContextMessage = (message: string, history: Message[]): string => {
  if (!isFollowUp(message)) {
    return message;
  }

  const lastUser = [...history].reverse().find((item) => item.role === "user");
  if (!lastUser) {
    return message;
  }

  return `${lastUser.content} ${message}`;
};

export const findLocalAnswer = (message: string, history: Message[]): string | null => {
  const enrichedMessage = buildContextMessage(message, history);
  const normalizedMessage = normalize(enrichedMessage);
  const messageTokens = new Set(splitTokens(enrichedMessage));
  let best: { answer: string; score: number } | null = null;

  for (const row of rows) {
    let score = 0;

    for (const keyword of row.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (normalizedMessage.includes(normalizedKeyword)) {
        score += normalizedKeyword.includes(" ") ? 3 : 2;
      } else {
        const keywordTokens = splitTokens(keyword);
        const overlap = keywordTokens.filter((token) => messageTokens.has(token)).length;
        if (overlap > 0) {
          score += overlap;
        }
      }
    }

    if (score >= 2 && (!best || score > best.score)) {
      best = { answer: row.answer, score };
    }
  }

  return best?.answer ?? null;
};
