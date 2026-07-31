const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Mock responses for when API fails
const MOCK_RESPONSES = {
  en: [
    "I've broken down your goal into 5 daily actions:\n\n1. Wake up at 6 AM daily\n2. Study for 2 hours focused\n3. Practice for 1 hour\n4. Review what you learned\n5. Plan tomorrow's steps\n\nNo excuses. Execute.",
    "Your path is clear:\n\n1. Set a 5 AM alarm\n2. 1 hour of focused study\n3. Apply what you learn immediately\n4. 30 min exercise\n5. 30 min reflection\n\nDiscipline is non-negotiable.",
    "I've analyzed your goal. Here's your strict breakdown:\n\n1. Create a daily schedule\n2. Remove all distractions\n3. 3 hours dedicated practice daily\n4. Track every session\n5. Weekly review of progress\n\nNow move."
  ],
  ar: [
    "لقد قمت بتقسيم هدفك إلى 5 خطوات يومية:\n\n1. استيقظ في الساعة 6 صباحاً\n2. ادرس لمدة ساعتين بتركيز\n3. مارس لمدة ساعة\n4. راجع ما تعلمته\n5. خطط لخطوات الغد\n\nلا أعذار. نفذ.",
    "مسارك واضح:\n\n1. اضبط منبهك على 5 صباحاً\n2. ساعة دراسة مركزة\n3. طبّق ما تتعلمه فوراً\n4. 30 دقيقة رياضة\n5. 30 دقيقة تأمل\n\nالانضباط غير قابل للتفاوض.",
    "لقد حللت هدفك. إليك تقسيمك الصارم:\n\n1. أنشئ جدولاً يومياً\n2. أزل كل المشتتات\n3. 3 ساعات ممارسة يومية\n4. تتبع كل جلسة\n5. مراجعة أسبوعية للتقدم\n\nالآن انطلق."
  ]
};

function getMockResponse(lang) {
  const responses = MOCK_RESPONSES[lang] || MOCK_RESPONSES.en;
  return responses[Math.floor(Math.random() * responses.length)];
}

function detectLanguage(text) {
  const arabicPattern = /[؀-ۿ]/;
  return arabicPattern.test(text) ? 'ar' : 'en';
}

module.exports = async function handler(req, res) {
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
      return res.status(200).json({ content: 'Tell me your goal. Be specific.' });
    }

    const lang = detectLanguage(userMessage);
    let response;

    // Try AI first, fallback to mock
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== '') {
      try {
        const SYSTEM_PROMPT = lang === 'ar' 
          ? 'أنت ليو، مدرب حياة صارم. قسّم الهدف إلى 5 خطوات يومية محددة.'
          : 'You are Leo, a strict life coach. Break down the goal into 5 specific daily steps.';
        
        const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nGoal: ${userMessage}`);
        response = result.response.text();
      } catch (apiError) {
        console.log('API failed, using mock response:', apiError.message);
        response = getMockResponse(lang);
      }
    } else {
      console.log('No API key, using mock response');
      response = getMockResponse(lang);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ content: response, done: true });

  } catch (error) {
    console.error('Coach Error:', error);
    
    // Always fallback - never fail
    const lang = detectLanguage(error.message || '');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ 
      content: getMockResponse(lang),
      done: true 
    });
  }
};
