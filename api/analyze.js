// api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📥 Request body:', req.body?.prompt?.substring(0, 200));

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No API key found');
    return res.status(500).json({ 
      error: 'API key not configured',
      debug: 'PERPLEXITY_API_KEY or OPENAI_API_KEY required'
    });
  }

  console.log('🔑 API key available');

  try {
    // Perplexity AI (первая попытка)
    let response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online", // ✅ Бесплатная модель
        messages: [
          { 
            role: "system", 
            content: "Ты эксперт по проверке контрагентов РФ. Отвечай СТРОГО в JSON формате. Используй только данные из файлов." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        stream: false
      })
    });

    // Если Perplexity не работает - пробуем OpenAI
    if (!response.ok) {
      console.log('❌ Perplexity failed, trying OpenAI:', response.status);
      
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: "Ты эксперт по проверке контрагентов РФ. Отвечай СТРОГО в JSON формате. Используй только данные из файлов." 
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 3000,
          temperature: 0.1
        })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return res.status(500).json({ 
        error: `API Error ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('✅ AI Response received');
    
    res.status(200).json(data);

  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
