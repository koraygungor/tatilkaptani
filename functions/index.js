const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// OpenAI/Google Gemini API anahtarları ortam değişkenlerinden okunur.
// Bu anahtarları Firebase config set komutuyla ayarlamanız gerekecek:
// firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY" google.gemini_key="YOUR_GEMINI_API_KEY"
const openAiApiKey = functions.config().openai?.key;
const googleGeminiApiKey = functions.config().google?.gemini_key; // Veya benzeri

// Diğer backend modülleri
const axios = require('axios'); // API çağrıları için (axios yüklü değilse, functions/package.json'a eklemelisiniz)

// Örnek Cloud Function: callOpenRouterAI
exports.callOpenRouterAI = functions.https.onCall(async (data, context) => {
    // Güvenlik ve yetkilendirme kontrolleri burada yapılır.
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Kullanıcı kimliği doğrulanmadı.');
    }

    const prompt = data.prompt;
    const model = data.model || "openai/gpt-3.5-turbo";
    const chatHistory = data.chatHistory || []; // Sohbet geçmişi aktarılır

    if (!openAiApiKey) {
        throw new functions.https.HttpsError('internal', 'OpenAI API anahtarı yapılandırılmamış.');
    }

    try {
        const messages = [
            { role: "system", content: "You are a helpful travel assistant called 'Palmiye Kaptan'." },
            ...chatHistory,
            { role: "user", content: prompt }
        ];

        const response = await axios.post(
            `https://openrouter.ai/api/v1/chat/completions`,
            {
                model: model,
                messages: messages,
            },
            {
                headers: {
                    'Authorization': `Bearer ${openAiApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return { reply: response.data.choices[0].message.content };
    } catch (error) {
        console.error("OpenRouter AI çağrılırken hata:", error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', `AI API hatası: ${error.response?.data?.message || error.message}`);
    }
});

// Google Gemini için örnek Cloud Function (eğer kullanılacaksa)
exports.callImageGenerationAI = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new new functions.https.HttpsError('unauthenticated', 'Kullanıcı kimliği doğrulanmadı.');
    }
    const promptText = data.promptText;

    if (!googleGeminiApiKey) {
        throw new functions.https.HttpsError('internal', 'Google Gemini API anahtarı yapılandırılmamış.');
    }

    try {
        // Buradaki API çağrısını Google Gemini Image Generation API'ına göre ayarlamanız gerekecektir.
        // Bu kısım, kullandığınız spesifik Gemini API'ına göre farklılık gösterebilir.
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${googleGeminiApiKey}`,
            {
                contents: [{ parts: [{ text: promptText }] }]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        // Yanıt formatına göre URL'yi döndürmelisiniz
        // Örnek: return { imageUrl: response.data.candidates[0].content.parts[0].text };
        // Şu an için sabit bir placeholder dönüyorum.
        return { imageUrl: `https://via.placeholder.com/600x400?text=${encodeURIComponent(promptText)}` };

    } catch (error) {
        console.error("Google Gemini Image Generation çağrılırken hata:", error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', `Görsel API hatası: ${error.response?.data?.message || error.message}`);
    }
});

// Yönetici mesajını Firestore'dan alma (Örnek)
exports.getAdminMessage = functions.https.onCall(async (data, context) => {
    try {
        const doc = await firestore.collection('public').doc('adminMessage').get();
        return { message: doc.exists ? doc.data().text : "Henüz yönetici mesajı yok." };
    } catch (error) {
        console.error("Yönetici mesajı alınırken hata:", error);
        throw new functions.https.HttpsError('internal', 'Yönetici mesajı alınamadı.');
    }
});

// Yönetici mesajını güncelleme (Örnek - Sadece Admin yetkisi olanlar için)
exports.updateAdminMessage = functions.https.onCall(async (data, context) => {
    // Örnek yetkilendirme kontrolü: Sadece belirli bir UID'ye sahip kullanıcılar veya rolü olanlar güncelleyebilir.
    // if (!context.auth || context.auth.uid !== "YETKİLİ_ADMIN_UID") { // Kendi admin UID'nizi buraya yazın
    //     throw new functions.https.HttpsError('permission-denied', 'Bu işlemi yapmaya yetkiniz yok.');
    // }
    // Veya daha gelişmiş rol tabanlı yetkilendirme kullanabilirsiniz.

    const message = data.message;
    if (!message) {
        throw new functions.https.HttpsError('invalid-argument', 'Mesaj boş olamaz.');
    }
    try {
        await firestore.collection('public').doc('adminMessage').set({ text: message });
        return { message: "Yönetici mesajı başarıyla güncellendi." };
    } catch (error) {
        console.error("Yönetici mesajı güncellenirken hata:", error);
        throw new functions.https.HttpsError('internal', 'Yönetici mesajı güncellenemedi.');
    }
});

// Hoş geldin e-postası gönderme fonksiyonu (Örnek)
exports.sendWelcomeEmail = functions.https.onCall(async (data, context) => {
    const { email, username, subject, message, imageUrl } = data; // subject, message, imageUrl eklendi
    console.log(`Sending welcome email to ${email} for user ${username}`);

    // Burası gerçek bir e-posta gönderme servisine (SendGrid, Nodemailer vb.) bağlanacak kısım.
    // Bu kısım sadece bir simülasyondur.
    try {
        // E-posta gönderimi simülasyonu
        const simulatedEmailServiceResponse = { success: true, messageId: "simulated-email-id-123" };
        console.log("Simulated email sent:", simulatedEmailServiceResponse);

        let responseMessage = `Hoş geldin e-postası ${email} adresine gönderildi.`;
        let fileUrl = null;
        if (imageUrl) {
            responseMessage += ` Hediye görsel URL'si: ${imageUrl}`;
            fileUrl = imageUrl;
        }
        return { message: responseMessage, fileUrl: fileUrl };

    } catch (error) {
        console.error("Hoş geldin e-postası gönderilirken hata:", error);
        throw new functions.https.HttpsError('internal', `E-posta gönderilirken bir sorun oluştu: ${error.message}`);
    }
});

// İletişim formu gönderme (Örnek)
exports.submitContactForm = functions.https.onCall(async (data, context) => {
    const { subject, email, message, fileName, fileType, fileData } = data;
    console.log(`Contact form submitted from ${email} with subject: ${subject}`);

    let fileUrl = null;
    try {
        // Dosya yükleme (eğer varsa)
        if (fileName && fileData) {
            const bucket = admin.storage().bucket(); // Firebase Storage bucket'ı
            const fileRef = bucket.file(`contact_uploads/${Date.now()}_${fileName}`);
            const buffer = Buffer.from(fileData, 'base64');
            await fileRef.save(buffer, {
                metadata: { contentType: fileType },
                resumable: false // Tek seferde yükleme
            });
            fileUrl = await fileRef.getSignedUrl({
                action: 'read',
                expires: '03-09-2491' // Uzun bir süre geçerli
            });
            fileUrl = fileUrl[0]; // İlk URL'yi al
            console.log("Uploaded file URL:", fileUrl);
        }

        // Bu verileri Firestore'a kaydetme veya başka bir e-posta bildirim sistemine gönderme
        await firestore.collection('contactForms').add({
            subject,
            email,
            message,
            fileName: fileName || null,
            fileType: fileType || null,
            fileUrl: fileUrl || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { message: "Mesajınız başarıyla alındı ve kaydedildi!", fileUrl: fileUrl };
    } catch (error) {
        console.error("İletişim formu işlenirken hata:", error);
        throw new functions.https.HttpsError('internal', `İletişim formunuz gönderilirken bir sorun oluştu: ${error.message}`);
    }
});