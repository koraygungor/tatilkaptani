exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { email, username, imageUrl, subject } = JSON.parse(event.body);

    if (!email || !username) {
        return { statusCode: 400, body: 'E-posta ve kullanıcı adı gereklidir.' };
    }

    console.log(`Netlify Function Simülasyonu: E-posta gönderiliyor: ${email}, kullanıcı: ${username}, Konu: ${subject || 'Hoş Gelişiniz!'}`);
    if (imageUrl) {
        console.log(`Ekli görsel URL: ${imageUrl}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
        statusCode: 200,
        body: JSON.stringify({ status: 'success', message: 'E-posta gönderildi (simülasyon).' })
    };
};