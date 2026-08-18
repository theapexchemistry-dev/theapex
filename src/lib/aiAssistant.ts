// src/lib/aiAssistant.ts
// ---------------------------------------------------------------------------
// AI Assistant for THE APEX WORLD doubt section.
// Uses Groq API (OpenAI-compatible) — fast inference, free tier available.
// Get your API key at: https://console.groq.com/keys
// ---------------------------------------------------------------------------

// 🔑 Get a Groq API key at https://console.groq.com/keys
// Then add it to your .env file as VITE_GROQ_API_KEY=gsk_...
const GROQ_API_KEY =
  (import.meta as any).env?.VITE_GROQ_API_KEY ||
  'REPLACE_WITH_YOUR_GROQ_API_KEY';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Llama 3.3 70B is great for chemistry tutoring — smart + fast on Groq
const GROQ_MODEL = 'openai/gpt-oss-120b';

export interface AiAnswerResult {
  answer: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  followUpQuestion?: string;
  needsFaculty: boolean; // true when AI says it can't fully answer → escalate
}

const SYSTEM_PROMPT = `You are "Apex AI", a chemistry teaching assistant working for THE APEX WORLD — an Indian chemistry tuition portal run by Mr. Subhamoy Mondal. Your role is to help students in classes 9-12 (and JEE/NEET aspirants) with Physical, Organic, and Inorganic chemistry doubts.

RULES:
1. Answer in clear, simple English a Class 11 student can understand.
2. Show step-by-step working for numerical problems (units, formulas, substitutions, final answer with correct units).
3. For reaction mechanisms, draw out the steps textually with arrow notation (->).
4. Always explain the underlying concept in 1-2 lines before giving the answer.
5. Keep the answer under ~250 words unless the question genuinely needs more.
6. Use plain text notation for formulas when helpful, e.g. H2O, CH3COOH, n = PV/RT.
7. If you are unsure, or the question requires seeing a specific exam/paper, or the student's question is unclear, set needsFaculty=true and briefly explain what the faculty should clarify.
8. End every answer with one short follow-up question that probes the student's deeper understanding (e.g. "Can you tell me why the carbocation forms at the more substituted carbon?").
9. NEVER invent factual data. If a number is uncertain, say so.

OUTPUT FORMAT — return STRICT JSON only, no markdown fences, no extra text:
{
  "answer": "your step-by-step explanation here",
  "confidence": "high | medium | low",
  "followUpQuestion": "one short probing question",
  "needsFaculty": false
}`;

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGroq(messages: GroqChatMessage[]): Promise<string> {
  if (!GROQ_API_KEY || GROQ_API_KEY.startsWith('REPLACE_WITH')) {
    throw new Error(
      'Groq API key not configured. Set VITE_GROQ_API_KEY in your .env file (see .env.example).'
    );
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    let errMsg = `Groq API error ${res.status}`;
    try {
      const errBody = await res.json();
      errMsg += `: ${errBody?.error?.message || JSON.stringify(errBody)}`;
    } catch {
      errMsg += `: ${await res.text()}`;
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response.');
  }
  return content.trim();
}

function parseAiResponse(raw: string): AiAnswerResult {
  // Strip stray markdown fences if the model added them
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      answer: String(parsed.answer || '').trim(),
      confidence: (parsed.confidence as AiAnswerResult['confidence']) || 'unknown',
      followUpQuestion: parsed.followUpQuestion ? String(parsed.followUpQuestion).trim() : undefined,
      needsFaculty: Boolean(parsed.needsFaculty)
    };
  } catch {
    return {
      answer: cleaned || 'I could not generate a structured answer. Please try rephrasing your doubt.',
      confidence: 'unknown',
      needsFaculty: true
    };
  }
}

/**
 * Ask the AI for an answer to a student's doubt.
 *
 * @param question  The student's question text
 * @param subject   "Physical Chemistry" | "Organic Chemistry" | "Inorganic Chemistry" | "General Science"
 * @param className "Class 9" | "Class 10" | "Class 11" | "Class 12"
 */
export async function askAiAssistant(
  question: string,
  subject: string,
  className?: string
): Promise<AiAnswerResult> {
  const userPrompt = `Student Class: ${className || 'Class 11-12 (JEE/NEET aspirant)'}
Subject Area: ${subject}

Student Question:
"""
 ${question}
"""

Answer as Apex AI. Follow the rules and output format strictly. Return JSON only.`;

  const messages: GroqChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  const raw = await callGroq(messages);
  return parseAiResponse(raw);
}

/**
 * Allow the student to ask a follow-up question in the same chat thread.
 * The chat history is built up locally and sent each call.
 */
export async function askAiFollowUp(
  history: Array<{ role: 'user' | 'ai'; text: string }>,
  newQuestion: string,
  subject: string,
  className?: string
): Promise<AiAnswerResult> {
  const messages: GroqChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  // Convert history to Groq/OpenAI message format
  for (const m of history) {
    messages.push({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    });
  }

  // Add the new question
  messages.push({
    role: 'user',
    content: `Subject Area: ${subject}
Student Class: ${className || 'Class 11-12'}

NEW MESSAGE FROM STUDENT:
"""
 ${newQuestion}
"""

Answer as Apex AI. Be concise (≤200 words) and reference what was discussed earlier if relevant. Output STRICT JSON in the same format.`
  });

  const raw = await callGroq(messages);
  return parseAiResponse(raw);
}
