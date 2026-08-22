import Groq from 'groq-sdk';

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

let groqClient: Groq | null = null;
function getGroqClient(): Groq {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not configured in Vercel Environment Variables. Please add GROQ_API_KEY to your Vercel project settings.");
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { question, subject, className, image } = req.body || {};
    if (!question && !image) {
      return res.status(400).json({ error: 'Please provide a question or attach an image.' });
    }

    const userPrompt = `Student Class: ${className || 'Class 11-12 (JEE/NEET aspirant)'}\nSubject Area: ${subject || 'Chemistry'}\n\nStudent Question:\n"""\n${question || 'Please analyze and solve the chemistry problem shown in the attached image.'}\n"""\n\nAnswer as Apex AI. Follow the rules and output format strictly. Return JSON only.`;
    
    const groq = getGroqClient();
    const hasImage = image && typeof image === 'string' && image.startsWith('data:image/');
    const targetModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    
    let messages: any[];
    let model = targetModel;

    if (hasImage) {
      model = 'llama-3.2-11b-vision-preview';
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ];
    } else {
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ];
    }

    let responseContent = '{}';
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });
      responseContent = completion.choices[0]?.message?.content || '{}';
    } catch (err: any) {
      console.warn(`[Groq Vercel] Model ${model} failed (${err.message}). Trying fallback model.`);
      const fallbackModel = (model === targetModel) ? 'llama-3.3-70b-versatile' : targetModel;
      const fallbackCompletion = await groq.chat.completions.create({
        model: fallbackModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });
      responseContent = fallbackCompletion.choices[0]?.message?.content || '{}';
    }
    
    return res.status(200).json({ content: responseContent });
  } catch (err: any) {
    console.error('[Groq Vercel] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process AI question.' });
  }
}
