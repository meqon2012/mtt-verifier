// api/analyze.js - СОЗДАЙТЕ этот файл
export default async function handler(req, res) {
  // 🆕 ТЕСТ КЛЮЧА - ДОБАВЬТЕ В URL: /api/test-key
  if (req.url === '/api/test-key') {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    return res.json({ 
      success: true,
      keyExists: !!apiKey,
      keyFormat: apiKey ? `pplx-${apiKey.slice(5,10)}****` : 'MISSING',
      keyLength: apiKey?.length || 0,
      timestamp: new Date().toISOString()
    });
  }

  // Основной API
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          { role: "system", content: "Ты эксперт по проверке контрагентов РФ. Отвечай СТРОГО в JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
