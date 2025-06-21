const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch'); // node-fetch paketi Cloud Functions ortamında HTTP istekleri yapmak için

// CORS ayarları: Üretimde sadece kendi alan adınıza izin verin.
// Örneğin: { origin: ['https://tatilkaptani.com', 'http://localhost:5000'] }
const cors = require('cors')({ origin: true }); 

// API anahtarlarını ortam değişkenlerinden güvenli bir şekilde alın
// Bu anahtarlar Firebase CLI ile ayarlanmalıdır:
// firebase functions:config:set openrouter.key="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"
// firebase functions:config:set gemini.key="YOUR_GOOGLE_GEMINI_API_KEY_FROM_AI_STUDIO"
// Not: Google Gemini API anahtarı için OpenAI/OpenRouter gibi bir 'sk-' öneki yoktur. Doğrudan Google AI Studio'dan aldığınız anahtarı kullanın.
const OPENROUTER_API_KEY = functions.config().openrouter.key;
const GOOGLE_GEMINI_API_KEY = functions.config().gemini.key;

// OpenRouter AI Chat Fonksiyonu (HTTPS İstek)
exports.callOpenRouterAI = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const { prompt, model, chatHistory } = req.body;

        // Geçmiş veya doğrudan prompt gelmeli
        if (!prompt && (!chatHistory || chatHistory.length === 0)) {
            return res.status(400).send('Prompt or chat history is required.');
        }

        let messages;
        if (chatHistory && chatHistory.length > 0) {
            messages = [...chatHistory];
            if (prompt) { // Eğer geçmişle birlikte yeni prompt varsa, geçmişe ekle
                messages.push({ role: "user", content: prompt });
            }
        } else { // Sadece prompt varsa, yeni bir mesaj dizisi oluştur
            messages = [{ role: "user", content: prompt }];
        }
        
        // Hata ayıklama için gelen mesajları logla
        console.log("OpenRouter AI'a gönderilen mesajlar:", messages);

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    // Kendi alan adınızı buraya ekleyin:
                    "HTTP-Referer": "https://tatilkaptani.com", 
                    "X-Title": "TatilKaptani.com Backend"
                },
                body: JSON.stringify({
                    model: model || "openai/gpt-3.5-turbo",
                    messages: messages
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("OpenRouter API hatası yanıtı:", errorData);
                return res.status(response.status).json({ error: errorData.message || 'OpenRouter API isteği başarısız oldu.' });
            }

            const data = await response.json();
            res.status(200).json({ reply: data?.choices?.[0]?.message?.content || "Üzgünüm, şu an cevap alamıyorum." });

        } catch (error) {
            console.error("Backend OpenRouter AI fonksiyon hatası:", error);
            res.status(500).json({ error: 'Dahili sunucu hatası.' });
        }
    });
});

// Google Gemini Görsel Oluşturma Fonksiyonu (HTTPS İstek)
// Not: Gemini Pro Vision doğrudan görsel üretmez. Bu fonksiyon, AI'dan bir görsel açıklaması ve
// Unsplash gibi bir kaynaktan ilgili placeholder bir görsel URL'si almayı simüle eder.
// Gerçek görsel üretimi için (örn. DALL-E) ayrı bir servis entegrasyonu gereklidir.
exports.callImageGenerationAI = functions.https.onCall(async (data, context) => { // onRequest yerine onCall ile daha güvenli
    // if (!context.auth) { // İsteğe bağlı olarak kimlik doğrulama eklenebilir
    //     throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.');
    // }

    const { promptText } = data;

    if (!promptText) {
        throw new functions.https.HttpsError('invalid-argument', 'Prompt text is required.');
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    try {
        // Gemini Pro Vision'a görsel oluşturması için değil, görsel açıklaması yapması için soruyoruz
        const result = await model.generateContent([
            { text: `Generate a vivid and detailed description for an image based on the following request: "${promptText}". The description should be suitable for a text-to-image model. Also, suggest a related public image URL from Unsplash or Pixabay (e.g., https://source.unsplash.com/random/800x600/?keywords).` }
        ]);

        const response = await result.response;
        const textContent = response.text();
        console.log("Gemini'den gelen görsel açıklaması:", textContent);

        // AI'dan gelen metin içinde bir URL olup olmadığını kontrol et
        const urlMatch = textContent.match(/(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|unsplash\.com\/\S+|pixabay\.com\/\S+))/i);
        let imageUrl;
        if (urlMatch) {
            imageUrl = urlMatch[0];
        } else {
            // Eğer URL yoksa, genel bir Unsplash resmi oluşturmaya çalış
            const keywords = promptText.split(' ').slice(0, 3).join(','); // Prompt'tan anahtar kelimeler al
            imageUrl = `https://source.unsplash.com/random/800x600/?${keywords || 'travel'}`;
        }

        return { imageUrl: imageUrl, description: textContent };

    } catch (error) {
        console.error("Backend Gemini Image Generation hatası:", error);
        throw new functions.https.HttpsError('internal', 'Görsel oluşturulurken dahili sunucu hatası.', error.message);
    }
});

// Admin Mesajını Güncelleme Fonksiyonu (HTTPS Callable - Yetkilendirme gerektirir)
// Bu fonksiyon sadece oturum açmış ve "admin" rolüne sahip kullanıcılar tarafından çağrılmalıdır.
exports.updateAdminMessage = functions.https.onCall(async (data, context) => {
    // 1. Kimlik Doğrulama: Kullanıcının giriş yapıp yapmadığını kontrol edin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.');
    }

    const userId = context.auth.uid;
    const message = data.message;

    if (typeof message !== 'string' || message.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Mesaj boş olamaz.');
    }

    // 2. Yetkilendirme: Kullanıcının yönetici olup olmadığını kontrol edin
    // Bu kontrol, Firestore'daki 'users' koleksiyonunda kullanıcının 'role' alanını okuyarak yapılır.
    // Güvenlik kurallarınızda da bu rol kontrolünü yansıtmalısınız.
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') { 
        throw new functions.https.HttpsError('permission-denied', 'Bu işlemi gerçekleştirmeye yetkiniz yok.');
    }

    try {
        await admin.firestore().collection('public').doc('data').collection('admin').doc("message").set(
            { message: message, lastUpdated: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
        return { status: 'success', message: 'Yönetici mesajı başarıyla güncellendi.' };
    } catch (error) {
        console.error("Cloud Function 'updateAdminMessage' hatası:", error);
        throw new functions.https.HttpsError('internal', 'Mesaj güncellenirken bir hata oluştu.', error.message);
    }
});

// Admin Mesajını Okuma Fonksiyonu (HTTPS Callable - Herkese açık)
// Güvenlik: Herkesin okuyabilmesi için Firestore kurallarında buna izin verilmelidir.
exports.getAdminMessage = functions.https.onCall(async (data, context) => {
    try {
        const doc = await admin.firestore().collection('public').doc('data').collection('admin').doc("message").get();
        if (!doc.exists) {
            return { message: 'Yönetici mesajı bulunmamaktadır.' };
        }
        return { message: doc.data().message };
    } catch (error) {
        console.error("Cloud Function 'getAdminMessage' hatası:", error);
        throw new functions.https.HttpsError('internal', 'Yönetici mesajı okunurken bir hata oluştu.', error.message);
    }
});

// Hoş Geldin E-postası Gönderme Fonksiyonu (HTTPS Callable - Simülasyon)
// Gerçek bir uygulamada, SendGrid/Mailgun gibi bir e-posta servis entegrasyonu gereklidir.
exports.sendWelcomeEmail = functions.https.onCall(async (data, context) => {
    // E-posta gönderimi genellikle bir Firebase Auth Trigger ile tetiklenir
    // veya özel durumlarda bir kullanıcı tarafından çağrılır.
    // Kullanıcının kimliği doğrulanmış olması gerekebilir (iş modelinize bağlı).
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.');
    // }

    const { email, username, imageUrl, subject } = data; // imageUrl ve subject eklendi

    if (!email || !username) {
        throw new functions.https.HttpsError('invalid-argument', 'E-posta ve kullanıcı adı gereklidir.');
    }

    console.log(`Cloud Function Simülasyonu: E-posta gönderiliyor: ${email}, kullanıcı: ${username}, Konu: ${subject || 'Hoş Geldiniz!'}`);
    if (imageUrl) {
        console.log(`Ekli görsel URL: ${imageUrl}`);
    }
    // await sendEmailWithSendGrid(email, subject || "Hoş Geldiniz!", `Merhaba ${username}, ...`, imageUrl); // <-- Gerçek entegrasyon buraya gelecek
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simülasyon gecikmesi

    return { status: 'success', message: 'E-posta gönderildi (simülasyon).' };
});

// İletişim Formu Gönderimi Fonksiyonu (HTTPS Callable - Simülasyon)
// Dosya yükleme için Firebase Storage ve e-posta gönderme için SendGrid/Mailgun entegrasyonu gereklidir.
exports.submitContactForm = functions.https.onCall(async (data, context) => {
    // Kimlik doğrulaması kontrolü (isteğe bağlı, anonim gönderimlere izin verilebilir)
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    // }

    const { subject, email, message, fileName, fileType, fileData } = data;

    if (!subject || !email || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'Konu, e-posta ve mesaj boş olamaz.');
    }

    let fileUrl = null;
    if (fileName && fileType && fileData) {
        // ### DİKKAT: Gerçek dosya yükleme mantığı buraya gelecek ###
        // Dosyayı Firebase Storage'a yükleyin ve URL'sini alın.
        // Örneğin:
        // const bucket = admin.storage().bucket();
        // const fileRef = bucket.file(`contact_uploads/${context.auth?.uid || 'anon'}/${Date.now()}_${fileName}`);
        // await fileRef.save(Buffer.from(fileData, 'base64'), { metadata: { contentType: fileType } });
        // fileUrl = (await fileRef.getSignedUrl({ action: 'read', expires: '03-09-2491' }))[0];

        console.log(`Cloud Function Simülasyonu: Dosya yükleniyor: ${fileName}`);
        fileUrl = `https://example.com/your-storage-bucket/contact_uploads/${fileName}`; // Demo URL
        await new Promise(resolve => setTimeout(resolve, 500)); // Dosya yükleme simülasyonu
    }

    // ### DİKKAT: Gerçek e-posta gönderme mantığı buraya gelecek ###
    // E-posta gönderme servisi (SendGrid, Mailgun vb.) ile entegre edin.
    console.log(`Cloud Function Simülasyonu: İletişim e-postası gönderiliyor:
        Konu: ${subject}
        Kimden: ${email}
        Mesaj: ${message}
        Ekli Dosya URL: ${fileUrl || 'Yok'}
    `);
    await new Promise(resolve => setTimeout(resolve, 1000)); // E-posta gönderme simülasyonu

    return { status: 'success', message: 'Mesajınız başarıyla gönderildi (simülasyon).', fileUrl: fileUrl };
});