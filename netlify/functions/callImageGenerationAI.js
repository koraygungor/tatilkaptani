const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { promptText } = JSON.parse(event.body);

    if (!promptText) {
        return { statusCode: 400, body: 'Prompt text is required.' };
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    try {
        const result = await model.generateContent([
            { text: `Generate a vivid and detailed description for an image based on the following request: "${promptText}". The description should be suitable for a text-to-image model. Also, suggest a related public image URL from Unsplash or Pixabay (e.g., https://source.unsplash.com/random/800x600/?keywords).` }
        ]);

        const response = await result.response;
        const textContent = response.text();
        console.log("Gemini'den gelen görsel açıklaması:", textContent);

        const urlMatch = textContent.match(/(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|unsplash\.com\/\S+|pixabay\.com\/\S+))/i);
        let imageUrl;
        if (urlMatch) {
            imageUrl = urlMatch[0];
        } else {
            const keywords = promptText.split(' ').slice(0, 3).join(',');
            imageUrl = `https://source.unsplash.com/random/800x600/?${keywords || 'travel'}`;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ imageUrl: imageUrl, description: textContent })
        };

    } catch (error) {
        console.error("Netlify Function 'callImageGenerationAI' hatası:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Dahili sunucu hatası.' }) };
    }
};