const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content: userMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const result = await model.generateContent(userMessage);
    const text = result.response.text();

    return res.status(200).json({ content: text, done: true });

  } catch (error) {
    console.error('Coach API Error:', error.message);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }
};
