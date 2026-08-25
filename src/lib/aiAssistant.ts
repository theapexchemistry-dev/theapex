// src/lib/aiAssistant.ts
// ---------------------------------------------------------------------------
// AI Assistant for THE APEX WORLD doubt section.
// Now proxies to the backend /api/ai endpoints.
// ---------------------------------------------------------------------------

export interface AiAnswerResult {
  answer: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  followUpQuestion?: string;
  needsFaculty: boolean;
}

function parseAiResponse(raw: string): AiAnswerResult {
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

export async function askAiAssistant(
  question: string,
  subject: string,
  className?: string,
  image?: string
): Promise<AiAnswerResult> {
  const res = await fetch('/api/ai/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, subject, className, image })
  });

  const resText = await res.text().catch(() => '');
  let data: any = {};
  try {
    data = resText ? JSON.parse(resText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`AI service encountered a network error (${res.status}). Please try again.`);
    }
    return parseAiResponse(resText);
  }

  if (!res.ok) {
    let errorMsg = data?.error || `Server error (${res.status})`;
    if (typeof errorMsg === 'string' && errorMsg.includes('GROQ_API_KEY')) {
      errorMsg = 'AI service key is being configured. Please try again shortly.';
    }
    throw new Error(errorMsg);
  }

  return parseAiResponse(data.content || resText);
}

export async function askAiFollowUp(
  history: Array<{ role: 'user' | 'ai'; text: string }>,
  newQuestion: string,
  subject: string,
  className?: string
): Promise<AiAnswerResult> {
  const res = await fetch('/api/ai/follow-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, newQuestion, subject, className })
  });

  const resText = await res.text().catch(() => '');
  let data: any = {};
  try {
    data = resText ? JSON.parse(resText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`AI service encountered a network error (${res.status}). Please try again.`);
    }
    return parseAiResponse(resText);
  }

  if (!res.ok) {
    const errorMsg = data?.error || `Server error (${res.status})`;
    throw new Error(errorMsg);
  }

  return parseAiResponse(data.content || resText);
}
