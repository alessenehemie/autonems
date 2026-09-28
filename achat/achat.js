/* ============================================================
   AUTONEMS — achat.js
   Affiche la fiche du véhicule, puis ouvre un petit formulaire
   de finalisation (nom, téléphone, mode de paiement) quand le
   client clique sur "Acheter". Le bouton reste bloqué tant que
   les informations ne sont pas valides.
   ============================================================ */

const PHONE_NUMBER = "2250769583494";

let CAR_PRICE = "";
let CAR_NAME = "";

/* ---------- État de validation par champ ---------- */
const validState = { fullName: false, userPhone: false, paymentMethod: false };

function setFieldError(inputEl, errorEl, message) {
    inputEl.classList.add('invalid');
    inputEl.classList.remove('valid');
    errorEl.textContent = message;
    errorEl.hidden = false;
    inputEl.classList.add('shake');
    setTimeout(() => inputEl.classList.remove('shake'), 400);
}
function setFieldValid(inputEl, errorEl) {
    inputEl.classList.remove('invalid');
    inputEl.classList.add('valid');
    errorEl.hidden = true;
}

function validateFullName() {
    const el = document.getElementById('fullName');
    const errorEl = document.getElementById('fullNameError');
    const result = AutoNemsValidation.validateName(el.value);
    if (result.empty) { el.classList.remove('invalid', 'valid'); errorEl.hidden = true; validState.fullName = false; return; }
    if (!result.valid) { setFieldError(el, errorEl, result.message); validState.fullName = false; return; }
    setFieldValid(el, errorEl); validState.fullName = true;
}

function validatePhone() {
    const el = document.getElementById('userPhone');
    const errorEl = document.getElementById('userPhoneError');
    const result = AutoNemsValidation.validatePhone(el.value);
    if (result.empty) { el.classList.remove('invalid', 'valid'); errorEl.hidden = true; validState.userPhone = false; return; }
    if (!result.valid) { setFieldError(el, errorEl, result.message); validState.userPhone = false; return; }
    setFieldValid(el, errorEl); validState.userPhone = true;
}

function validatePayment() {
    const el = document.getElementById('paymentMethod');
    const errorEl = document.getElementById('paymentMethodError');
    if (!el.value) { errorEl.hidden = true; el.classList.remove('invalid', 'valid'); validState.paymentMethod = false; return; }
    setFieldValid(el, errorEl); validState.paymentMethod = true;
}

function refreshSubmitState() {
    const allValid = Object.values(validState).every(Boolean);
    const btn = document.getElementById('submitBtn');
    btn.disabled = !allValid;
    btn.classList.toggle('btn-ready', allValid);
}

/* ---------- Modal de finalisation ---------- */
const achatModal = document.getElementById('achatModal');
function openAchatModal() {
    document.getElementById('achatCarSummary').textContent = `${CAR_NAME}${CAR_PRICE ? ' — ' + CAR_PRICE : ''}`;
    achatModal.classList.add('open');
    document.body.classList.add('modal-open');
}
function closeAchatModal() {
    achatModal.classList.remove('open');
    document.body.classList.remove('modal-open');
}

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const carParam = urlParams.get('car');
    const imgParam = urlParams.get('img');
    const priceParam = urlParams.get('price');
    const anParam = urlParams.get('an');
    const kmParam = urlParams.get('km');

    CAR_NAME = carParam ? decodeURIComponent(carParam) : "Véhicule non spécifié";
    document.getElementById('carModel').textContent = CAR_NAME;

    const carPreviewImg = document.getElementById('carPreviewImg');
    if (imgParam) {
        const src = decodeURIComponent(imgParam);
        carPreviewImg.src = src.startsWith('http') ? src : '../' + src;
        carPreviewImg.style.display = 'block';
    } else {
        carPreviewImg.style.display = 'none';
    }

    const priceDisplay = document.getElementById('carPriceDisplay');
    if (priceParam) {
        CAR_PRICE = Number(priceParam).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + " FCFA";
        let detail = CAR_PRICE;
        if (anParam) detail += ` · ${anParam}`;
        if (kmParam) detail += ` · ${decodeURIComponent(kmParam)} km`;
        priceDisplay.textContent = detail;
    }

    document.getElementById('openAchatBtn').addEventListener('click', openAchatModal);
    document.getElementById('achatModalClose').addEventListener('click', closeAchatModal);
    document.getElementById('achatModalOverlay').addEventListener('click', closeAchatModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAchatModal(); });

    /* Validation en temps réel */
    const fullNameEl = document.getElementById('fullName');
    const phoneEl = document.getElementById('userPhone');
    const paymentEl = document.getElementById('paymentMethod');

    fullNameEl.addEventListener('input', () => { validateFullName(); refreshSubmitState(); });
    fullNameEl.addEventListener('blur', () => { validateFullName(); refreshSubmitState(); });
    phoneEl.addEventListener('input', () => { validatePhone(); refreshSubmitState(); });
    phoneEl.addEventListener('blur', () => { validatePhone(); refreshSubmitState(); });
    paymentEl.addEventListener('change', () => { validatePayment(); refreshSubmitState(); });

    refreshSubmitState();
    document.getElementById('purchaseForm').addEventListener('submit', sendPurchaseWhatsApp);
});

function sendPurchaseWhatsApp(event) {
    if (event) event.preventDefault();

    /* Re-validation complète au moment de la soumission (sécurité) */
    validateFullName();
    validatePhone();
    validatePayment();
    refreshSubmitState();

    if (!Object.values(validState).every(Boolean)) {
        const firstInvalid = document.querySelector('#purchaseForm .invalid') || document.querySelector('#fullName');
        if (firstInvalid) firstInvalid.focus();
        return;
    }

    const fullName = document.getElementById('fullName').value.trim();
    const userPhone = document.getElementById('userPhone').value.trim();
    const paymentMethod = document.getElementById('paymentMethod').value;

    const loader = document.getElementById('loaderModal');
    if (loader) loader.style.display = 'flex';

    let message = `Bonjour AutoNems, je souhaite finaliser l'achat du véhicule suivant :\n\n`;
    message += `Véhicule : ${CAR_NAME}\n`;
    if (CAR_PRICE) message += `Prix affiché : ${CAR_PRICE}\n`;
    message += `Nom : ${fullName}\n`;
    message += `Téléphone : ${userPhone}\n`;
    message += `Mode de paiement : ${paymentMethod}`;

    const whatsappUrl = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`;

    setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        if (loader) loader.style.display = 'none';
        closeAchatModal();
    }, 900);
}
