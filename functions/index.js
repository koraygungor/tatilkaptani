const functions = require("firebase-functions");

// CORS ekleyelim ki dışarıdan istek gelsin (opsiyonel ama önerilir)
const cors = require("cors")({ origin: true });

exports.callOpenRouterAIV1 = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // Sadece POST kabul ediliyor
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Sadece POST isteği kabul edilir." });
    }

    // JSON içindeki mesajı alıyoruz
    const message = req.body.message || "Mesaj yok";

    // Basit cevap
    return res.json({
      status: "success",
      receivedMessage: message,
      reply: `Sunucudan cevap: ${message}`
    });
  });
});
// NOT: Firebase SDK'ları HTML dosyasında <head> veya <body> etiketleri içinde yüklenmelidir.

// Sabitler
const IMAGE_DOWNLOAD_COST_PER_IMAGE = 50;
const VIRTUAL_TOUR_COST_PER_MINUTE = 10;
const VIP_PLAN_CHAT_COST = 10;

// Firebase yapılandırması - KENDİ BİLGİLERİNİZİ GİRİN!
// Bu bilgiler Firebase Console'dan alınmalıdır. Güvenli kabul edilir.
const firebaseConfig = {
    apiKey: "AIzaSyBpxneBV1JQQdyvhPqtt6OG_jl0WbyAMUU", // DEĞİŞTİRİN
    authDomain: "tatilkaptanifinal.firebaseapp.com", // DEĞİŞTİRİN
    projectId: "tatilkaptanifinal", // DEĞİŞTİRİN
    storageBucket: "tatilkaptanifinal.firebasestorage.app", // DEĞİŞTİRİN
    messagingSenderId: "748801975441", // DEĞİŞTİRİN
    appId: "1:748801975441:web:cc26b7b825fafe44658b30", // <-- BURADA VİRGÜL EKLENDİ!
    measurementId: "G-0BQJQ25XX1"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();
const functions = firebase.functions(); // Firebase Functions'ı başlat
const storage = firebase.storage(); // Firebase Storage'ı başlat (dosya yükleme için)

// Global Değişkenler
let currentUserId = null;
let voiceEnabled = true;
let tatilPuan = 0;
let userMembershipLevel = "Bronz";
let userName = "Misafir";
let userEmail = "Ayarlanmadı";
let gameActive = false;
let currentQuestionIndex = 0;
let gameScore = 0;
let currentGeneratedImages = []; // Son oluşturulan fotoğrafların URL'lerini tutmak için
let generatedVirtualImageUrl = ''; // Sanal tur hediye fotoğrafının URL'sini tutmak için
let currentVipPlan = ""; // VIP planını saklamak için
let palmCoinHistory = []; // PalmCoin geçmişi için dizi
let chatHistory = []; // Main chat history
let aiCompanion = null;
let companionChatHistory = []; // AI Yoldaş sohbet geçmişi

const sloganList = [
    "Hayalindeki tatili Palmiye Kaptan'la keşfet!",
    "Yapay zekâyla tatilin haritasını çiz!",
    "Palmiye Kaptan seni maceraya çağırıyor!",
    "TatilPuan kazan, üyelik seviyeni yükselt!",
    "Sanal ya da gerçek, her tatil özel!",
    "Yeni rotalar, yeni maceralar Palmiye Kaptan'la başlar!"
];
let currentSloganIndex = 0;
let currentGameQuestion = null; // Aktif soruyu ve cevabı tutar

// --- DOM Elementleri ---
// Header'daki login/register/logout butonları için tanımlar
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authButtons = document.getElementById('authButtons');
const loggedInUserSection = document.getElementById('loggedInUser');
const usernameDisplay = document.getElementById('usernameDisplay');

// Sohbet Asistanı
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("user-input-chat");
const sendChatBtn = document.getElementById("send-button-chat");
const chatLoading = document.getElementById("chat-loading");
const tatilpuanTop = document.getElementById("tatilpuan-top");
const sloganTop = document.getElementById("slogan-top");
const voiceToggleTop = document.getElementById("voice-toggle-top");
const languageSelect = document.getElementById("language-select");
const avatarEl = document.getElementById("avatar"); // Avatar elementi geri eklendi
const userIdDisplay = document.getElementById("user-id-display");
const sidebarButtons = document.querySelectorAll(".sidebar-nav button");
const contentSections = document.querySelectorAll(".content-section");

// Modallar
const appModal = document.getElementById("appModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalConfirmBtn = document.getElementById("modalConfirmBtn");

// Giriş/Kayıt Modalları
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const performLoginBtn = document.getElementById('performLoginBtn');
const loginMessage = document.getElementById('loginMessage');
const registerUsernameInput = document.getElementById('registerUsername');
const registerEmailInput = document.getElementById('registerEmail');
const registerPasswordInput = document.getElementById('registerPassword');
const performRegisterBtn = document.getElementById('performRegisterBtn');
const registerMessage = document.getElementById('registerMessage');
const resetEmailInput = document.getElementById('resetEmail');
const performResetBtn = document.getElementById('performResetBtn');
const resetMessage = document.getElementById('resetMessage');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const closeButtons = document.querySelectorAll('.close-button');

// Tatil Avı (Oyun)
const startGameBtn = document.getElementById("start-game-btn");
const gameOutput = document.getElementById("game-output");
const gameAnswerInput = document.getElementById("game-answer-input");
const submitGameAnswerBtn = document.getElementById("submit-game-answer-btn");

// Sanal Tatil Planı
const virtualCityInput = document.getElementById("virtual-city");
const virtualDaysInput = document.getElementById("virtual-days");
const virtualDurationMinutesInput = document.getElementById("virtual-duration-minutes");
const virtualActivitiesInput = document.getElementById("virtual-activities");
const virtualImagePromptInput = document.getElementById("virtual-image-prompt");
const virtualTourCostEl = document.getElementById("virtual-tour-cost");
const startVirtualBtn = document.getElementById("start-virtual-btn");
const virtualHolidayOutput = document.getElementById("virtual-holiday-output");
const virtualOutputTitle = document.getElementById("virtual-output-title");
const virtualOutputStory = document.getElementById("virtual-output-story");
const virtualImagesContainer = document.getElementById("virtual-images-container");
const sendVirtualImageEmailBtn = document.getElementById("send-virtual-image-email-btn");
const virtualLoading = document.getElementById("virtual-loading");

// AI Fotoğraf Stüdyosu
const aiPhotoAccessCheck = document.getElementById("ai-photo-access-check");
const goToAiPhotoPaymentBtn = document.getElementById("go-to-ai-photo-payment-btn");
const aiPhotoFormArea = document.getElementById("ai-photo-form-area");
const aiPhotoPromptInput = document.getElementById("ai-photo-prompt");
const aiPhotoStyleSelect = document.getElementById("ai-photo-style");
const aiPhotoCountInput = document.getElementById("ai-photo-count");
const generateAiPhotoButton = document.getElementById("generate-ai-photo-btn");
const aiPhotoLoading = document.getElementById("ai-photo-loading");
const aiPhotoOutput = document.getElementById("ai-photo-output");
const generatedImagesContainer = document.getElementById("generated-images-container");
const downloadAllImagesBtn = document.getElementById("download-all-images-btn");
const downloadAllCostSpan = document.getElementById("download-all-cost");

// VIP Planlayıcı
const vipAccessCheck = document.getElementById("vip-access-check");
const goToVipPaymentBtn = document.getElementById("go-to-vip-payment-btn");
const vipPlannerFormArea = document.getElementById("vip-planner-form-area");
const vipDestinationInput = document.getElementById("vip-destination");
const vipDurationInput = document.getElementById("vip-duration");
const vipTravelersInput = document.getElementById("vip-travelers");
const vipBudgetButtons = document.querySelectorAll("#vip-planner-section .budget-options button");
const vipTypeSelect = document.getElementById("vip-type");
const generateVipPlanBtn = document.getElementById("generate-vip-plan-btn");
const vipPlannerLoading = document.getElementById("vip-planner-loading");
const vipPlanOutput = document.getElementById("vip-plan-output");
let selectedBudget = "";
const vipPlanChatArea = document.getElementById("vip-plan-chat-area");
const vipPlanChatBox = document.getElementById("vip-plan-chat-box");
const vipPlanInput = document.getElementById("vip-plan-input");
const sendVipPlanMessageBtn = document.getElementById("send-vip-plan-message-btn");

// Niş Tur Talebi
const nicheTopicInput = document.getElementById("niche-topic");
const nicheDetailsTextarea = document.getElementById("niche-details");
const generateNichePlanBtn = document.getElementById("generate-niche-plan-btn");
const nichePlanLoading = document.getElementById("niche-plan-loading");
const nichePlanOutput = document.getElementById("niche-plan-output");

// Kullanıcı Bilgileri
const displayUserId = document.getElementById("display-userid");
const displayUsername = document.getElementById("display-username");
const displayUserEmail = document.getElementById("display-user-email");
const setuserEmailBtn = document.getElementById("set-user-email-btn");
const displayTatilpuan = document.getElementById("display-tatilpuan");
const displayMembershipLevel = document.getElementById("display-membership-level");
const displayGameScore = document.getElementById("display-game-score");
const updateUsernameBtn = document.getElementById("update-username-btn");
const palmCoinHistoryList = document.getElementById("palmcoin-history-list");

// Yönetici Mesajı
const adminMessageInput = document.getElementById("admin-message-input");
const updateAdminMessageBtn = document.getElementById("update-admin-message-btn");
const adminMessageLoading = document.getElementById("admin-message-loading");
const adminDisplayMessageEl = document.getElementById("admin-display-message");

// Zamanda Yolculuk
const timeTravelAccessCheck = document.getElementById("time-travel-access-check");
const goToTimeTravelPaymentBtn = document.getElementById("go-to-time-travel-payment-btn");
const timeTravelFormArea = document.getElementById("time-travel-form-area");
const timeTravelEraInput = document.getElementById("time-travel-era");
const timeTravelDurationInput = document.getElementById("time-travel-duration");
const timeTravelCharacterInput = document.getElementById("time-travel-character");
const timeTravelFocusInput = document.getElementById("time-travel-focus");
const startTimeTravelBtn = document.getElementById("start-time-travel-btn");
const timeTravelLoading = document.getElementById("time-travel-loading");
const timeTravelOutput = document.getElementById("time-travel-output");

// Kader Rotası
const destinyAgeInput = document.getElementById("destiny-age");
const destinyHobbyInput = document.getElementById("destiny-hobby");
const destinyDreamInput = document.getElementById("destiny-dream");
const destinyColorInput = document.getElementById("destiny-color");
const predictDestinyBtn = document.getElementById("predict-destiny-btn");
const destinyLoading = document.getElementById("destiny-loading");
const destinyRouteOutput = document.getElementById("destiny-route-output");
const realizeDestinyBtn = document.getElementById("realize-destiny-btn");

// AI Yoldaşım
const companionNameInput = document.getElementById("companion-name");
const companionPersonalitySelect = document.getElementById("companion-personality");
const createCompanionBtn = document.getElementById("create-companion-btn");
const companionChatArea = document.getElementById("companion-chat-area");
const activeCompanionName = document.getElementById("active-companion-name");
const companionChatBox = document.getElementById("companion-chat-box");
const companionInput = document.getElementById("companion-input");
const sendCompanionMessageBtn = document.getElementById("send-companion-message-btn");
const companionLoading = document.getElementById("companion-loading");

// Ödeme
const cardNumberInput = document.getElementById("card-number");
const expiryDateInput = document.getElementById("expiry-date");
const cvvInput = document.getElementById("cvv");
const cardHolderNameInput = document.getElementById("card-holder-name");
const completePaymentBtn = document.getElementById("complete-payment-btn");

// Bize Ulaşın Bölümü
const contactSubjectInput = document.getElementById('contact-subject');
const contactEmailInput = document.getElementById('contact-email');
const contactMessageInput = document.getElementById('contact-message');
const contactFileInput = document.getElementById('contact-file');
const sendContactFormBtn = document.getElementById('send-contact-form-btn');
const contactLoading = document.getElementById('contact-loading');


// --- Uygulama Başlangıcı ve Genel Fonksiyonlar ---
window.initializeAppFeatures = function() {
    // Slogan güncellemesi DOMContentLoaded içinde başlatılıyor, burada sadece bir işaretleyici olarak kaldı
};

// Modalları gizlemek için yardımcı fonksiyon
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = "none";
    }
}
window.hideModal = hideModal;

// --- Firebase Authentication ve Kullanıcı Durumu ---
auth.onAuthStateChanged(async (user) => {
    const mainLayout = document.querySelector('.main-layout');
    if (user) {
        currentUserId = user.uid;
        if (authButtons) authButtons.style.display = 'none';
        if (loggedInUserSection) loggedInUserSection.style.display = 'flex';
        if (usernameDisplay) usernameDisplay.textContent = user.displayName || user.email;
        if (mainLayout) {
            mainLayout.style.display = 'flex';
        }
        await loadUserProfile(); // Kullanıcı girişi sonrası profili yükle
        loadAdminMessage(); // Yönetici mesajını yükle
        // loadAds(); // Reklamlar şu anda statik, dinamik yükleme için bu fonksiyonu aktif edebilirsiniz
    } else {
        currentUserId = null;
        if (authButtons) authButtons.style.display = 'flex';
        if (loggedInUserSection) loggedInUserSection.style.display = 'none';
        // Kullanıcı bilgilerini sıfırla
        userName = "Misafir";
        tatilPuan = 0;
        userMembershipLevel = "Bronz";
        gameScore = 0;
        userEmail = "Ayarlanmadı";
        palmCoinHistory = [];
        displayMembershipInfo();
        updateTatilPuanDisplay();
        updatePalmCoinHistoryDisplay();
        if (userIdDisplay) userIdDisplay.textContent = `UID: ${currentUserId || 'Misafir'}`;
        if (mainLayout) {
            mainLayout.style.display = 'flex'; // Giriş yapılmasa bile ana düzeni göster (ücretsiz özellikler için)
        }
        // Açık tüm modalları kapat
        hideModal(loginModal);
        hideModal(registerModal);
        hideModal(forgotPasswordModal);
    }
});

// --- Firebase Kullanıcı Verileri Fonksiyonları ---
window.getUserProfileRef = function() {
    if (!firestore || !currentUserId) {
        console.warn("Firestore veya Kullanıcı ID'si hazır değil. Profil referansı alınamıyor.");
        return null;
    }
    return firestore.collection('users').doc(currentUserId);
};

window.loadUserProfile = async function() {
    const profileRef = window.getUserProfileRef();
    if (!profileRef) {
        console.log("Profil referansı mevcut değil, varsayılan bilgiler gösteriliyor.");
        window.displayMembershipInfo();
        window.updateTatilPuanDisplay();
        if (userIdDisplay) userIdDisplay.textContent = `UID: ${currentUserId || 'Misafir'}`;
        return;
    }

    profileRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
            const data = docSnap.data();
            userName = data.username || auth.currentUser.displayName || "Misafir";
            tatilPuan = data.tatilPuanlari || 0;
            userMembershipLevel = data.membershipLevel || "Bronz";
            gameScore = data.gameScore || 0;
            userEmail = data.email || auth.currentUser.email || "Ayarlanmadı";
            palmCoinHistory = data.palmCoinHistory || [{ timestamp: new Date().toISOString(), type: "Başlangıç", amount: 0, current: 0 }];
            console.log("Kullanıcı profili Firestore'dan yüklendi:", data);
        } else {
            console.log("Kullanıcı profili bulunamadı, varsayılan oluşturuluyor.");
            // Profil yoksa varsayılan profil oluştur. Bu ideal olarak kullanıcı kaydında gerçekleşmeli.
            // Sadece kullanıcı giriş yapmışsa oluştur.
            if (auth.currentUser) {
                window.updateUserProfile({
                    username: auth.currentUser.displayName || auth.currentUser.email,
                    email: auth.currentUser.email,
                    tatilPuanlari: 0,
                    membershipLevel: "Bronz",
                    gameScore: 0,
                    palmCoinHistory: [{ timestamp: new Date().toISOString(), type: "Başlangıç", amount: 0, current: 0 }]
                });
            }
        }
        window.displayMembershipInfo();
        window.updateTatilPuanDisplay();
        window.updatePalmCoinHistoryDisplay();
        if (userIdDisplay) userIdDisplay.textContent = `UID: ${currentUserId || 'Misafir'}`;
    }, (error) => {
        console.error("Kullanıcı profili yüklenirken hata:", error);
        window.showModal("Hata", `Kullanıcı verileri yüklenirken bir sorun oluştu: ${error.message}.`);
    });
};

window.updateUserProfile = async function(dataToUpdate) {
    const profileRef = window.getUserProfileRef();
    if (!profileRef) {
        console.error("Profil referansı mevcut değil, güncelleme yapılamıyor.");
        return;
    }
    try {
        await profileRef.set(dataToUpdate, { merge: true });
        console.log("Kullanıcı profili güncellendi:", dataToUpdate);
    } catch (error) {
        console.error("Kullanıcı profili güncellenirken hata:", error);
        window.showModal("Hata", `Kullanıcı verileri kaydedilirken bir sorun oluştu: ${error.message}.`);
    }
};

// --- Firebase İlan ve Yönetici Mesajı Yönetimi Fonksiyonları ---
// Not: Bu fonksiyonlar doğrudan istemciden çağrılmaz. Cloud Functions'ta bulunur.
// Sadece referans amaçlı burada bırakılmıştır.
// window.getAdsCollectionRef = function() { /* ... */ };
// window.getAdminMessageRef = function() { /* ... */ };

window.loadAds = async function() {
    // Dinamik reklamları Firestore'dan yükleme kodunuz buraya gelebilir.
    // Şimdilik HTML'deki statik reklamları gösteriyoruz.
    // const adsCollectionRef = window.getAdsCollectionRef();
    // if (!adsCollectionRef) {
    //     console.log("Reklam koleksiyonu referansı mevcut değil.");
    //     return;
    // }
    // try {
    //     const snapshot = await adsCollectionRef.get();
    //     const ads = snapshot.docs.map(doc => doc.data());
    //     const dynamicAdsContainer = document.getElementById('dynamic-ads-container');
    //     if (dynamicAdsContainer) {
    //         dynamicAdsContainer.innerHTML = ''; // Statik reklamları temizle
    //         ads.forEach(ad => {
    //             const adElement = document.createElement('a');
    //             adElement.href = ad.url;
    //             adElement.target = '_blank';
    //             adElement.classList.add('ad-area-dynamic');
    //             adElement.innerHTML = `<img src="${ad.imageUrl}" alt="${ad.title}"><p>${ad.text}</p>`;
    //             dynamicAdsContainer.appendChild(adElement);
    //         });
    //     }
    // } catch (error) {
    //     console.error("Dinamik reklamlar yüklenirken hata:", error);
    // }
};

// Yönetici Mesajını Yükleme (Artık Firebase Cloud Function üzerinden çağrılıyor)
window.loadAdminMessage = async function() {
    if (!adminDisplayMessageEl || !adminDisplayMessageEl.querySelector('p')) {
        console.error("Yönetici mesajı görüntüleme elementi bulunamadı.");
        return;
    }

    try {
        // Firebase Cloud Function'ı çağır
        const getAdminMessageCallable = functions.httpsCallable('getAdminMessage');
        const result = await getAdminMessageCallable();
        
        adminDisplayMessageEl.querySelector('p').textContent = result.data.message || "Yönetici mesajı bulunmamaktadır.";
    } catch (error) {
        console.error("Yönetici mesajı yüklenirken hata:", error);
        let errorMessage = `Yönetici mesajı yüklenemedi: ${error.message}.`;
        adminDisplayMessageEl.querySelector('p').textContent = errorMessage;
    }
};

// Yönetici Mesajını Güncelleme (Artık Firebase Cloud Function üzerinden çağrılıyor)
window.updateAdminMessage = async function(message) {
    const adminMessageLoadingEl = document.getElementById("admin-message-loading");
    if (adminMessageLoadingEl) adminMessageLoadingEl.style.display = 'block';

    try {
        // HTTPS Callable fonksiyonunu çağır
        const updateAdminMessageCallable = functions.httpsCallable('updateAdminMessage');
        const result = await updateAdminMessageCallable({ message: message });
        
        console.log("Yönetici mesajı başarıyla güncellendi (Backend ile):", result.data.message);
        window.showModal("Başarılı", result.data.message);
    } catch (error) {
        console.error("Yönetici mesajı güncellenirken hata:", error);
        let errorMessage = `Yönetici mesajı güncellenirken bir sorun oluştu: ${error.message}.`;
        // Yetki hatası özel mesajı
        if (error.code === 'permission-denied') {
            errorMessage = "Bu işlemi yapmaya yetkiniz yok. Yönetici izni gereklidir.";
        } else if (error.code === 'unauthenticated') {
            errorMessage = "Giriş yapmanız gerekiyor. Yönetici mesajını güncellemek için.";
        }
        window.showModal("Hata", errorMessage);
    } finally {
        if (adminMessageLoadingEl) adminMessageLoadingEl.style.display = 'none';
    }
};

// --- Genel UI ve Yardımcı Fonksiyonlar ---
window.showModal = function(title, message) {
    const modal = document.getElementById("appModal");
    const modalTitleEl = document.getElementById("modalTitle");
    const modalMessageEl = document.getElementById("modalMessage");
    const modalConfirmBtnEl = document.getElementById("modalConfirmBtn");

    if (!modal || !modalTitleEl || !modalMessageEl || !modalConfirmBtnEl) {
        console.error("Modal elementleri bulunamadı. Modal gösterilemiyor.");
        return Promise.resolve(false);
    }

    modalTitleEl.textContent = title;
    modalMessageEl.innerHTML = message;
    modal.style.display = "flex";

    const oldConfirmListener = modalConfirmBtnEl._eventListener;
    if (oldConfirmListener) {
        modalConfirmBtnEl.removeEventListener("click", oldConfirmListener);
    }

    return new Promise((resolve) => {
        const handleConfirm = () => {
            modal.style.display = "none";
            modalConfirmBtnEl.removeEventListener("click", handleConfirm);
            modalConfirmBtnEl._eventListener = null;
            resolve(true);
        };
        modalConfirmBtnEl.addEventListener("click", handleConfirm);
        modalConfirmBtnEl._eventListener = handleConfirm;
    });
};

window.displayMessage = function(sender, text, chatBoxElement = chatBox) {
    if (!chatBoxElement) {
        console.error("Sohbet kutusu elementi bulunamadı.");
        return;
    }
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);
    const span = document.createElement('span');
    span.textContent = text;
    messageDiv.appendChild(span);
    chatBoxElement.appendChild(messageDiv);
    chatBoxElement.scrollTop = chatBoxElement.scrollHeight;
};

window.speak = function(text) {
    const languageSelectEl = document.getElementById("language-select");
    if (!languageSelectEl || !voiceEnabled || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageSelectEl.value + "-" + languageSelectEl.value.toUpperCase();
    speechSynthesis.speak(utterance);
};

window.updateTatilPuan = async function(points, activity = "Genel Aktivite") {
    tatilPuan += points;
    palmCoinHistory.push({
        timestamp: new Date().toISOString(),
        type: points > 0 ? "Kazanıldı" : "Harcandı",
        activity: activity,
        amount: Math.abs(points),
        current: tatilPuan
    });

    if (palmCoinHistory.length > 20) {
        palmCoinHistory = palmCoinHistory.slice(palmCoinHistory.length - 20);
    }

    const oldLevel = userMembershipLevel;
    if (tatilPuan < 100) {
        userMembershipLevel = "Bronz";
    } else if (tatilPuan < 200) {
        userMembershipLevel = "Gümüş";
    } else {
        userMembershipLevel = "Altın";
    }

    if (currentUserId) {
        await window.updateUserProfile({
            tatilPuanlari: tatilPuan,
            membershipLevel: userMembershipLevel,
            palmCoinHistory: palmCoinHistory,
            gameScore: gameScore
        });
    }

    if (oldLevel !== userMembershipLevel) {
        window.showModal("Tebrikler!", `Üyelik seviyeniz **${userMembershipLevel}** seviyesine yükseldi! Yeni özelliklere göz atın.`);
        window.speak(`Tebrikler! Üyelik seviyeniz ${userMembershipLevel} seviyesine yükseldi!`);
    }
    window.updatePalmCoinHistoryDisplay();
    window.updateTatilPuanDisplay();
};

window.updateTatilPuanDisplay = function() {
    if (tatilpuanTop) {
        tatilpuanTop.innerHTML = `<i class="fas fa-star"></i> TatilPuan: ${tatilPuan} (${userMembershipLevel})`;
    }
    if (displayTatilpuan) displayTatilpuan.textContent = tatilPuan;
    if (displayMembershipLevel) displayMembershipLevel.textContent = userMembershipLevel;
};

window.displayMembershipInfo = function() {
    if (displayUserId) displayUserId.textContent = currentUserId || "Yükleniyor...";
    if (displayUsername) displayUsername.textContent = userName;
    if (displayUserEmail) displayUserEmail.textContent = userEmail;
    if (displayTatilpuan) displayTatilpuan.textContent = tatilPuan;
    if (displayMembershipLevel) displayMembershipLevel.textContent = userMembershipLevel;
    if (displayGameScore) displayGameScore.textContent = gameScore;
    if (userIdDisplay) userIdDisplay.textContent = `UID: ${currentUserId || 'Misafir'}`;
};

window.updatePalmCoinHistoryDisplay = function() {
    if (!palmCoinHistoryList) return;
    palmCoinHistoryList.innerHTML = '';
    palmCoinHistory.slice().reverse().forEach(entry => {
        const listItem = document.createElement("li");
        const date = new Date(entry.timestamp).toLocaleString();
        let color = '#333';
        if (entry.type === "Kazanıldı") {
            color = 'green';
        } else if (entry.type === "Harcandı") {
            color = 'red';
        }
        listItem.innerHTML = `<span style="color:${color};"><strong>${entry.type}:</strong> ${entry.amount} PalmCoin</span> - ${entry.activity} (${date}) - Toplam: ${entry.current}`;
        palmCoinHistoryList.appendChild(listItem);
    });
};

window.showSection = function(sectionId) {
    contentSections.forEach(section => {
        section.classList.remove("active");
        section.style.display = "none";
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add("active");
        activeSection.style.display = "flex";
    }

    sidebarButtons.forEach(button => button.classList.remove("active"));
    const activeButton = document.querySelector(`.sidebar-nav button[data-section='${sectionId}']`);
    if (activeButton) {
        activeButton.classList.add("active");
    }

    if (sectionId === "vip-planner-section") {
        window.checkVipAccess(document.getElementById("vip-access-check"), document.getElementById("vip-planner-form-area"), "Altın");
        window.checkVipAccess(document.getElementById("vip-access-check"), document.getElementById("niche-vip-request-area"), "Altın");
        if (vipPlanChatArea) vipPlanChatArea.style.display = 'none';
        if (vipPlanOutput) vipPlanOutput.style.display = 'none';
        currentVipPlan = "";
    } else if (sectionId === "time-travel-section") {
        window.checkVipAccess(document.getElementById("time-travel-access-check"), document.getElementById("time-travel-form-area"), "Altın");
    } else if (sectionId === "ai-photo-studio-section") {
        window.checkVipAccess(document.getElementById("ai-photo-access-check"), document.getElementById("ai-photo-form-area"), "Altın");
        if (generatedImagesContainer) generatedImagesContainer.innerHTML = '';
        if (downloadAllImagesBtn) downloadAllImagesBtn.style.display = 'none';
        if (aiPhotoOutput) aiPhotoOutput.style.display = 'none';
        currentGeneratedImages = [];
    } else if (sectionId === "user-info-section") {
        window.displayMembershipInfo();
        window.loadAdminMessage();
        window.updatePalmCoinHistoryDisplay();
    } else if (sectionId === "payment-section") {
        if (cardNumberInput) cardNumberInput.value = '';
        if (expiryDateInput) expiryDateInput.value = '';
        if (cvvInput) cvvInput.value = '';
        if (cardHolderNameInput) cardHolderNameInput.value = '';
    } else if (sectionId === "virtual-holiday-section") {
        if (virtualDurationMinutesInput && virtualTourCostEl) {
            virtualTourCostEl.textContent = (parseInt(virtualDurationMinutesInput.value) * VIRTUAL_TOUR_COST_PER_MINUTE);
        }
        if (virtualHolidayOutput) virtualHolidayOutput.style.display = "none";
        if (virtualImagesContainer) virtualImagesContainer.innerHTML = '';
        if (sendVirtualImageEmailBtn) sendVirtualImageEmailBtn.style.display = 'none';
        generatedVirtualImageUrl = '';
    } else if (sectionId === "destiny-route-section") {
        if (destinyRouteOutput) destinyRouteOutput.style.display = "none";
        if (realizeDestinyBtn) realizeDestinyBtn.style.display = "none";
    }
    if (sectionId === "contact-us-section") {
        if (contactSubjectInput) contactSubjectInput.value = '';
        if (contactEmailInput) contactEmailInput.value = userEmail !== "Ayarlanmadı" ? userEmail : '';
        if (contactMessageInput) contactMessageInput.value = '';
        if (contactFileInput) contactFileInput.value = '';
    }
};

window.checkVipAccess = function(accessCheckEl, formAreaEl, requiredLevel) {
    const levels = ["Bronz", "Gümüş", "Altın"];
    const currentUserLevelIndex = levels.indexOf(userMembershipLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);

    if (currentUserLevelIndex >= requiredLevelIndex) {
        if (accessCheckEl) accessCheckEl.style.display = "none";
        if (formAreaEl) formAreaEl.style.display = "block";
    } else {
        if (accessCheckEl) accessCheckEl.style.display = "block";
        if (formAreaEl) formAreaEl.style.display = "none";
    }
};

// OpenRouter AI Çağrısı (Artık backend fonksiyonu üzerinden HTTPS Callable ile)
window.callOpenRouterAI = async function(prompt, model = "openai/gpt-3.5-turbo", loadingIndicator = null, currentChatHistory = []) {
    if (loadingIndicator