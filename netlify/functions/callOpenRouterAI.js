const fetch = require('node-fetch');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { prompt, model, chatHistory } = JSON.parse(event.body);

    if (!prompt && (!chatHistory || chatHistory.length === 0)) {
        return { statusCode: 400, body: 'Prompt or chat history is required.' };
    }

    let messages;
    if (chatHistory && chatHistory.length > 0) {
        messages = [...chatHistory];
        if (prompt) {
            messages.push({ role: "user", content: prompt });
        }
    } else {
        messages = [{ role: "user", content: prompt }];
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://tatilkaptani.com",
                "X-Title": "TatilKaptani.com Backend (Netlify Function)"
            },
            body: JSON.stringify({
                model: model || "openai/gpt-3.5-turbo",
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("OpenRouter API hatası yanıtı:", errorData);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: errorData.message || 'OpenRouter API isteği başarısız oldu.' })
            };
        }

        const data = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify({ reply: data?.choices?.[0]?.message?.content || "Üzgünüm, şu an cevap alamıyorum." })
        };

    } catch (error) {
        console.error("Netlify Function 'callOpenRouterAI' hatası:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Dahili sunucu hatası.' }) };
    }
};