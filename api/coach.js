const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Bilingual system prompt for Leo coach
const SYSTEM_PROMPT = `You are Leo, a strict and disciplined AI life coach. You help users achieve their goals through actionable breakdowns.

RULES:
- Respond in the same language the user uses (Arabic or English)
- Be direct, motivating, and results-focused
- Break every goal into 3-5 specific daily actions
- Hold the user accountable with strict language
- Never be soft - push hard

Arabic: "أريدك أن تكون صارماً. حدد لي 5 خطوات يومية محددة للوصول إلى هدفي."
English: "I want you to be strict. Give me 5 specific daily steps to reach my goal."

Examples:
- User: "I want to be a doctor" → Response in English with 5 daily steps
- User: "أريد أن أتعلم البرمجة" → Response in Arabic with 5 daily steps`;

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).send('');
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content: userMessage } = req.body;

    if (!userMessage || !userMessage.trim()) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Please enter a goal' });
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: 'API not configured' });
    }

    // Generate response with context
    const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Goal: ${userMessage}`;
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ content: text, done: true });

  } catch (error) {
    console.error('Coach API Error:', error);
    
    res.setHeader('Content-Type', 'application/json');
    
    // Specific error handling
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return res.status(429).json({ error: 'API limit reached. Try again tomorrow.' });
    }
    if (error.message?.includes('api key') || error.message?.includes('API_KEY')) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    if (error.message?.includes('INVALID_ARGUMENT') || error.message?.includes('empty')) {
      return res.status(400).json({ error: 'Invalid request. Please try again.' });
    }
    
    return res.status(500).json({ error: 'Connection failed. Please try again.' });
  }
};
