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
const VEHICLES = [
    {
        id: "tucson", nom: "Hyundai Tucson", marque: "Hyundai", img: "image/hundai.jpg",
        an: 2024, km: "15 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Gris métallisé",
        loc: 45000, vente: 16500000, dispo: true,
        description: "Un SUV familial moderne et fiable, parfait pour la ville comme pour les routes de l'intérieur. Confort, faible consommation et look actuel.",
        equipements: ["Climatisation automatique", "Caméra de recul", "Bluetooth & Apple CarPlay", "Régulateur de vitesse", "Jantes alliage 18\""]
    },
    {
        id: "gle", nom: "Mercedes-Benz GLE", marque: "Mercedes", img: "image/gle.jpg",
        an: 2022, km: "38 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Vert émeraude",
        loc: 70000, vente: 24000000, dispo: true,
        description: "Le SUV premium par excellence : présence, puissance et intérieur luxueux. Idéal pour vos déplacements professionnels ou cérémonies.",
        equipements: ["Sièges cuir chauffants", "Toit panoramique", "Système AMG Line", "Caméra 360°", "Suspension pneumatique"]
    },
    {
        id: "rangerover", nom: "Range Rover (Nouvelle Gen)", marque: "Land Rover", img: "image/rangerover.jpg",
        an: 2023, km: "22 000", boite: "Automatique", carburant: "Diesel", places: 5, couleur: "Marron truffe",
        loc: 120000, vente: 38500000, dispo: true,
        description: "L'incarnation du luxe britannique. Un SUV d'exception pour ceux qui veulent voyager dans le plus grand confort, sur route comme en tout-terrain.",
        equipements: ["Intérieur cuir Windsor", "Suspension adaptative", "Écran tactile 13.1\"", "4 roues motrices intégrales", "Assistant de conduite"]
    },
    {
        id: "bmw", nom: "BMW M4", marque: "BMW", img: "image/bmw.jpg",
        an: 2021, km: "41 000", boite: "Automatique", carburant: "Essence", places: 4, couleur: "Blanc Alpin",
        loc: 85000, vente: 21500000, dispo: true,
        description: "Une pure sportive allemande. Design agressif, sensations fortes garanties — pour les amateurs de conduite dynamique et de style.",
        equipements: ["Kit carrosserie M Performance", "Sièges baquets", "Échappement sport", "Jantes 19\"/20\"", "Mode Sport +"]
    },
    {
        id: "kia", nom: "Kia Sportage GT-Line", marque: "Kia", img: "image/kia.jpg",
        an: 2025, km: "8 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Gris cyber",
        loc: 50000, vente: 13200000, dispo: true,
        description: "Le tout dernier Sportage : design futuriste, faible kilométrage, garantie constructeur encore active. Excellent rapport qualité-prix.",
        equipements: ["Écran incurvé double", "Chargeur à induction", "Caméra de recul HD", "Sièges chauffants/ventilés", "Garantie constructeur"]
    },
    {
        id: "peugeot", nom: "Peugeot e-308 SW", marque: "Peugeot", img: "image/peugeot.jpg",
        an: 2024, km: "12 000", boite: "Automatique", carburant: "Électrique", places: 5, couleur: "Blanc nacré",
        loc: 48000, vente: 14900000, dispo: true,
        description: "Le break électrique idéal pour rouler propre sans sacrifier l'espace ni le style. Silencieux, économique et très agréable au quotidien.",
        equipements: ["100% électrique", "i-Cockpit numérique", "Recharge rapide", "Grand coffre familial", "Aides à la conduite"]
    },
    {
        id: "corolla", nom: "Toyota Corolla", marque: "Toyota", img: "https://images.unsplash.com/photo-1638618164682-12b986ec2a75?auto=format&fit=crop&w=1200&q=80",
        an: 2022, km: "29 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Blanc",
        loc: 30000, vente: 10800000, dispo: true,
        description: "La berline la plus fiable du marché ivoirien. Entretien économique, pièces disponibles partout à Abidjan — un choix sûr et sans souci.",
        equipements: ["Consommation très basse", "Climatisation", "Bluetooth", "Sellerie tissu robuste", "Faible coût d'entretien"]
    },
    {
        id: "hilux", nom: "Toyota Hilux Double Cabine", marque: "Toyota", img: "https://images.unsplash.com/photo-1621786805936-65e5e163c1e9?auto=format&fit=crop&w=1200&q=80",
        an: 2021, km: "52 000", boite: "Manuelle", carburant: "Diesel", places: 5, couleur: "Blanc",
        loc: 55000, vente: 17800000, dispo: true,
        description: "Le pick-up increvable, taillé pour les chantiers comme pour les pistes. Robuste, spacieux, capable de tout transporter.",
        equipements: ["4x4 enclenchable", "Benne utilitaire", "Châssis renforcé", "Climatisation", "Idéal chantier/brousse"]
    },
    {
        id: "prado", nom: "Toyota Land Cruiser Prado", marque: "Toyota", img: "https://images.unsplash.com/photo-1650530579355-7ad9d4766043?auto=format&fit=crop&w=1200&q=80",
        an: 2022, km: "31 000", boite: "Automatique", carburant: "Diesel", places: 7, couleur: "Noir",
        loc: 95000, vente: 29500000, dispo: true,
        description: "Le 4x4 le plus recherché à Abidjan : fiable, puissant, spacieux jusqu'à 7 places. Parfait pour les familles et les longs trajets.",
        equipements: ["7 places", "4 roues motrices", "Climatisation 3 zones", "Grand coffre", "Excellente tenue de route"]
    },
    {
        id: "classec", nom: "Mercedes-Benz Classe C", marque: "Mercedes", img: "https://images.unsplash.com/photo-1593950315186-76a92975b60c?auto=format&fit=crop&w=1200&q=80",
        an: 2023, km: "18 000", boite: "Automatique", carburant: "Essence", places: 5, couleur: "Argent",
        loc: 65000, vente: 22800000, dispo: true,
        description: "L'élégance discrète d'une berline allemande premium. Confort de conduite exceptionnel pour vos rendez-vous d'affaires.",
        equipements: ["Sièges cuir", "Écran MBUX", "Aides à la conduite", "Ambiance lumineuse", "Finition premium"]
    }
];

const fmt = n => n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ") + " FCFA";

/* ---------- Réservations en direct (alimentées par ReservationStore) ---------- */
let liveReservations = {};
function activeReservations() {
    const now = Date.now();
    const out = {};
    Object.keys(liveReservations || {}).forEach(id => {
        const r = liveReservations[id];
        if (r && r.until > now) out[id] = r;
    });
    return out;
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

function lienAchat(v) {
    const params = new URLSearchParams({
        car: v.nom, id: v.id, img: v.img, price: v.vente, an: v.an, km: v.km
    });
    return `achat/index.html?${params.toString()}`;
}

/* ---------- Rendu des cartes ---------- */
function carteHTML(v, reservations, index) {
    const reservation = reservations[v.id];
    const isReservedNow = !!reservation;
    const dispoFinal = v.dispo && !isReservedNow;
    let badgeLabel = dispoFinal ? 'Disponible' : 'Réservé';
    let badgeSub = '';
    if (isReservedNow) {
        const remaining = formatRemaining(reservation.until - Date.now());
        badgeSub = `<span class="badge-timer">libère dans ${remaining}</span>`;
    }
    return `
    <div class="card reveal vehicle-card" data-id="${v.id}" style="transition-delay:${(index % 6) * 60}ms">
        <div class="img-container">
            <img src="${v.img}" alt="${v.nom}" loading="lazy">
            <span class="badge ${dispoFinal ? '' : 'badge-reserve'}">${badgeLabel}</span>
            ${badgeSub}
            <span class="card-shine"></span>
        </div>
        <div class="card-info">
            <h3>${v.nom}</h3>
            <div class="specs-row">
                <span class="spec-chip">${v.an}</span>
                <span class="spec-chip">${v.km} km</span>
                <span class="spec-chip">${v.boite}</span>
                <span class="spec-chip">${v.carburant}</span>
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

/* ---------- Modal détails véhicule ---------- */
const modal = document.getElementById('vehicleModal');
function openModal(id) {
    const v = VEHICLES.find(x => x.id === id);
    if (!v) return;
    const reservations = activeReservations();
    const reservation = reservations[v.id];
    const dispoFinal = v.dispo && !reservation;

    document.getElementById('modalImg').src = v.img;
    document.getElementById('modalImg').alt = v.nom;
    document.getElementById('modalTitle').textContent = v.nom;
    document.getElementById('modalBadge').textContent = dispoFinal ? 'Disponible' : 'Réservé';
    document.getElementById('modalBadge').className = 'badge modal-badge' + (dispoFinal ? '' : ' badge-reserve');
    document.getElementById('modalDesc').textContent = v.description;

    document.getElementById('modalSpecs').innerHTML = `
        <div class="modal-spec"><span>Année</span><strong>${v.an}</strong></div>
        <div class="modal-spec"><span>Kilométrage</span><strong>${v.km} km</strong></div>
        <div class="modal-spec"><span>Boîte</span><strong>${v.boite}</strong></div>
        <div class="modal-spec"><span>Carburant</span><strong>${v.carburant}</strong></div>
        <div class="modal-spec"><span>Places</span><strong>${v.places}</strong></div>
        <div class="modal-spec"><span>Couleur</span><strong>${v.couleur}</strong></div>
    `;
    document.getElementById('modalEquip').innerHTML = v.equipements.map(e => `<li>${e}</li>`).join('');
    document.getElementById('modalPriceLoc').textContent = fmt(v.loc) + ' / jour';
    document.getElementById('modalPriceVente').textContent = fmt(v.vente);
    document.getElementById('modalReserveBtn').onclick = () => { closeModal(); openReservationModal(v.id); };
    document.getElementById('modalAchatBtn').href = lienAchat(v);

    if (reservation) {
        const remaining = formatRemaining(reservation.until - Date.now());
        document.getElementById('modalTimer').hidden = false;
        document.getElementById('modalTimer').textContent = `⏱ Ce véhicule est actuellement réservé — disponible de nouveau dans ${remaining}.`;
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
// MODIFICATION : ajout de "identity: false" pour inclure la pièce d'identité dans la validation globale
const resValidState = { name: false, phone: false, duration: false, identity: false };

function openReservationModal(id) {
    const v = VEHICLES.find(x => x.id === id);
    if (!v) return;

    // PROTECTION : Bloque l'ouverture si le véhicule est déjà réservé
    const reservations = activeReservations();
    if (reservations[v.id]) {
        alert("Désolé, ce véhicule est actuellement réservé et ne peut pas être sélectionné.");
        return;
    }

    reservationCarId = id;

    document.getElementById('resCarName').textContent = v.nom;
    document.getElementById('resCarPrice').textContent = fmt(v.loc) + ' / jour';
    document.getElementById('resCarImg').src = v.img;

    // Reset du formulaire
    ['resName', 'resPhone', 'resIdentityDoc'].forEach(fid => {
        const el = document.getElementById(fid);
        if (el.type === 'file') el.value = '';
        else el.value = '';
        el.classList.remove('valid', 'invalid');
    });
    document.getElementById('resDuration').value = '';
    ['resNameError', 'resPhoneError', 'resDurationError', 'resIdentityDocError'].forEach(eid => {
        document.getElementById(eid).hidden = true;
    });
    resValidState.name = false; resValidState.phone = false; resValidState.duration = false; resValidState.identity = false;
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

// MODIFICATION : ajout de la fonction de validation pour la pièce d'identité
function validateResIdentity() {
    const el = document.getElementById('resIdentityDoc');
    const errorEl = document.getElementById('resIdentityDocError');
    if (!el.files || el.files.length === 0) {
        el.classList.add('invalid');
        el.classList.remove('valid');
        if (errorEl) {
            errorEl.textContent = "Veuillez joindre votre pièce d'identité.";
            errorEl.hidden = false;
        }
        resValidState.identity = false;
    } else {
        el.classList.remove('invalid');
        el.classList.add('valid');
        if (errorEl) errorEl.hidden = true;
        resValidState.identity = true;
    }
}

function refreshResSubmitState() {
    const allValid = Object.values(resValidState).every(Boolean);
    const btn = document.getElementById('resSubmitBtn');
    btn.disabled = !allValid;
    btn.classList.toggle('btn-ready', allValid);
}

function handleReservationSubmit(e) {
    e.preventDefault();
    validateResName(); 
    validateResPhone(); 
    validateResDuration(); 
    validateResIdentity(); // MODIFICATION : intégration de l'appel de validation de l'identité
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

    // Envoi des données en arrière-plan vers api/booking.php
    fetch('api/booking.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.warn("Avertissement enregistrement BDD :", data.message);
        }
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
        `Votre réservation pour la ${v.nom} est enregistrée pour ${durationLabel}. Le véhicule est maintenant affiché "Réservé" sur le site.`;
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

    ReservationStore.subscribe(res => {
        liveReservations = res || {};
        renderFleet(currentFilteredList());
    });

    /* ---------- Rafraîchissement automatique de l'interface des cartes ---------- */
    ReservationStore.subscribe(function(activeReservations) {
        // Parcourt tous les véhicules définis dans votre tableau VEHICLES
        VEHICLES.forEach(car => {
            // Sélectionne la carte correspondante grâce à son attribut data-id
            const card = document.querySelector(`.vehicle-card[data-id="${car.id}"]`);
            if (!card) return;

            const badge = card.querySelector('.badge');
            const reservation = activeReservations[car.id];
            const isReservedNow = !!reservation;
            const dispoFinal = car.dispo && !isReservedNow;

            // Met à jour dynamiquement le texte et le style du badge sans recharger la page
            if (badge) {
                badge.textContent = dispoFinal ? 'Disponible' : 'Réservé';
                if (dispoFinal) {
                    badge.classList.remove('badge-reserve');
                } else {
                    badge.classList.add('badge-reserve');
                }
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
    
    // Validation du champ fichier pièce d'identité
    const identityInput = document.getElementById('resIdentityDoc');
    if (identityInput) {
        identityInput.addEventListener('change', () => {
            validateResIdentity();
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