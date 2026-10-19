/* ============================================================
   AUTONEMS — achat.js
   Affiche la fiche du véhicule, puis ouvre un formulaire
   de finalisation avec la vérification des numéros et des photos 
   de la CNI et du Permis de Conduire.
   ============================================================ */

const PHONE_NUMBER = "2250769583494";

let CAR_PRICE = "";
let RAW_PRICE = ""; 
let CAR_NAME = "";

/* ---------- État de validation par champ ---------- */
const validState = { 
    fullName: false, 
    userPhone: false, 
    idCard: false,         
    idCardFile: false,     // État pour la photo de la CNI
    driverLicense: false,  
    driverLicenseFile: false, // État pour la photo du Permis
    paymentMethod: false 
};

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

function validateIdCard() {
    const el = document.getElementById('idCard');
    const errorEl = document.getElementById('idCardError');
    const value = el.value.trim();

    if (value === "") {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        validState.idCard = false;
        return;
    }
    if (value.length < 5) {
        setFieldError(el, errorEl, "Numéro de pièce d'identité trop court ou invalide.");
        validState.idCard = false;
        return;
    }
    setFieldValid(el, errorEl);
    validState.idCard = true;
}

/* ============================================================
   OCR (lecture des numéros sur les photos) — version améliorée
   - image préparée avant lecture (agrandie, niveaux de gris, contraste)
   - lecture de secours sur l'image d'origine si la 1re lecture ne correspond pas
   - comparaison tolérante aux confusions de lecture : O/0, I/L/1, Z/2, S/5, G/6, B/8
   - comparaison stricte : le numéro doit apparaître en entier et à l'identique (OCR_MAX_ERRORS = 0)
   - une seule lecture par photo (cache) + préchargement du moteur à l'ouverture du formulaire
   ============================================================ */
const OCR_MAX_ERRORS = 0; // 0 = numéro IDENTIQUE exigé sur la photo (mettre 1 pour tolérer une erreur de lecture)
const ocrCache = new WeakMap();
let ocrWorkerPromise = null;

function getOcrWorker() {
    if (!ocrWorkerPromise) {
        if (typeof Tesseract === 'undefined') return Promise.reject(new Error('OCR_UNAVAILABLE'));
        ocrWorkerPromise = Tesseract.createWorker('fra').catch(() => {
            ocrWorkerPromise = null;
            throw new Error('OCR_UNAVAILABLE');
        });
    }
    return ocrWorkerPromise;
}
// Télécharge le moteur de lecture dès l'ouverture du formulaire (pendant que le client remplit les champs)
function warmUpOcr() { getOcrWorker().catch(() => {}); }

function ocrErrorMessage(err) {
    return (err && err.message === 'OCR_UNAVAILABLE')
        ? "Vérification automatique indisponible : vérifiez votre connexion internet puis réessayez."
        : "Impossible de lire l'image. Veuillez choisir une photo plus nette.";
}
function isImageFile(file) { return !file.type || file.type.startsWith('image/'); }

async function prepareImageForOcr(file) {
    try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(3, Math.max(0.3, 2000 / Math.max(bmp.width, bmp.height)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const v = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
            d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(img, 0, 0);
        return canvas;
    } catch (e) {
        return file; // navigateur trop ancien : on lit l'image d'origine
    }
}

// pass 0 = image améliorée, pass 1 = image d'origine (résultat mis en cache pour chaque photo)
function ocrTextPass(file, pass) {
    let entry = ocrCache.get(file);
    if (!entry) { entry = {}; ocrCache.set(file, entry); }
    if (!entry[pass]) {
        entry[pass] = (async () => {
            const worker = await getOcrWorker();
            const source = pass === 0 ? await prepareImageForOcr(file) : file;
            const { data: { text } } = await worker.recognize(source);
            return text;
        })().catch(err => { delete entry[pass]; throw err; });
    }
    return entry[pass];
}

function normalizeOcr(str) {
    return String(str || '').toUpperCase()
        .replace(/[|!]/g, '1')
        .replace(/[^A-Z0-9]/g, '')
        .replace(/[OQ]/g, '0').replace(/[IL]/g, '1')
        .replace(/Z/g, '2').replace(/S/g, '5').replace(/G/g, '6').replace(/B/g, '8');
}

// Découpe le texte lu en "mots" (lettres/chiffres), chacun normalisé
function ocrTokens(text) {
    return String(text || '').toUpperCase().replace(/[|!]/g, '1')
        .split(/[^A-Z0-9]+/).filter(Boolean).map(normalizeOcr);
}

// Distance de Levenshtein (nombre de caractères différents entre deux textes)
function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

// Le numéro saisi apparaît-il sur la photo comme un numéro COMPLET et identique ?
// - il doit former un bloc entier (un numéro plus long qui le contient ne compte pas)
// - il peut être imprimé en plusieurs groupes ("C 0012 3456 78")
// - maxErrors = nombre de caractères mal lus tolérés (0 = identique exigé)
function containsNumberStrict(text, number, maxErrors) {
    const P = normalizeOcr(number);
    if (!P) return false;
    const tokens = ocrTokens(text);
    for (let i = 0; i < tokens.length; i++) {
        let joined = '';
        for (let k = i; k < tokens.length && k < i + 6; k++) {
            joined += tokens[k];
            if (joined.length > P.length + maxErrors) break;
            if (joined === P) return true;
            if (maxErrors > 0 && P.length >= 8 && editDistance(joined, P, maxErrors) <= maxErrors) return true;
        }
    }
    return false;
}

async function ocrMatchesNumber(file, number) {
    const first = await ocrTextPass(file, 0);
    if (containsNumberStrict(first, number, OCR_MAX_ERRORS)) return true;
    try {
        const second = await ocrTextPass(file, 1);
        return containsNumberStrict(second, number, OCR_MAX_ERRORS);
    } catch (e) {
        return false;
    }
}

/* ============================================================
   VÉRIFICATION DU NOM ET PRÉNOMS SUR LES PHOTOS (CNI et permis)
   Chaque mot du nom saisi doit se retrouver sur la photo du document.
   ============================================================ */
const OCR_NAME_MAX_ERRORS = 0; // 0 = chaque mot du nom doit être lu à l'identique (1 = une lettre mal lue tolérée pour les mots de 7 lettres ou plus)

// Mots imprimés sur les documents : ils ne peuvent pas servir de "nom"
const OCR_DOC_WORDS = ['REPUBLIQUE', 'COTE', 'IVOIRE', 'CARTE', 'NATIONALE', 'IDENTITE', 'PERMIS', 'CONDUIRE',
    'NOM', 'PRENOM', 'PRENOMS', 'NAISSANCE', 'DATE', 'LIEU', 'SEXE', 'TAILLE', 'SIGNATURE', 'VALABLE', 'EXPIRE',
    'CATEGORIE', 'DELIVRE', 'DELIVRANCE', 'NATIONALITE', 'PROFESSION', 'DOMICILE', 'ADRESSE', 'NUMERO',
    'TITULAIRE', 'MINISTERE', 'TRANSPORT', 'SECURITE', 'ROUTIERE'];

// Lettres seules, sans accents ni ponctuation, en majuscules
function nameClean(str) {
    return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
// Confusions de lecture courantes (chiffres lus à la place de lettres, I/L)
function canonName(w) {
    return w.replace(/0/g, 'O').replace(/1/g, 'I').replace(/2/g, 'Z').replace(/5/g, 'S')
            .replace(/6/g, 'G').replace(/8/g, 'B').replace(/Q/g, 'O').replace(/L/g, 'I');
}
// Mots du nom saisi (les initiales d'une seule lettre sont ignorées)
function nameWords(fullName) {
    return String(fullName || '').split(/\s+/).map(w => canonName(nameClean(w))).filter(w => w.length >= 2);
}
// Mots lus sur la photo
function nameTokens(text) {
    return String(text || '').split(/[\s:;,.|_\/\\()]+/).map(w => canonName(nameClean(w))).filter(Boolean);
}
function nameWordInTokens(word, tokens, maxErrors) {
    for (let i = 0; i < tokens.length; i++) {
        let joined = '';
        for (let k = i; k < tokens.length && k < i + 3; k++) { // un nom composé peut être imprimé en 2 ou 3 mots
            joined += tokens[k];
            if (joined.length > word.length + maxErrors) break;
            if (joined === word) return true;
            if (maxErrors > 0 && word.length >= 7 && editDistance(joined, word, maxErrors) <= maxErrors) return true;
        }
    }
    return false;
}
function containsAllNameWords(text, fullName, maxErrors) {
    const words = nameWords(fullName);
    if (words.length === 0) return false;
    const docWords = OCR_DOC_WORDS.map(canonName);
    if (words.some(w => docWords.includes(w))) return false; // "République", "Permis"... ne sont pas des noms
    const tokens = nameTokens(text);
    return words.every(w => nameWordInTokens(w, tokens, maxErrors));
}
async function ocrMatchesName(file, fullName) {
    const first = await ocrTextPass(file, 0);
    if (containsAllNameWords(first, fullName, OCR_NAME_MAX_ERRORS)) return true;
    try {
        const second = await ocrTextPass(file, 1);
        return containsAllNameWords(second, fullName, OCR_NAME_MAX_ERRORS);
    } catch (e) {
        return false;
    }
}

// Le numéro de l'AUTRE document apparaît-il sur cette photo ? (1re lecture seulement, comparaison exacte)
async function ocrFirstPassContains(file, number) {
    if (!normalizeOcr(number)) return false;
    try { return containsNumberStrict(await ocrTextPass(file, 0), number, 0); } catch (e) { return false; }
}

// Empreinte d'une photo (SHA-256 du contenu) pour détecter la même image envoyée deux fois
const fingerprintCache = new WeakMap();
function fileFingerprint(file) {
    if (!fingerprintCache.has(file)) {
        fingerprintCache.set(file, (async () => {
            try {
                if (window.crypto && crypto.subtle) {
                    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
                    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
                }
            } catch (e) { /* on retombe sur nom + taille + date */ }
            return file.name + '|' + file.size + '|' + file.lastModified;
        })());
    }
    return fingerprintCache.get(file);
}

// Contrôles croisés CNI / permis : deux photos différentes, et chaque photo ne contient pas le numéro de l'autre document
async function crossCheckDocuments(kind) {
    const idFile  = document.getElementById('idCardFile').files[0];
    const licFile = document.getElementById('driverLicenseFile').files[0];
    const idNum   = document.getElementById('idCard').value;
    const licNum  = document.getElementById('driverLicense').value;

    if (idFile && licFile) {
        const [a, b] = await Promise.all([fileFingerprint(idFile), fileFingerprint(licFile)]);
        if (a === b) return "La photo de la CNI et celle du permis sont identiques : envoyez deux documents différents.";
    }

    const ownNum   = kind === 'identity' ? idNum : licNum;
    const otherNum = kind === 'identity' ? licNum : idNum;
    const file     = kind === 'identity' ? idFile : licFile;
    if (file && normalizeOcr(otherNum) && normalizeOcr(otherNum) !== normalizeOcr(ownNum)) {
        if (await ocrFirstPassContains(file, otherNum)) {
            return kind === 'identity'
                ? "Cette photo contient le numéro du permis de conduire : envoyez la photo de votre CNI."
                : "Cette photo contient le numéro de la CNI : envoyez la photo de votre permis de conduire.";
        }
    }
    return null;
}

/* ---------- VALIDATION DE LA PHOTO DE LA CNI AVEC TESSERACT.JS ---------- */
async function validateIdCardFile() {
    const el = document.getElementById('idCardFile');
    const errorEl = document.getElementById('idCardFileError');
    const textEl = document.getElementById('idCard');

    if (el.files.length === 0) {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        validState.idCardFile = false;
        refreshSubmitState();
        return;
    }

    if (textEl.value.trim() === "") {
        setFieldError(el, errorEl, "Veuillez d'abord saisir le numéro de CNI textuel.");
        validState.idCardFile = false;
        refreshSubmitState();
        return;
    }

    if (document.getElementById('fullName').value.trim() === "") {
        setFieldError(el, errorEl, "Veuillez d'abord saisir votre nom et prénoms.");
        validState.idCardFile = false;
        refreshSubmitState();
        return;
    }

    if (!isImageFile(el.files[0])) {
        setFieldError(el, errorEl, "Format non pris en charge : envoyez une photo (JPG ou PNG), pas un PDF.");
        validState.idCardFile = false;
        refreshSubmitState();
        return;
    }

    // Affichage d'un message d'attente pendant l'analyse OCR
    errorEl.hidden = false;
    errorEl.textContent = "Analyse automatique de la photo en cours...";
    el.classList.remove('valid', 'invalid');

    try {
        // Lancement de Tesseract en arrière-plan sur l'image sélectionnée
        const file = el.files[0];
        // Vérification si le numéro saisi correspond au texte détecté sur l'image (lecture tolérante)
        const matches = await ocrMatchesNumber(file, textEl.value);
        if (matches) {
            const crossError = await crossCheckDocuments('identity');
            if (crossError) {
                setFieldError(el, errorEl, crossError);
                validState.idCardFile = false;
            } else {
                const nameOk = await ocrMatchesName(file, document.getElementById('fullName').value);
                if (nameOk) {
                    setFieldValid(el, errorEl);
                    validState.idCardFile = true;
                } else {
                    setFieldError(el, errorEl, "Le nom et prénoms saisis ne correspondent pas à ceux de la carte d'identité.");
                    validState.idCardFile = false;
                }
            }
        } else {
            setFieldError(el, errorEl, "Le numéro sur la photo ne correspond pas au numéro de CNI saisi !");
            validState.idCardFile = false;
        }
    } catch (err) {
        console.error("Erreur OCR :", err);
        setFieldError(el, errorEl, ocrErrorMessage(err));
        validState.idCardFile = false;
    }

    refreshSubmitState();
}

function validateDriverLicense() {
    const el = document.getElementById('driverLicense');
    const errorEl = document.getElementById('driverLicenseError');
    const value = el.value.trim();

    if (value === "") {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        validState.driverLicense = false;
        return;
    }
    if (value.length < 5) {
        setFieldError(el, errorEl, "Numéro de permis de conduire invalide.");
        validState.driverLicense = false;
        return;
    }
    const idNorm = normalizeOcr(document.getElementById('idCard').value);
    if (idNorm && idNorm === normalizeOcr(value)) {
        setFieldError(el, errorEl, "Le numéro de permis doit être différent du numéro de CNI.");
        validState.driverLicense = false;
        return;
    }
    setFieldValid(el, errorEl);
    validState.driverLicense = true;
}

/* ---------- VALIDATION DE LA PHOTO DU PERMIS AVEC TESSERACT.JS ---------- */
let licenseFileCheckId = 0;
async function validateDriverLicenseFile() {
    const el = document.getElementById('driverLicenseFile');
    const errorEl = document.getElementById('driverLicenseFileError');
    const textEl = document.getElementById('driverLicense');
    const myCheck = ++licenseFileCheckId;

    if (el.files.length === 0) {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        validState.driverLicenseFile = false;
        refreshSubmitState();
        return;
    }

    if (textEl.value.trim() === "") {
        setFieldError(el, errorEl, "Veuillez d'abord saisir le numéro de permis textuel.");
        validState.driverLicenseFile = false;
        refreshSubmitState();
        return;
    }

    if (document.getElementById('fullName').value.trim() === "") {
        setFieldError(el, errorEl, "Veuillez d'abord saisir votre nom et prénoms.");
        validState.driverLicenseFile = false;
        refreshSubmitState();
        return;
    }

    if (!isImageFile(el.files[0])) {
        setFieldError(el, errorEl, "Format non pris en charge : envoyez une photo (JPG ou PNG), pas un PDF.");
        validState.driverLicenseFile = false;
        refreshSubmitState();
        return;
    }

    // Message d'attente pendant l'analyse OCR (le bouton reste bloqué)
    errorEl.hidden = false;
    errorEl.textContent = "Analyse automatique de la photo du permis en cours...";
    el.classList.remove('valid', 'invalid');
    validState.driverLicenseFile = false;
    refreshSubmitState();

    try {
        const matches = await ocrMatchesNumber(el.files[0], textEl.value);
        if (myCheck !== licenseFileCheckId) return; // résultat périmé (nouvelle saisie entre-temps)

        if (matches) {
            const crossError = await crossCheckDocuments('license');
            if (myCheck !== licenseFileCheckId) return;
            if (crossError) {
                setFieldError(el, errorEl, crossError);
                validState.driverLicenseFile = false;
            } else {
                const nameOk = await ocrMatchesName(el.files[0], document.getElementById('fullName').value);
                if (myCheck !== licenseFileCheckId) return;
                if (nameOk) {
                    setFieldValid(el, errorEl);
                    validState.driverLicenseFile = true;
                } else {
                    setFieldError(el, errorEl, "Le nom et prénoms saisis ne correspondent pas à ceux du permis de conduire.");
                    validState.driverLicenseFile = false;
                }
            }
        } else {
            setFieldError(el, errorEl, "Le numéro sur la photo du permis ne correspond pas au numéro saisi !");
            validState.driverLicenseFile = false;
        }
    } catch (err) {
        if (myCheck !== licenseFileCheckId) return;
        console.error("Erreur OCR permis :", err);
        setFieldError(el, errorEl, ocrErrorMessage(err));
        validState.driverLicenseFile = false;
    }

    refreshSubmitState();
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
    if (btn) {
        btn.disabled = !allValid;
        btn.classList.toggle('btn-ready', allValid);
    }
}

/* ---------- Modal de finalisation ---------- */
const achatModal = document.getElementById('achatModal');
function openAchatModal() {
    warmUpOcr(); // précharge le moteur de lecture des photos pendant que le client remplit le formulaire
    const summary = document.getElementById('achatCarSummary');
    if (summary) {
        summary.textContent = `${CAR_NAME}${CAR_PRICE ? ' — ' + CAR_PRICE : ''}`;
    }
    if (achatModal) {
        achatModal.classList.add('open');
        document.body.classList.add('modal-open');
    }
}
function closeAchatModal() {
    if (achatModal) {
        achatModal.classList.remove('open');
        document.body.classList.remove('modal-open');
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const carParam = urlParams.get('car');
    const imgParam = urlParams.get('img');
    const priceParam = urlParams.get('price');
    const anParam = urlParams.get('an');
    const kmParam = urlParams.get('km');

    CAR_NAME = carParam ? decodeURIComponent(carParam) : "Véhicule non spécifié";
    const carModelEl = document.getElementById('carModel');
    if (carModelEl) carModelEl.textContent = CAR_NAME;

    const carPreviewImg = document.getElementById('carPreviewImg');
    if (carPreviewImg) {
        if (imgParam) {
            const src = decodeURIComponent(imgParam);
            carPreviewImg.src = src.startsWith('http') ? src : '../' + src;
            carPreviewImg.style.display = 'block';
        } else {
            carPreviewImg.style.display = 'none';
        }
    }

    const priceDisplay = document.getElementById('carPriceDisplay');
    if (priceParam && priceDisplay) {
        RAW_PRICE = priceParam; 
        CAR_PRICE = Number(priceParam).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + " FCFA";
        let detail = CAR_PRICE;
        if (anParam) detail += ` · ${anParam}`;
        if (kmParam) detail += ` · ${decodeURIComponent(kmParam)} km`;
        priceDisplay.textContent = detail;
    }

    // Gestion de l'ouverture de la modale au clic sur le bouton principal de la page
    const openBtn = document.getElementById('openAchatBtn');
    if (openBtn) {
        openBtn.addEventListener('click', openAchatModal);
    }

    const modalClose = document.getElementById('achatModalClose');
    if (modalClose) modalClose.addEventListener('click', closeAchatModal);

    const modalOverlay = document.getElementById('achatModalOverlay');
    if (modalOverlay) modalOverlay.addEventListener('click', closeAchatModal);

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAchatModal(); });

    /* Écouteurs d'événements pour les champs de texte et les fichiers */
    const fullNameEl = document.getElementById('fullName');
    const phoneEl = document.getElementById('userPhone');
    const idCardEl = document.getElementById('idCard');
    const idCardFileEl = document.getElementById('idCardFile');
    const licenseEl = document.getElementById('driverLicense');
    const licenseFileEl = document.getElementById('driverLicenseFile');
    const paymentEl = document.getElementById('paymentMethod');

    if (fullNameEl) {
        fullNameEl.addEventListener('input', () => { validateFullName(); validateIdCardFile(); validateDriverLicenseFile(); refreshSubmitState(); });
        fullNameEl.addEventListener('blur', () => { validateFullName(); validateIdCardFile(); validateDriverLicenseFile(); refreshSubmitState(); });
    }
    
    if (phoneEl) {
        phoneEl.addEventListener('input', () => { validatePhone(); refreshSubmitState(); });
        phoneEl.addEventListener('blur', () => { validatePhone(); refreshSubmitState(); });
    }

    if (idCardEl) {
        idCardEl.addEventListener('input', () => { validateIdCard(); validateDriverLicense(); validateIdCardFile(); refreshSubmitState(); });
        idCardEl.addEventListener('blur', () => { validateIdCard(); validateDriverLicense(); validateIdCardFile(); validateDriverLicenseFile(); refreshSubmitState(); });
    }

    if (idCardFileEl) {
        idCardFileEl.addEventListener('change', () => { validateIdCardFile(); validateDriverLicenseFile(); refreshSubmitState(); });
    }

    if (licenseEl) {
        licenseEl.addEventListener('input', () => { validateDriverLicense(); validateDriverLicenseFile(); refreshSubmitState(); });
        licenseEl.addEventListener('blur', () => { validateDriverLicense(); validateDriverLicenseFile(); validateIdCardFile(); refreshSubmitState(); });
    }

    if (licenseFileEl) {
        licenseFileEl.addEventListener('change', () => { validateDriverLicenseFile(); validateIdCardFile(); refreshSubmitState(); });
    }

    if (paymentEl) {
        paymentEl.addEventListener('change', () => { validatePayment(); refreshSubmitState(); });
    }

    refreshSubmitState();
    
    const purchaseForm = document.getElementById('purchaseForm');
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', sendPurchaseWhatsApp);
    }
});

function sendPurchaseWhatsApp(event) {
    if (event) event.preventDefault();

    /* Re-validation complète au moment de la soumission */
    validateFullName();
    validatePhone();
    validateIdCard();
    validateIdCardFile();
    validateDriverLicense();
    refreshSubmitState();

    if (!Object.values(validState).every(Boolean)) {
        const firstInvalid = document.querySelector('#purchaseForm .invalid') || document.querySelector('#fullName');
        if (firstInvalid) firstInvalid.focus();
        return;
    }

    const fullName = document.getElementById('fullName').value.trim();
    const userPhone = document.getElementById('userPhone').value.trim();
    const idCard = document.getElementById('idCard').value.trim();
    const driverLicense = document.getElementById('driverLicense').value.trim();
    const paymentMethod = document.getElementById('paymentMethod').value;

    const loader = document.getElementById('loaderModal');
    if (loader) loader.style.display = 'flex';

    /* Envoi des données vers l'API sales.php avec FormData pour inclure les fichiers photos */
    const saleData = new FormData();
    saleData.append('action', 'create');
    saleData.append('car_name', CAR_NAME);
    saleData.append('car_details', `Paiement : ${paymentMethod} | CNI: ${idCard} | Permis: ${driverLicense}`);
    saleData.append('buyer_nom', fullName);
    saleData.append('buyer_telephone', userPhone);
    saleData.append('sale_price', RAW_PRICE || 0);
    saleData.append('id_card_number', idCard);            
    saleData.append('driver_license_number', driverLicense); 

    const idCardFileEl = document.getElementById('idCardFile');
    const driverLicenseFileEl = document.getElementById('driverLicenseFile');

    if (idCardFileEl && idCardFileEl.files[0]) saleData.append('idCardFile', idCardFileEl.files[0]);
    if (driverLicenseFileEl && driverLicenseFileEl.files[0]) saleData.append('driverLicenseFile', driverLicenseFileEl.files[0]);

    let alreadyTaken = false;
    fetch('../api/sales.php', {
        method: 'POST',
        body: saleData
    })
    .then(response => {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return response.json();
        }
        throw new Error("La réponse du serveur n'est pas au format JSON.");
    })
    .then(data => {
        if (!data.success) {
            console.error('Erreur lors de l’enregistrement de la vente : ', data.message);
            if (data.code === 'ALREADY_PURCHASING') {
                alreadyTaken = true;
                alert(data.message);
            }
        } else {
            console.log('Succès : ', data.message);
        }
    })
    .catch(error => {
        console.error('Erreur réseau lors de l’enregistrement de la vente en base :', error);
    })
    .finally(() => {
        if (alreadyTaken) { // un autre client a bloqué le véhicule entre-temps : pas de WhatsApp
            if (loader) loader.style.display = 'none';
            closeAchatModal();
            return;
        }
        let message = `Bonjour AutoNems, je souhaite finaliser l'achat du véhicule suivant :\n\n`;
        message += `Véhicule : ${CAR_NAME}\n`;
        if (CAR_PRICE) message += `Prix affiché : ${CAR_PRICE}\n`;
        message += `Nom : ${fullName}\n`;
        message += `Téléphone : ${userPhone}\n`;
        message += `CNI : ${idCard} (Photo jointe)\n`;
        message += `Permis : ${driverLicense} (Photo jointe)\n`;
        message += `Mode de paiement : ${paymentMethod}`;

        const whatsappUrl = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`;

        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
            if (loader) loader.style.display = 'none';
            closeAchatModal();
        }, 900);
    });
}