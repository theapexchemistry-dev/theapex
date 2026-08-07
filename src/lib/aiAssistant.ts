// src/lib/aiAssistant.ts
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  'REPLACE_WITH_YOUR_GEMINI_API_KEY';

let cachedClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('REPLACE_WITH')) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in your .env file.');
  }
  cachedClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return cachedClient;
}

export interface AiAnswerResult {
  answer: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  followUpQuestion?: string;
  needsFaculty: boolean;
}

const SYSTEM_PROMPT = `You are "Apex AI", a chemistry teaching assistant working for THE APEX WORLD — an Indian chemistry tuition portal run by Mr. Subhamoy Mondal. Your role is to help students in classes 9-12 (and JEE/NEET aspirants) with Physical, Organic, and Inorganic chemistry doubts.

RULES:
1. Answer in clear, simple English a Class 11 student can understand.
2. Show step-by-step working for numerical problems (units, formulas, substitutions, final answer with correct units).
3. For reaction mechanisms, draw out the steps textually with arrow notation (->).
4. Always explain the underlying concept in 1-2 lines before giving the answer.
5. Keep the answer under ~250 words unless the question genuinely needs more.
6. Use LaTeX-style notation for formulas when helpful, e.g. H_2O, CH_3COOH, n = PV/RT.
7. If you are unsure, or the question requires seeing a specific exam/paper, or the student's question is unclear, set needs_faculty=true and briefly explain what the faculty should clarify.
8. End every answer with one short follow-up question that probes the student's deeper understanding.
9. NEVER invent factual data. If a number is uncertain, say so.

OUTPUT FORMAT — return STRICT JSON only, no markdown fences, no extra text:
{
  "answer": "your step-by-step explanation here",
  "confidence": "high | medium | low",
  "followUpQuestion": "one short probing question",
  "needsFaculty": false
}`;

export async function askAiAssistant(
  question: string,
  subject: string,
  className?: string
): Promise<AiAnswerResult> {
  const client = getClient();

  const userPrompt = `Student Class: ${className || 'Class 11-12 (JEE/NEET aspirant)'}
Subject Area: ${subject}

Student Question:
"""
 ${question}
"""

Answer as Apex AI. Follow the rules and output format strictly.`;

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json'
    }
  });

  const raw = (response.text || '').trim();
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      answer: cleaned || 'I could not generate a structured answer. Please try rephrasing your doubt.',
      confidence: 'unknown',
      needsFaculty: true
    };
  }

  return {
    answer: String(parsed.answer || '').trim(),
    confidence: (parsed.confidence as AiAnswerResult['confidence']) || 'unknown',
    followUpQuestion: parsed.followUpQuestion ? String(parsed.followUpQuestion).trim() : undefined,
    needsFaculty: Boolean(parsed.needsFaculty)
  };
}

export async function askAiFollowUp(
  history: Array<{ role: 'user' | 'ai'; text: string }>,
  newQuestion: string,
  subject: string,
  className?: string
): Promise<AiAnswerResult> {
  const client = getClient();

  const historyStr = history
    .map((m) => (m.role === 'user' ? `STUDENT: ${m.text}` : `APEX AI: ${m.text}`))
    .join('\n\n');

  const userPrompt = `Subject Area: ${subject}
Student Class: ${className || 'Class 11-12'}

CONVERSATION SO FAR:
 ${historyStr || '(none)'}

NEW MESSAGE FROM STUDENT:
"""
 ${newQuestion}
"""

Answer as Apex AI. Be concise (≤200 words) and reference what was discussed earlier if relevant. Output STRICT JSON in the same format.`;

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.5,
      topP: 0.9,
      maxOutputTokens: 900,
      responseMimeType: 'application/json'
    }
  });

  const raw = (response.text || '').trim();
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

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
      answer: cleaned || 'I could not generate a structured answer.',
      confidence: 'unknown',
      needsFaculty: true
    };
  }
}
