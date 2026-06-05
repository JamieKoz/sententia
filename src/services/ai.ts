import type { Title } from "../types";
import { loadBackendConfig } from "./backendConfig";
import { fetchWithTimeoutAndRetries } from "./aiFetch";
import {
  extractMessageTextContent,
  parseGeneratePayload,
  parseRerankPayload,
  safeParseJson,
  validateRerankPermutation
} from "./aiJson";
import { buildGeneratePrompt, buildRerankPrompt } from "./aiPrompts";
import type { AiGenerateRequest, AiRerankRequest, AiSuggestedTitle } from "./aiTypes";

export type { AiGenerateRequest, AiHistoryHints, AiRerankRequest, AiSuggestedTitle } from "./aiTypes";

const OPENAI_COMPLETIONS_URL = "/api/openai/chat/completions";
const AI_LOG = "[couchpicks-ai]";

export async function rerankCandidatesWithAi(req: AiRerankRequest): Promise<Title[]> {
  const config = await getAiRuntime();
  if (!config) return req.candidates;

  for (const model of config.models) {
    const orderedIds = await tryRerankWithModel({ ...req, model });
    if (orderedIds.length > 0) {
      return mapIdsToCandidates(orderedIds, req.candidates);
    }
  }

  console.warn(`${AI_LOG} rerank exhausted models; using score order`);
  return req.candidates;
}

export async function generateSuggestionsWithAi(req: AiGenerateRequest): Promise<AiSuggestedTitle[]> {
  const config = await getAiRuntime();
  if (!config) return [];

  for (const model of config.models) {
    const suggestions = await tryGenerateWithModel({ ...req, model });
    if (suggestions.length >= req.count) return suggestions.slice(0, req.count);
    if (suggestions.length > 0) {
      console.warn(
        `${AI_LOG} model ${model} returned ${suggestions.length}/${req.count} suggestions; using partial batch`
      );
      return suggestions;
    }
  }

  console.warn(`${AI_LOG} generate produced no usable suggestions`);
  return [];
}

interface ModelAttempt extends AiRerankRequest {
  model: string;
}

interface GenerateModelAttempt extends AiGenerateRequest {
  model: string;
}

async function tryRerankWithModel(input: ModelAttempt): Promise<string[]> {
  const prompt = buildRerankPrompt(input);
  const body = {
    model: input.model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a recommendation ranker. Return strict JSON only in the shape {\"orderedIds\":[...]} with every candidate id exactly once."
      },
      { role: "user", content: prompt }
    ]
  };

  try {
    const response = await fetchWithTimeoutAndRetries(OPENAI_COMPLETIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn(`${AI_LOG} rerank HTTP ${response.status} model=${input.model}`);
      return [];
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = extractMessageTextContent(data.choices?.[0]?.message?.content);
    if (!content) {
      console.warn(`${AI_LOG} rerank empty content model=${input.model}`);
      return [];
    }

    const parsed = safeParseJson(content);
    const payload = parseRerankPayload(parsed);
    if (!payload) {
      console.warn(`${AI_LOG} rerank JSON shape invalid model=${input.model}`);
      return [];
    }

    const validated = validateRerankPermutation(payload.orderedIds, input.candidates);
    if (!validated) {
      console.warn(
        `${AI_LOG} rerank orderedIds not a permutation of candidates (count=${input.candidates.length}) model=${input.model}`
      );
      return [];
    }

    return validated;
  } catch (error) {
    console.warn(`${AI_LOG} rerank failed model=${input.model}`, error);
    return [];
  }
}

async function tryGenerateWithModel(input: GenerateModelAttempt): Promise<AiSuggestedTitle[]> {
  const prompt = buildGeneratePrompt(input);
  const body = {
    model: input.model,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You recommend watchable titles. Return strict JSON only in the shape {\"suggestions\":[{\"name\":\"\",\"type\":\"movie|series\",\"reason\":\"\"}]}"
      },
      { role: "user", content: prompt }
    ]
  };

  try {
    const response = await fetchWithTimeoutAndRetries(OPENAI_COMPLETIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn(`${AI_LOG} generate HTTP ${response.status} model=${input.model}`);
      return [];
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = extractMessageTextContent(data.choices?.[0]?.message?.content);
    if (!content) {
      console.warn(`${AI_LOG} generate empty content model=${input.model}`);
      return [];
    }

    const parsed = safeParseJson(content);
    const structured = parseGeneratePayload(parsed);
    if (!structured) {
      console.warn(`${AI_LOG} generate JSON shape invalid model=${input.model}`);
      return [];
    }

    return normalizeSuggestions(structured, input.count);
  } catch (error) {
    console.warn(`${AI_LOG} generate failed model=${input.model}`, error);
    return [];
  }
}

function normalizeSuggestions(suggestions: AiSuggestedTitle[], count: number): AiSuggestedTitle[] {
  const valid: AiSuggestedTitle[] = [];
  const seen = new Set<string>();

  for (const item of suggestions) {
    const name = item.name?.trim();
    const type = item.type === "series" ? "series" : item.type === "movie" ? "movie" : undefined;
    if (!name || !type) continue;
    const key = `${name.toLowerCase()}::${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ name, type, reason: item.reason?.trim() });
    if (valid.length >= count) break;
  }

  return valid;
}

function mapIdsToCandidates(orderedIds: string[], candidates: Title[]): Title[] {
  const map = new Map(candidates.map((title) => [title.id, title]));
  return orderedIds.map((id) => map.get(id)).filter((title): title is Title => Boolean(title));
}

interface AiRuntime {
  models: string[];
}

async function getAiRuntime(): Promise<AiRuntime | null> {
  const backend = await loadBackendConfig();
  if (!backend.ai || backend.openaiModels.length === 0) return null;
  return { models: backend.openaiModels };
}
