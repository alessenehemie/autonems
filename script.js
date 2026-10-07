const PHONE_NUMBER = "2250769583494";

/* ---------- Navbar au scroll ---------- */
const navbar = document.getElementById('navbar');
function handleNavbarScroll() {
    if (window.scrollY > 40) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
}
window.addEventListener('scroll', handleNavbarScroll, { passive: true });

/* ---------- Barre de progression de scroll ---------- */
const progressBar = document.getElementById('scrollProgress');
function updateScrollProgress() {
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    if (progressBar) progressBar.style.width = scrolled + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });

/* ---------- Révélation au scroll (IntersectionObserver, plus fluide) ---------- */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

function observeReveals(root = document) {
    root.querySelectorAll('.reveal:not(.active)').forEach(el => revealObserver.observe(el));
}

/* ---------- VOTRE FLOTTE RÉELLE ---------- */
/* "loc" = prix de location/jour, "vente" = prix de vente, en FCFA.
   "description" et "equipements" alimentent la fiche détaillée (modal). */
/* Liste de SECOURS : utilisée seulement si api/vehicules.php est injoignable.
   La vraie source des véhicules est désormais la base de données (voir loadVehicles). */
const FALLBACK_VEHICLES = [
    {
        id: "hyundai-tucson", nom: "Hyundai Tucson", marque: "Hyundai", img: "image/hundai.jpg",
        an: 2024, km: "15 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Gris métallisé",
        loc: 45000, vente: 16500000, dispo: true,
        description: "Un SUV familial moderne et fiable, parfait pour la ville comme pour les routes de l'intérieur. Confort, faible consommation et look actuel.",
        equipements: ["Climatisation automatique", "Caméra de recul", "Bluetooth & Apple CarPlay", "Régulateur de vitesse", "Jantes alliage 18\""]
    },
    {
        id: "mercedes-benz-gle", nom: "Mercedes-Benz GLE", marque: "Mercedes", img: "image/gle.jpg",
        an: 2022, km: "38 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Vert émeraude",
        loc: 70000, vente: 24000000, dispo: true,
        description: "Le SUV premium par excellence : présence, puissance et intérieur luxueux. Idéal pour vos déplacements professionnels ou cérémonies.",
        equipements: ["Sièges cuir chauffants", "Toit panoramique", "Système AMG Line", "Caméra 360°", "Suspension pneumatique"]
    },
    {
        id: "range-rover-nouvelle-gen", nom: "Range Rover (Nouvelle Gen)", marque: "Land Rover", img: "image/rangerover.jpg",
        an: 2023, km: "22 000", boite: "Automatique", carburant: "Diesel", places: 5, couleur: "Marron truffe",
        loc: 120000, vente: 38500000, dispo: true,
        description: "L'incarnation du luxe britannique. Un SUV d'exception pour ceux qui veulent voyager dans le plus grand confort, sur route comme en tout-terrain.",
        equipements: ["Intérieur cuir Windsor", "Suspension adaptative", "Écran tactile 13.1\"", "4 roues motrices intégrales", "Assistant de conduite"]
    },
    {
        id: "bmw-m4", nom: "BMW M4", marque: "BMW", img: "image/bmw.jpg",
        an: 2021, km: "41 000", boite: "Automatique", carburant: "Essence", places: 4, couleur: "Blanc Alpin",
        loc: 85000, vente: 21500000, dispo: true,
        description: "Une pure sportive allemande. Design agressif, sensations fortes garanties — pour les amateurs de conduite dynamique et de style.",
        equipements: ["Kit carrosserie M Performance", "Sièges baquets", "Échappement sport", "Jantes 19\"/20\"", "Mode Sport +"]
    },
    {
        id: "kia-sportage-gt-line", nom: "Kia Sportage GT-Line", marque: "Kia", img: "image/kia.jpg",
        an: 2025, km: "8 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Gris cyber",
        loc: 50000, vente: 13200000, dispo: true,
        description: "Le tout dernier Sportage : design futuriste, faible kilométrage, garantie constructeur encore active. Excellent rapport qualité-prix.",
        equipements: ["Écran incurvé double", "Chargeur à induction", "Caméra de recul HD", "Sièges chauffants/ventilés", "Garantie constructeur"]
    },
    {
        id: "peugeot-e-308-sw", nom: "Peugeot e-308 SW", marque: "Peugeot", img: "image/peugeot.jpg",
        an: 2024, km: "12 000", boite: "Automatique", carburant: "Électrique", places: 5, couleur: "Blanc nacré",
        loc: 48000, vente: 14900000, dispo: true,
        description: "Le break électrique idéal pour rouler propre sans sacrifier l'espace ni le style. Silencieux, économique et très agréable au quotidien.",
        equipements: ["100% électrique", "i-Cockpit numérique", "Recharge rapide", "Grand coffre familial", "Aides à la conduite"]
    },
    {
        id: "toyota-corolla", nom: "Toyota Corolla", marque: "Toyota", img: "https://images.unsplash.com/photo-1638618164682-12b986ec2a75?auto=format&fit=crop&w=1200&q=80",
        an: 2022, km: "29 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Blanc",
        loc: 30000, vente: 10800000, dispo: true,
        description: "La berline la plus fiable du marché ivoirien. Entretien économique, pièces disponibles partout à Abidjan — un choix sûr et sans souci.",
        equipements: ["Consommation très basse", "Climatisation", "Bluetooth", "Sellerie tissu robuste", "Faible coût d'entretien"]
    },
    {
        id: "toyota-hilux-double-cabine", nom: "Toyota Hilux Double Cabine", marque: "Toyota", img: "https://images.unsplash.com/photo-1621786805936-65e5e163c1e9?auto=format&fit=crop&w=1200&q=80",
        an: 2021, km: "52 000", boite: "Manuelle", carburant: "Diesel", places: 5, couleur: "Blanc",
        loc: 55000, vente: 17800000, dispo: true,
        description: "Le pick-up increvable, taillé pour les chantiers comme pour les pistes. Robuste, spacieux, capable de tout transporter.",
        equipements: ["4x4 enclenchable", "Benne utilitaire", "Châssis renforcé", "Climatisation", "Idéal chantier/brousse"]
    },
    {
        id: "toyota-land-cruiser-prado", nom: "Toyota Land Cruiser Prado", marque: "Toyota", img: "https://images.unsplash.com/photo-1650530579355-7ad9d4766043?auto=format&fit=crop&w=1200&q=80",
        an: 2022, km: "31 000", boite: "Automatique", carburant: "Diesel", places: 7, couleur: "Noir",
        loc: 95000, vente: 29500000, dispo: true,
        description: "Le 4x4 le plus recherché à Abidjan : fiable, puissant, spacieux jusqu'à 7 places. Parfait pour les familles et les longs trajets.",
        equipements: ["7 places", "4 roues motrices", "Climatisation 3 zones", "Grand coffre", "Excellente tenue de route"]
    },
    {
        id: "mercedes-benz-classe-c", nom: "Mercedes-Benz Classe C", marque: "Mercedes", img: "https://images.unsplash.com/photo-1593950315186-76a92975b60c?auto=format&fit=crop&w=1200&q=80",
        an: 2023, km: "18 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Argent",
        loc: 65000, vente: 22800000, dispo: true,
        description: "L'élégance discrète d'une berline allemande premium. Confort de conduite exceptionnel pour vos rendez-vous d'affaires.",
        equipements: ["Sièges cuir", "Écran MBUX", "Aides à la conduite", "Ambiance lumineuse", "Finition premium"]
    }
];

let VEHICLES = FALLBACK_VEHICLES;

/* Les prix venant de MySQL arrivent souvent en texte ("72800000.00") : on force Number() */
const fmt = n => Number(n || 0).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ") + " FCFA";

/* Échappe le texte venant de la base avant de l'injecter dans le HTML (anti-XSS) */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Réservations en direct (alimentées par ReservationStore) ---------- */
let liveReservations = {};
function activeReservations() {
    const now = Date.now();
    const out = {};
    Object.keys(liveReservations || {}).forEach(id => {
        const r = liveReservations[id];
        if (r && (r.until > now || r.statut === 'Confirmée')) out[id] = r;
    });
    return out;
}
/* AJOUT : une réservation faite depuis l'admin utilise un identifiant basé sur le nom
   (ex: "hyundai-tucson") alors que la flotte ci-dessus utilise des ids courts (ex: "tucson").
   Cette fonction retrouve la réservation d'un véhicule quel que soit le format de l'id. */
function slugify(text) {
    return String(text).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}
function getReservation(reservations, v) {
    if (!reservations) return undefined;
    if (reservations[v.id]) return reservations[v.id];
    const slug = slugify(v.nom);
    if (reservations[slug]) return reservations[slug];
    return Object.values(reservations).find(r => r && r.car && slugify(r.car) === slug);
}
function formatRemaining(ms) {
    if (ms <= 0) return "";
    const totalMin = Math.ceil(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days} j ${hours} h`;
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
}

/* Libellé + classe du badge : "En cours de réservation" (en attente de validation admin),
   "Réservé" (confirmé par l'admin) ou "Disponible" */
function reservationBadge(reservation, dispoFinal) {
    if (reservation && reservation.statut !== 'Confirmée') return { label: 'En cours de réservation', cls: 'badge-reserve badge-pending' };
    if (!dispoFinal) return { label: 'Réservé', cls: 'badge-reserve' };
    return { label: 'Disponible', cls: '' };
}

function lienAchat(v) {
    const params = new URLSearchParams({
        car: v.nom, id: v.id, img: v.img, price: v.vente, an: v.an, km: v.km
    });
    return `achat/index.html?${params.toString()}`;
}

/* ---------- Rendu des cartes ---------- */
function carteHTML(v, reservations, index) {
    const reservation = getReservation(reservations, v);
    const isReservedNow = !!reservation;
    const dispoFinal = v.dispo && !isReservedNow;
    const badgeInfo = reservationBadge(reservation, dispoFinal);
    let badgeLabel = badgeInfo.label;
    let badgeSub = '';
    
    // Le compte à rebours s'affiche uniquement lorsque le statut devient Confirmée
    if (reservation && reservation.statut === 'Confirmée') {
        const remaining = formatRemaining(reservation.until - Date.now());
        if (remaining) {
            badgeSub = `<span class="badge-timer">libère dans ${remaining}</span>`;
        }
    }

    return `
    <div class="card reveal vehicle-card" data-id="${v.id}" style="transition-delay:${(index % 6) * 60}ms">
        <div class="img-container">
            <img src="${esc(v.img)}" alt="${esc(v.nom)}" loading="lazy">
            <span class="badge ${badgeInfo.cls}">${badgeLabel}</span>
            ${badgeSub}
            <span class="card-shine"></span>
        </div>
        <div class="card-info">
            <h3>${esc(v.nom)}</h3>
            <div class="specs-row">
                <span class="spec-chip">${esc(v.an)}</span>
                <span class="spec-chip">${esc(v.km)} km</span>
                <span class="spec-chip">${esc(v.boite)}</span>
                <span class="spec-chip">${esc(v.carburant)}</span>
            </div>
            <div class="price-block">
                <div class="price-line"><span class="price-label">Location</span><span class="price">${fmt(v.loc)} <span>/ jour</span></span></div>
                <div class="price-line"><span class="price-label">Vente</span><span class="price">${fmt(v.vente)}</span></div>
            </div>
            <div class="card-actions">
                <button type="button" class="btn-full btn-reserve" data-id="${v.id}" onclick="event.stopPropagation()">Réserver</button>
                <a href="${lienAchat(v)}" class="btn-full btn-acheter-card" onclick="event.stopPropagation()">Acheter</a>
            </div>
            <button class="btn-details" data-id="${v.id}">Voir les détails ↗</button>
        </div>
    </div>`;
}

function renderFleet(list) {
    const grid = document.getElementById('vehicleGrid');
    const noResult = document.getElementById('noResult');
    const reservations = activeReservations();
    grid.innerHTML = list.map((v, i) => carteHTML(v, reservations, i)).join('');
    noResult.hidden = list.length > 0;
    observeReveals(grid);
    attachCardEvents();
    applyTiltEffect();
}

/* ---------- Recherche + filtres par marque ---------- */
let activeBrand = 'Tous';
function currentFilteredList() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    return VEHICLES.filter(v => {
        const matchQuery = !q || v.nom.toLowerCase().includes(q) || v.marque.toLowerCase().includes(q);
        const matchBrand = activeBrand === 'Tous' || v.marque === activeBrand;
        return matchQuery && matchBrand;
    });
}
function searchVehicles() { renderFleet(currentFilteredList()); }

function buildBrandChips() {
    const chipsWrap = document.getElementById('brandChips');
    if (!chipsWrap) return;
    const brands = ['Tous', ...Array.from(new Set(VEHICLES.map(v => v.marque)))];
    chipsWrap.innerHTML = brands.map(b =>
        `<button class="chip ${b === activeBrand ? 'chip-active' : ''}" data-brand="${b}">${b}</button>`
    ).join('');
    chipsWrap.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            activeBrand = chip.dataset.brand;
            chipsWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
            chip.classList.add('chip-active');
            searchVehicles();
        });
    });
}


/* ---------- Chargement des véhicules depuis la base de données ---------- */
function normalizeVehicle(row) {
    return {
        id: slugify(row.nom),          // même identifiant que les réservations (car_id = slug du nom)
        dbId: row.id,
        nom: row.nom,
        marque: row.marque || '',
        img: row.img || '',
        an: Number(row.an) || '',
        km: row.km || '',
        boite: row.boite || '',
        carburant: row.carburant || '',
        places: Number(row.places) || 5,
        couleur: row.couleur || '',
        loc: Number(row.loc) || 0,
        vente: Number(row.vente) || 0,
        dispo: row.dispo === true || row.dispo === 1 || row.dispo === '1',
        description: row.description || '',
        equipements: Array.isArray(row.equipements) ? row.equipements : []
    };
}
async function loadVehicles() {
    try {
        const res = await fetch('api/vehicules.php?action=list', { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Réponse invalide');
        VEHICLES = data.vehicules.map(normalizeVehicle);
    } catch (err) {
        console.error('Chargement des véhicules impossible, liste de secours utilisée :', err);
        VEHICLES = FALLBACK_VEHICLES;
    }
    if (activeBrand !== 'Tous' && !VEHICLES.some(v => v.marque === activeBrand)) activeBrand = 'Tous';
    buildBrandChips();
    renderFleet(currentFilteredList());
}

/* ---------- Modal détails véhicule ---------- */
const modal = document.getElementById('vehicleModal');
function openModal(id) {
    const v = VEHICLES.find(x => x.id === id);
    if (!v) return;
    const reservations = activeReservations();
    const reservation = getReservation(reservations, v);
    const dispoFinal = v.dispo && !reservation;

    document.getElementById('modalImg').src = v.img;
    document.getElementById('modalImg').alt = v.nom;
    document.getElementById('modalTitle').textContent = v.nom;
    const modalBadgeInfo = reservationBadge(reservation, dispoFinal);
    document.getElementById('modalBadge').textContent = modalBadgeInfo.label;
    document.getElementById('modalBadge').className = ('badge modal-badge ' + modalBadgeInfo.cls).trim();
    document.getElementById('modalDesc').textContent = v.description;

    document.getElementById('modalSpecs').innerHTML = `
        <div class="modal-spec"><span>Année</span><strong>${esc(v.an)}</strong></div>
        <div class="modal-spec"><span>Kilométrage</span><strong>${esc(v.km)} km</strong></div>
        <div class="modal-spec"><span>Boîte</span><strong>${esc(v.boite)}</strong></div>
        <div class="modal-spec"><span>Carburant</span><strong>${esc(v.carburant)}</strong></div>
        <div class="modal-spec"><span>Places</span><strong>${esc(v.places)}</strong></div>
        <div class="modal-spec"><span>Couleur</span><strong>${esc(v.couleur)}</strong></div>
    `;
    document.getElementById('modalEquip').innerHTML = v.equipements.map(e => `<li>${esc(e)}</li>`).join('');
    document.getElementById('modalPriceLoc').textContent = fmt(v.loc) + ' / jour';
    document.getElementById('modalPriceVente').textContent = fmt(v.vente);
    document.getElementById('modalReserveBtn').onclick = () => { closeModal(); openReservationModal(v.id); };
    document.getElementById('modalAchatBtn').href = lienAchat(v);

    if (reservation && reservation.statut === 'Confirmée') {
        const remaining = formatRemaining(reservation.until - Date.now());
        document.getElementById('modalTimer').hidden = false;
        document.getElementById('modalTimer').textContent = `⏱ Ce véhicule est réservé (expire dans ${remaining}).`;
    } else if (reservation) {
        document.getElementById('modalTimer').hidden = false;
        document.getElementById('modalTimer').textContent = `Ce véhicule est actuellement en cours de réservation.`;
    } else {
        document.getElementById('modalTimer').hidden = true;
    }

    modal.classList.add('open');
    document.body.classList.add('modal-open');
}
function closeModal() {
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
}
function attachCardEvents() {
    document.querySelectorAll('.vehicle-card').forEach(card => {
        card.addEventListener('click', () => openModal(card.dataset.id));
    });
    document.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openModal(btn.dataset.id); });
    });
    document.querySelectorAll('.btn-reserve').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openReservationModal(btn.dataset.id); });
    });
}

/* ---------- Effet tilt 3D léger sur les cartes (souris) ---------- */
function applyTiltEffect() {
    if (window.matchMedia('(pointer: coarse)').matches) return; // pas sur mobile/tactile
    document.querySelectorAll('.vehicle-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const rotateX = ((y / rect.height) - 0.5) * -6;
            const rotateY = ((x / rect.width) - 0.5) * 8;
            card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
            const shine = card.querySelector('.card-shine');
            if (shine) shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.35), transparent 45%)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            const shine = card.querySelector('.card-shine');
            if (shine) shine.style.background = '';
        });
    });
}

/* ============================================================
   MODAL DE RÉSERVATION
   Étape 1 : nom, téléphone, durée, pièce d'identité → démarre le chrono.
   Étape 2 : confirmation + "Voulez-vous acheter ce véhicule ?"
   ============================================================ */
const reservationModal = document.getElementById('reservationModal');
let reservationCarId = null;
const resValidState = { name: false, phone: false, duration: false, idCard: false, identity: false, license: false, licenseFile: false };

function openReservationModal(id) {
    const v = VEHICLES.find(x => x.id === id);
    if (!v) return;

    // PROTECTION : Bloque l'ouverture si le véhicule est déjà réservé
    const reservations = activeReservations();
    if (getReservation(reservations, v)) {
        alert("Désolé, ce véhicule est actuellement réservé ou en cours de réservation et ne peut pas être sélectionné.");
        return;
    }

    reservationCarId = id;
    warmUpOcr(); // précharge le moteur de lecture des photos pendant que le client remplit le formulaire

    document.getElementById('resCarName').textContent = v.nom;
    document.getElementById('resCarPrice').textContent = fmt(v.loc) + ' / jour';
    document.getElementById('resCarImg').src = v.img;

    // Reset du formulaire
    ['resName', 'resPhone', 'idCard', 'resIdentityDoc', 'driverLicense', 'driverLicenseFile', 'paymentMethod'].forEach(fid => {
        const el = document.getElementById(fid);
        if (!el) return;
        if (el.type === 'file') el.value = '';
        else el.value = '';
        el.classList.remove('valid', 'invalid');
    });
    const durationEl = document.getElementById('resDuration');
    if (durationEl) durationEl.value = '';
    
    ['resNameError', 'resPhoneError', 'idCardError', 'resDurationError', 'resIdentityDocError', 'driverLicenseError', 'driverLicenseFileError', 'paymentMethodError'].forEach(eid => {
        const errEl = document.getElementById(eid);
        if (errEl) errEl.hidden = true;
    });
    
    Object.keys(resValidState).forEach(k => resValidState[k] = false);
    refreshResSubmitState();

    document.getElementById('resStepForm').hidden = false;
    document.getElementById('resStepConfirm').hidden = true;

    reservationModal.classList.add('open');
    document.body.classList.add('modal-open');
}
function closeReservationModal() {
    reservationModal.classList.remove('open');
    document.body.classList.remove('modal-open');
}

function resSetError(inputEl, errorEl, message) {
    inputEl.classList.add('invalid'); inputEl.classList.remove('valid');
    errorEl.textContent = message; errorEl.hidden = false;
    inputEl.classList.add('shake');
    setTimeout(() => inputEl.classList.remove('shake'), 400);
}
function resSetValid(inputEl, errorEl) {
    inputEl.classList.remove('invalid'); inputEl.classList.add('valid');
    errorEl.hidden = true;
}

function validateResName() {
    const el = document.getElementById('resName');
    const errorEl = document.getElementById('resNameError');
    const result = AutoNemsValidation.validateName(el.value);
    if (result.empty) { el.classList.remove('invalid', 'valid'); errorEl.hidden = true; resValidState.name = false; return; }
    if (!result.valid) { resSetError(el, errorEl, result.message); resValidState.name = false; return; }
    resSetValid(el, errorEl); resValidState.name = true;
}
function validateResPhone() {
    const el = document.getElementById('resPhone');
    const errorEl = document.getElementById('resPhoneError');
    const result = AutoNemsValidation.validatePhone(el.value);
    if (result.empty) { el.classList.remove('invalid', 'valid'); errorEl.hidden = true; resValidState.phone = false; return; }
    if (!result.valid) { resSetError(el, errorEl, result.message); resValidState.phone = false; return; }
    resSetValid(el, errorEl); resValidState.phone = true;
}
function validateResDuration() {
    const el = document.getElementById('resDuration');
    const errorEl = document.getElementById('resDurationError');
    if (!el.value) { errorEl.hidden = true; el.classList.remove('invalid', 'valid'); resValidState.duration = false; return; }
    resSetValid(el, errorEl); resValidState.duration = true;
}

function validateResIdCard() {
    const el = document.getElementById('idCard');
    const errorEl = document.getElementById('idCardError');
    const value = el.value.trim();

    if (value === "") {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        resValidState.idCard = false;
        return;
    }
    if (value.length < 5) {
        resSetError(el, errorEl, "Numéro de pièce d'identité trop court ou invalide.");
        resValidState.idCard = false;
        return;
    }
    resSetValid(el, errorEl);
    resValidState.idCard = true;
}

/* ============================================================
   OCR (lecture des numéros sur les photos) — version améliorée
   - image préparée avant lecture (agrandie, niveaux de gris, contraste)
   - lecture de secours sur l'image d'origine si la 1re lecture ne correspond pas
   - comparaison tolérante aux confusions de lecture : O/0, I/L/1, Z/2, S/5, G/6, B/8
   - OCR_MAX_ERRORS caractères d'écart tolérés (numéros de 8 caractères ou plus)
   - une seule lecture par photo (cache) + préchargement du moteur à l'ouverture du formulaire
   ============================================================ */
const OCR_MAX_ERRORS = 1; // 0 = comparaison stricte
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

// Le numéro est-il présent dans le texte lu (avec au plus maxErrors erreurs de lecture) ?
function fuzzyContains(text, number, maxErrors) {
    const T = normalizeOcr(text);
    const P = normalizeOcr(number);
    if (!P) return false;
    if (T.includes(P)) return true;
    if (P.length < 8 || !maxErrors) return false; // numéros courts : comparaison stricte
    let prev = [];
    for (let i = 0; i <= P.length; i++) prev[i] = i;
    for (let j = 1; j <= T.length; j++) {
        const cur = [0];
        for (let i = 1; i <= P.length; i++) {
            cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (P[i - 1] === T[j - 1] ? 0 : 1));
        }
        if (cur[P.length] <= maxErrors) return true;
        prev = cur;
    }
    return false;
}

async function ocrMatchesNumber(file, number) {
    const first = await ocrTextPass(file, 0);
    if (fuzzyContains(first, number, OCR_MAX_ERRORS)) return true;
    try {
        const second = await ocrTextPass(file, 1);
        return fuzzyContains(second, number, OCR_MAX_ERRORS);
    } catch (e) {
        return false;
    }
}

/* ---------- VALIDATION DE LA PHOTO DE LA CNI AVEC TESSERACT.JS ---------- */
async function validateResIdentity() {
    const el = document.getElementById('resIdentityDoc');
    const errorEl = document.getElementById('resIdentityDocError');
    const textEl = document.getElementById('idCard');

    if (el.files.length === 0) {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        resValidState.identity = false;
        refreshResSubmitState();
        return;
    }

    if (textEl.value.trim() === "") {
        resSetError(el, errorEl, "Veuillez d'abord saisir le numéro de CNI textuel.");
        resValidState.identity = false;
        refreshResSubmitState();
        return;
    }

    if (!isImageFile(el.files[0])) {
        resSetError(el, errorEl, "Format non pris en charge : envoyez une photo (JPG ou PNG), pas un PDF.");
        resValidState.identity = false;
        refreshResSubmitState();
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
            resSetValid(el, errorEl);
            resValidState.identity = true;
        } else {
            resSetError(el, errorEl, "Le numéro sur la photo ne correspond pas au numéro de CNI saisi !");
            resValidState.identity = false;
        }
    } catch (err) {
        console.error("Erreur OCR :", err);
        resSetError(el, errorEl, ocrErrorMessage(err));
        resValidState.identity = false;
    }

    refreshResSubmitState();
}

/* ---------- VALIDATION DU PERMIS DE CONDUIRE (numéro + photo lue avec Tesseract.js) ---------- */
function validateResLicense() {
    const el = document.getElementById('driverLicense');
    const errorEl = document.getElementById('driverLicenseError');
    const value = el.value.trim();

    if (value === "") {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        resValidState.license = false;
        return;
    }
    if (value.length < 5) {
        resSetError(el, errorEl, "Numéro de permis de conduire trop court ou invalide.");
        resValidState.license = false;
        return;
    }
    resSetValid(el, errorEl);
    resValidState.license = true;
}

let licenseFileCheckId = 0;
async function validateResLicenseFile() {
    const el = document.getElementById('driverLicenseFile');
    const errorEl = document.getElementById('driverLicenseFileError');
    const textEl = document.getElementById('driverLicense');
    const myCheck = ++licenseFileCheckId;

    if (el.files.length === 0) {
        el.classList.remove('invalid', 'valid');
        errorEl.hidden = true;
        resValidState.licenseFile = false;
        refreshResSubmitState();
        return;
    }

    if (textEl.value.trim() === "") {
        resSetError(el, errorEl, "Veuillez d'abord saisir le numéro de permis de conduire.");
        resValidState.licenseFile = false;
        refreshResSubmitState();
        return;
    }

    if (!isImageFile(el.files[0])) {
        resSetError(el, errorEl, "Format non pris en charge : envoyez une photo (JPG ou PNG), pas un PDF.");
        resValidState.licenseFile = false;
        refreshResSubmitState();
        return;
    }

    // Message d'attente pendant l'analyse OCR (le bouton reste bloqué)
    errorEl.hidden = false;
    errorEl.textContent = "Analyse automatique de la photo du permis en cours...";
    el.classList.remove('valid', 'invalid');
    resValidState.licenseFile = false;
    refreshResSubmitState();

    try {
        const matches = await ocrMatchesNumber(el.files[0], textEl.value);
        if (myCheck !== licenseFileCheckId) return; // résultat périmé (nouvelle saisie entre-temps)

        if (matches) {
            resSetValid(el, errorEl);
            resValidState.licenseFile = true;
        } else {
            resSetError(el, errorEl, "Le numéro sur la photo du permis ne correspond pas au numéro saisi !");
            resValidState.licenseFile = false;
        }
    } catch (err) {
        if (myCheck !== licenseFileCheckId) return;
        console.error("Erreur OCR permis :", err);
        resSetError(el, errorEl, ocrErrorMessage(err));
        resValidState.licenseFile = false;
    }

    refreshResSubmitState();
}

function refreshResSubmitState() {
    const allValid = Object.values(resValidState).every(Boolean);
    const btn = document.getElementById('resSubmitBtn');
    if (btn) {
        btn.disabled = !allValid;
        btn.classList.toggle('btn-ready', allValid);
    }
}

function handleReservationSubmit(e) {
    e.preventDefault();
    validateResName(); 
    validateResPhone(); 
    validateResDuration();
    validateResIdCard();
    validateResIdentity();
    validateResLicense();
    refreshResSubmitState();
    
    if (!Object.values(resValidState).every(Boolean)) {
        const firstInvalid = document.querySelector('#reservationForm .invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
    }
    const v = VEHICLES.find(x => x.id === reservationCarId);
    if (!v) return;

    const name = document.getElementById('resName').value.trim();
    const phone = document.getElementById('resPhone').value.trim();
    const durationHours = document.getElementById('resDuration').value;
    const durationLabel = document.getElementById('resDuration').selectedOptions[0].textContent;

    const untilTs = Date.now() + (parseInt(durationHours, 10) * 3600 * 1000);

    // Préparation des données FormData pour l'envoi du fichier et des infos à PHP
    const formElement = document.getElementById('reservationForm');
    const formData = new FormData(formElement);
    formData.append('action', 'create');
    formData.append('car_id', v.id);
    formData.append('client_nom', name);
    formData.append('client_telephone', phone);
    formData.append('car_name', v.nom);
    formData.append('until_ts', untilTs);
    formData.append('duree_label', durationLabel);
    formData.append('duration_hours', durationHours);

    // Envoi des données en arrière-plan vers api/booking.php
    fetch('api/booking.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.warn("Avertissement enregistrement BDD :", data.message);
            alert("Votre réservation n'a pas pu être enregistrée : " + data.message);
        }
        if (window.ReservationStore && ReservationStore.refresh) ReservationStore.refresh();
    })
    .catch(err => {
        console.error("Erreur réseau lors de l'enregistrement de la réservation :", err);
    });

    const texte = `Bonjour AutoNems, je souhaite réserver ce véhicule :\n\n` +
        `Véhicule : ${v.nom} (${v.an})\n` +
        `Prix : ${fmt(v.loc)} / jour\n` +
        `Nom : ${name}\n` +
        `Téléphone : ${phone}\n` +
        `Durée de réservation : ${durationLabel}`;
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(texte)}`, '_blank');

    document.getElementById('resConfirmText').textContent =
        `Votre demande de réservation pour la ${v.nom} est enregistrée pour ${durationLabel}. Le véhicule est maintenant affiché "En cours de réservation" sur le site. Un conseiller vous contacte sur WhatsApp pour confirmer.`;
    document.getElementById('resBuyYesBtn').href = lienAchat(v);
    document.getElementById('resStepForm').hidden = true;
    document.getElementById('resStepConfirm').hidden = false;
}

/* ---------- Rafraîchissement périodique (compte à rebours + auto "libération") ---------- */
setInterval(() => {
    if (document.querySelectorAll('.badge-timer').length || Object.keys(liveReservations || {}).length) {
        renderFleet(currentFilteredList());
    }
}, 20000);

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    buildBrandChips();
    loadVehicles();                       
    setInterval(loadVehicles, 30000);     

    ReservationStore.subscribe(res => {
        liveReservations = res || {};
        renderFleet(currentFilteredList());
    });

    /* ---------- Rafraîchissement automatique de l'interface des cartes ---------- */
    ReservationStore.subscribe(function() {
        const actives = activeReservations();
        VEHICLES.forEach(car => {
            const card = document.querySelector(`.vehicle-card[data-id="${car.id}"]`);
            if (!card) return;

            const badge = card.querySelector('.badge');
            const reservation = getReservation(actives, car);
            const isReservedNow = !!reservation;
            const dispoFinal = car.dispo && !isReservedNow;

            if (badge) {
                const info = reservationBadge(reservation, dispoFinal);
                badge.textContent = info.label;
                badge.classList.remove('badge-reserve', 'badge-pending');
                info.cls.split(' ').filter(Boolean).forEach(c => badge.classList.add(c));
            }
        });
    });

    document.getElementById('searchInput').addEventListener('input', searchVehicles);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);

    document.getElementById('resModalClose').addEventListener('click', closeReservationModal);
    document.getElementById('resModalOverlay').addEventListener('click', closeReservationModal);
    document.getElementById('reservationForm').addEventListener('submit', handleReservationSubmit);
    
    document.getElementById('resName').addEventListener('input', () => { validateResName(); refreshResSubmitState(); });
    document.getElementById('resPhone').addEventListener('input', () => { validateResPhone(); refreshResSubmitState(); });
    document.getElementById('resDuration').addEventListener('change', () => { validateResDuration(); refreshResSubmitState(); });
    
    const idCardInput = document.getElementById('idCard');
    if (idCardInput) {
        idCardInput.addEventListener('input', () => { validateResIdCard(); validateResIdentity(); refreshResSubmitState(); });
        idCardInput.addEventListener('blur', () => { validateResIdCard(); validateResIdentity(); refreshResSubmitState(); });
    }

    const identityInput = document.getElementById('resIdentityDoc');
    if (identityInput) {
        identityInput.addEventListener('change', () => {
            validateResIdentity();
            refreshResSubmitState();
        });
    }

    const licenseInput = document.getElementById('driverLicense');
    if (licenseInput) {
        licenseInput.addEventListener('input', () => { validateResLicense(); validateResLicenseFile(); refreshResSubmitState(); });
        licenseInput.addEventListener('blur', () => { validateResLicense(); validateResLicenseFile(); refreshResSubmitState(); });
    }

    const licenseFileInput = document.getElementById('driverLicenseFile');
    if (licenseFileInput) {
        licenseFileInput.addEventListener('change', () => {
            validateResLicenseFile();
            refreshResSubmitState();
        });
    }

    document.getElementById('resBuyNoBtn').addEventListener('click', closeReservationModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); closeReservationModal(); }
    });

    observeReveals();
    handleNavbarScroll();
    updateScrollProgress();
});