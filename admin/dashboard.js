// dashboard.js — logique complète du tableau de bord admin
 
const API_BASE = '../api/'; // dashboard.html est dans /admin/, l'API est dans /api/ (sibling)[cite: 6]
 
let currentVehicules = [];
let currentReservations = [];
let currentSales = [];
let currentAttente = []; // <-- Ajouté pour stocker les données de la table 'attente'[cite: 6]
let lastAttenteSig = ''; // <-- Ajouté pour le suivi des modifications de l'attente[cite: 6]
let editingVehicleId = null;
 
/* ---------- Utilitaires ---------- */
function fmt(n) {
    return Number(n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' FCFA';
}
function resolveImgSrc(img) {
    if (!img) return '';
    if (/^https?:\/\//i.test(img)) return img;
    return '../' + img; 
}

// Fonction utilitaire pour transformer un nom en slug (ex: "Toyota RAV4" -> "toyota-rav4")
function slugify(text) {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .replace(/\s+/g, '-')                            // Remplace les espaces par des tirets
        .replace(/[^\w\-]+/g, '')                        // Supprime les caractères spéciaux
        .replace(/\-\-+/g, '-');                         // Évite les tirets multiples
}

// Modale de confirmation personnalisée
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirmModalOverlay');
        const textEl = document.getElementById('confirmModalText');
        const cancelBtn = document.getElementById('confirmModalCancel');
        const submitBtn = document.getElementById('confirmModalSubmit');

        if (!overlay) {
            resolve(confirm(message)); // Fallback si la modale n'existe pas dans le HTML[cite: 6]
            return;
        }

        if (textEl) textEl.textContent = message;
        overlay.style.display = 'flex';

        const cleanup = (result) => {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', onCancel);
            submitBtn.removeEventListener('click', onSubmit);
            overlay.removeEventListener('click', onOverlayClick);
            resolve(result);
        };

        const onCancel = () => cleanup(false);
        const onSubmit = () => cleanup(true);
        const onOverlayClick = (e) => {
            if (e.target === overlay) cleanup(false);
        };

        cancelBtn.addEventListener('click', onCancel);
        submitBtn.addEventListener('click', onSubmit);
        overlay.addEventListener('click', onOverlayClick);
    });
}
 
/* ---------- Garde d'accès + init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(API_BASE + 'admin_check.php');
        const data = await res.json();
        if (!data.loggedIn) {
            window.location.href = 'admin.html';
            return;
        }
        const emailInput = document.getElementById('settingsEmail');
        if (emailInput) emailInput.value = data.email || '';
    } catch (err) {
        console.error('Impossible de vérifier la session admin', err);
        window.location.href = 'admin.html';
        return;
    }
 
    initTabs();
    initLogout();
    initVehicleModal();
    initVehicleDetailModal();
    initSettingsForm();
    initReservationsActions();
    initSalesModal(); 
    initBookingModal();

    await Promise.all([loadVehicules(), loadReservations(), loadSales(), loadAttente()]); // <-- Ajout de loadAttente()[cite: 6]
    updateStats();
});
 
/* ---------- Onglets ---------- */
function initTabs() {
    const tabs = document.querySelectorAll('.tab-link');
    const sections = document.querySelectorAll('.admin-section');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('data-target');
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        });
    });
}
 
/* ---------- Déconnexion ---------- */
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch(API_BASE + 'admin_logout.php');
        } catch (err) {
            console.error('Erreur lors de la déconnexion', err);
        } finally {
            window.location.href = 'admin.html';
        }
    });
}
 
/* ---------- Dossiers vérifiés (contrôle visuel de la CNI et du permis par l'admin) ---------- */
function verifyHtml(item, type) {
    const ok = Number(item.verified) === 1 || item.verified === true;
    const d = ok && item.verified_at ? new Date(String(item.verified_at).replace(' ', 'T')) : null;
    const when = d && !isNaN(d) ? ' le ' + d.toLocaleString('fr-FR') : '';
    const badge = ok
        ? `<span class="verify-badge verify-ok">✔ Vérifié${when}</span>`
        : `<span class="verify-badge verify-todo">À vérifier</span>`;
    const btn = `<button type="button" class="btn-verify" data-id="${item.id}" data-type="${type}" data-verified="${ok ? 0 : 1}">${ok ? 'Annuler la vérification' : '✔ Marquer comme vérifié'}</button>`;
    return `<div class="verify-box">${badge}${btn}</div>`;
}

async function setVerified(type, id, verified) {
    const isSale = type === 'sale';
    const list = isSale ? currentSales : currentReservations;
    const obj = list.find(x => String(x.id) === String(id));

    // Affichage immédiat, puis envoi au serveur
    if (obj) {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        obj.verified = verified ? 1 : 0;
        obj.verified_at = verified
            ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
            : null;
        if (isSale) renderSales(); else renderReservations();
        updateStats();
    }

    try {
        const res = await fetch(API_BASE + (isSale ? 'sales.php' : 'booking.php'), {
            method: 'POST',
            body: new URLSearchParams({ action: 'set_verified', id, verified: verified ? '1' : '0' })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');

        // Dossier validé : le message WhatsApp pour le client s'affiche dans la page admin[cite: 6]
        if (!isSale && obj) {
            if (verified) openWhatsAppNotice(obj);
            else waClear(obj.id);
        }
    } catch (err) {
        alert('Erreur lors de la mise à jour de la vérification : ' + err.message);
    }

    // Resynchronise avec le serveur (corrige l'affichage en cas d'erreur)[cite: 6]
    if (isSale) { lastSalesSig = ''; loadSales().then(updateStats); }
    else { lastReservationsSig = ''; loadReservations().then(updateStats); }
}

/* ---------- Message WhatsApp au client quand l'admin valide son dossier ---------- */
const WA_STORE_KEY = 'autonems_wa_notified';
let waCurrent = null;

function waStoreRead() {
    try { return JSON.parse(localStorage.getItem(WA_STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function waStoreWrite(map) {
    try { localStorage.setItem(WA_STORE_KEY, JSON.stringify(map)); } catch (e) {}
}
function waMarkOpened(id) { const m = waStoreRead(); m[String(id)] = new Date().toISOString(); waStoreWrite(m); }
function waClear(id) { const m = waStoreRead(); delete m[String(id)]; waStoreWrite(m); }

function toWhatsAppNumber(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    const CI = /^(01|05|07|21|23|25|27)\d{8}$/;
    if (d.startsWith('225')) return (d.length === 13 && CI.test(d.slice(3))) ? d : '';
    if (CI.test(d)) return '225' + d;
    if (!d.startsWith('0') && d.length >= 11 && d.length <= 15) return d;
    return '';
}

function buildWaMessage(nom, car) {
    return `Bonjour ${nom},\n\n` +
        `Votre dossier de réservation pour le véhicule « ${car} » chez AutoNems a été vérifié par notre administrateur ✅\n\n` +
        `Vous pouvez dès maintenant passer à l'agence pour prendre le véhicule. ` +
        `Il sera enregistré comme « Réservé » lors de votre venue.\n\n` +
        `Merci de votre confiance !\nL'équipe AutoNems`;
}

function waActionsHtml(item) {
    const ok = Number(item.verified) === 1 || item.verified === true;
    if (!ok) return '';
    const ts = waStoreRead()[String(item.id)];
    const d = ts ? new Date(ts) : null;
    const note = d && !isNaN(d) ? `<div class="wa-sent-note">✔ WhatsApp ouvert le ${d.toLocaleString('fr-FR')}</div>` : '';
    return `<button type="button" class="btn-wa" data-id="${item.id}">💬 Message WhatsApp</button>${note}`;
}

function ensureWaUi() {
    if (document.getElementById('waNoticeOverlay')) return;

    const style = document.createElement('style');
    style.textContent = `
.wa-overlay{position:fixed;inset:0;background:rgba(2,6,23,.72);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px;box-sizing:border-box}
.wa-overlay.open{display:flex}
.wa-card{background:#0f172a;color:#f8fafc;border:1px solid rgba(56,189,248,.4);border-radius:16px;padding:22px;width:100%;max-width:520px;max-height:92vh;overflow:auto;box-shadow:0 25px 50px rgba(0,0,0,.6);box-sizing:border-box;font-family:inherit}
.wa-card h3{margin:0 0 6px;font-size:1.25rem;color:#34d399}
.wa-to{margin:0 0 14px;color:#cbd5e1;font-size:.95rem}
.wa-label{display:block;margin-bottom:6px;font-size:.9rem;color:#e2e8f0}
.wa-card textarea{width:100%;box-sizing:border-box;min-height:190px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(15,23,42,.9);color:#fff;font:inherit;font-size:1rem;line-height:1.45;resize:vertical}
.wa-hint{margin:10px 0 0;font-size:.85rem;color:#94a3b8}
.wa-warn{margin:10px 0 0;padding:10px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.4);color:#fca5a5;font-size:.9rem}
.wa-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}
.wa-btn{border:none;border-radius:10px;padding:12px 18px;font-size:1rem;font-weight:600;cursor:pointer}
.wa-btn-primary{background:linear-gradient(135deg,#25d366,#128c7e);color:#fff}
.wa-btn-primary:disabled{opacity:.45;cursor:not-allowed}
.wa-btn-secondary{background:rgba(255,255,255,.12);color:#e2e8f0}
.btn-wa{display:block;margin-top:6px;background:#128c7e;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer}
.wa-sent-note{margin-top:6px;font-size:12px;font-weight:600;color:#34d399}
.wa-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#065f46;color:#fff;padding:12px 18px;border-radius:10px;z-index:10001;max-width:90vw;box-shadow:0 10px 30px rgba(0,0,0,.5);font-size:.95rem;display:none}
.wa-toast.show{display:block}`;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'waNoticeOverlay';
    overlay.className = 'wa-overlay';
    overlay.innerHTML = `
        <div class="wa-card" role="dialog" aria-modal="true" aria-labelledby="waNoticeTitle">
            <h3 id="waNoticeTitle">✔ Dossier vérifié</h3>
            <p class="wa-to" id="waNoticeTo"></p>
            <label class="wa-label" for="waNoticeText">Message à envoyer au client (modifiable)</label>
            <textarea id="waNoticeText" rows="9"></textarea>
            <p class="wa-warn" id="waNoticeWarn" hidden></p>
            <p class="wa-hint">WhatsApp s'ouvre avec ce message déjà écrit : il reste à appuyer sur « Envoyer » dans WhatsApp.</p>
            <div class="wa-actions">
                <button type="button" class="wa-btn wa-btn-secondary" id="waNoticeLater">Plus tard</button>
                <button type="button" class="wa-btn wa-btn-primary" id="waNoticeSend">Envoyer sur WhatsApp</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const toast = document.createElement('div');
    toast.id = 'waToast';
    toast.className = 'wa-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);

    document.getElementById('waNoticeLater').addEventListener('click', closeWhatsAppNotice);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeWhatsAppNotice(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeWhatsAppNotice(); });

    document.getElementById('waNoticeSend').addEventListener('click', () => {
        if (!waCurrent || !waCurrent.number) return;
        const text = document.getElementById('waNoticeText').value.trim();
        if (!text) return;
        window.open(`https://wa.me/${waCurrent.number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        waMarkOpened(waCurrent.id);
        const nom = waCurrent.nom;
        closeWhatsAppNotice();
        showWaToast(`WhatsApp ouvert pour ${nom} : le message est prêt, appuyez sur « Envoyer » dans WhatsApp.`);
        renderReservations();
    });
}

let waToastTimer = null;
function showWaToast(text) {
    const t = document.getElementById('waToast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(waToastTimer);
    waToastTimer = setTimeout(() => t.classList.remove('show'), 7000);
}

function openWhatsAppNotice(r) {
    ensureWaUi();
    const nom = r.client_nom || 'Client';
    const car = r.car_name || 'votre véhicule';
    const number = toWhatsAppNumber(r.client_telephone);
    waCurrent = { id: r.id, nom, number };

    document.getElementById('waNoticeTo').textContent = `Pour : ${nom} — ${r.client_telephone || 'numéro manquant'}`;
    document.getElementById('waNoticeText').value = buildWaMessage(nom, car);

    const warn = document.getElementById('waNoticeWarn');
    const send = document.getElementById('waNoticeSend');
    if (number) {
        warn.hidden = true;
        send.disabled = false;
    } else {
        warn.textContent = "Numéro WhatsApp invalide ou manquant : impossible d'ouvrir WhatsApp pour ce client. Corrigez son numéro ou appelez-le directement.";
        warn.hidden = false;
        send.disabled = true;
    }
    document.getElementById('waNoticeOverlay').classList.add('open');
    if (number) send.focus();
}

function closeWhatsAppNotice() {
    const overlay = document.getElementById('waNoticeOverlay');
    if (overlay) overlay.classList.remove('open');
}

/* ---------- Stats ---------- */
function updateStats() {
    const total = currentVehicules.length;
    const dispo = currentVehicules.filter(v => v.dispo).length;
    const enCours = currentReservations.filter(r => !r.hold_expired && (r.en_cours || r.statut === 'En cours' || r.statut === 'Confirmée')).length;
    const totalReservations = currentReservations.length;
    const totalSales = currentSales.length;
 
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDispo').textContent = dispo;
    document.getElementById('statEnCours').textContent = enCours;
    document.getElementById('statReservations').textContent = totalReservations;
    
    const statVentes = document.getElementById('statVentes');
    if (statVentes) statVentes.textContent = totalSales;

    const statAVerifier = document.getElementById('statAVerifier');
    if (statAVerifier) {
        const todoRes = currentReservations.filter(r => Number(r.verified) !== 1 && (r.statut || 'En cours') !== 'Terminée').length;
        const todoSales = currentSales.filter(s => Number(s.verified) !== 1).length;
        statAVerifier.textContent = todoRes + todoSales;
    }
}
 
/* ---------- Chargement + rendu des véhicules ---------- */
async function loadVehicules() {
    const tbody = document.getElementById('stockTableBody');
    try {
        const res = await fetch(API_BASE + 'vehicules.php?action=list');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
        currentVehicules = data.vehicules || [];
        renderVehicules();
    } catch (err) {
        console.error(err);
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Erreur de chargement des véhicules.</td></tr>`;
    }
}
 
function renderVehicules() {
    const tbody = document.getElementById('stockTableBody');
    if(!tbody) return;
    if (!currentVehicules.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Aucun véhicule pour le moment. Clique sur "+ Ajouter une nouvelle voiture".</td></tr>`;
        return;
    }
    tbody.innerHTML = currentVehicules.map(v => `
        <tr class="veh-row" data-id="${v.id}" title="Cliquer pour voir tous les détails">
            <td><img class="table-thumb" loading="lazy" decoding="async" src="${resolveImgSrc(v.img)}" alt="${v.nom}" onerror="this.style.visibility='hidden'" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;"></td>
            <td class="veh-nom">${v.nom}</td>
            <td class="veh-marque">${v.marque || '—'}</td>
            <td class="veh-loc">${fmt(v.loc)}</td>
            <td class="veh-vente">${fmt(v.vente)}</td>
            <td><span class="badge ${v.dispo ? '' : 'badge-off'}">${v.dispo ? 'Disponible' : 'Indisponible'}</span></td>
            <td>
                <button class="btn-icon btn-edit" data-id="${v.id}" title="Modifier" style="background:#10b981; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; margin-right:5px;" aria-label="Modifier">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon btn-delete" data-id="${v.id}" title="Supprimer" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" aria-label="Supprimer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        </tr>
    `).join('');
 
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openVehicleModal(String(btn.dataset.id)));
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteVehicule(String(btn.dataset.id)));
    });

    tbody.querySelectorAll('tr.veh-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('button, a')) return;
            openVehicleDetail(String(row.dataset.id));
        });
    });
}
 
async function deleteVehicule(id) {
    const v = currentVehicules.find(x => String(x.id) === String(id));
    const confirmed = await showConfirmDialog(`Supprimer "${v ? v.nom : id}" ? Cette action est définitive.`);
    if (!confirmed) return;
 
    try {
        const res = await fetch(API_BASE + 'vehicules.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'delete', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        await loadVehicules();
        updateStats();
    } catch (err) {
        alert('Erreur lors de la suppression : ' + err.message);
    }
}
 
/* ---------- Fiche détaillée d'un véhicule ---------- */
function escHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDateTime(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(' ', 'T'));
    return isNaN(d) ? '' : d.toLocaleString('fr-FR');
}

let detailVehicleId = null;

function openVehicleDetail(id) {
    const v = currentVehicules.find(x => String(x.id) === String(id));
    const overlay = document.getElementById('vehicleDetailOverlay');
    const body = document.getElementById('vehicleDetailBody');
    if (!v || !overlay || !body) return;
    detailVehicleId = String(v.id);

    const imgSrc = resolveImgSrc(v.img);
    const equip = Array.isArray(v.equipements) ? v.equipements : [];
    const kmText = v.km ? (/[a-z]/i.test(String(v.km)) ? String(v.km) : v.km + ' km') : '';

    const specs = [
        ['Marque', v.marque], ['Année', v.an || ''], ['Kilométrage', kmText], ['Boîte', v.boite],
        ['Carburant', v.carburant], ['Places', v.places], ['Couleur', v.couleur],
        ['Location / jour', fmt(v.loc)], ['Prix de vente', fmt(v.vente)]
    ];
    const specsHtml = specs.map(([label, value]) => `
        <div class="veh-detail-item">
            <span class="veh-detail-label">${label}</span>
            <span class="veh-detail-value">${(value || value === 0) ? escHtml(value) : '—'}</span>
        </div>`).join('');

    const slug = slugify(v.nom);
    const now = Date.now();
    const activeRes = currentReservations.find(r =>
        r.car_id === slug && r.en_cours !== false && (r.statut || 'En cours') !== 'Terminée' &&
        (((r.statut || 'En cours') === 'En cours' && r.hold_until)
            ? Number(r.hold_until) > now                          
            : (!Number(r.until_ts) || Number(r.until_ts) > now)));
    let reservHtml = '';
    if (activeRes) {
        const st = activeRes.statut || 'En cours';
        reservHtml = `
            <h4 class="veh-detail-sub">Réservation en cours</h4>
            <div class="veh-detail-reserv">
                <strong>${escHtml(STATUT_LABELS[st] || st)}</strong> — ${escHtml(activeRes.client_nom || 'Client')}${activeRes.client_telephone ? ' · ' + escHtml(activeRes.client_telephone) : ''}
                ${activeRes.duree_label ? '<br>Durée : ' + escHtml(activeRes.duree_label) : ''}
            </div>`;
    }

    const created = fmtDateTime(v.created_at);
    const updated = fmtDateTime(v.updated_at);
    const datesHtml = (created || updated)
        ? `<p class="veh-detail-dates">${created ? 'Ajouté le ' + created : ''}${created && updated ? ' · ' : ''}${updated ? 'Modifié le ' + updated : ''}</p>`
        : '';

    document.getElementById('vehicleDetailTitle').textContent = v.nom || 'Détails du véhicule';
    body.innerHTML = `
        ${imgSrc ? `<img class="veh-detail-img" src="${escHtml(imgSrc)}" alt="${escHtml(v.nom)}" onerror="this.style.display='none'">` : ''}
        <div class="veh-detail-head">
            <h3>${escHtml(v.nom)}</h3>
            <span class="badge ${v.dispo ? '' : 'badge-off'}">${v.dispo ? 'Disponible' : 'Indisponible'}</span>
        </div>
        <div class="veh-detail-grid">${specsHtml}</div>
        ${v.description ? `<h4 class="veh-detail-sub">Description</h4><p class="veh-detail-desc">${escHtml(v.description)}</p>` : ''}
        ${equip.length ? `<h4 class="veh-detail-sub">Équipements</h4><ul class="veh-detail-equip">${equip.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>` : ''}
        ${reservHtml}
        ${datesHtml}
    `;
    overlay.classList.add('open');
}

function closeVehicleDetail() {
    const overlay = document.getElementById('vehicleDetailOverlay');
    if (overlay) overlay.classList.remove('open');
    detailVehicleId = null;
}

function initVehicleDetailModal() {
    const overlay = document.getElementById('vehicleDetailOverlay');
    const closeX = document.getElementById('vehicleDetailClose');
    const closeBtn = document.getElementById('vehicleDetailCloseBtn');
    const editBtn = document.getElementById('vehicleDetailEditBtn');

    if (closeX) closeX.addEventListener('click', closeVehicleDetail);
    if (closeBtn) closeBtn.addEventListener('click', closeVehicleDetail);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVehicleDetail(); });
    if (editBtn) editBtn.addEventListener('click', () => {
        const id = detailVehicleId;
        closeVehicleDetail();
        if (id) openVehicleModal(id);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeVehicleDetail(); });
}

/* ---------- Modal ajout/modification véhicule ---------- */
function initVehicleModal() {
    const overlay = document.getElementById('vehicleModalOverlay');
    const openBtn = document.getElementById('openAddCarModalBtn');
    const closeBtn = document.getElementById('vehicleModalClose');
    const cancelBtn = document.getElementById('vehicleFormCancel');
    const form = document.getElementById('vehicleForm');
    const fileInput = document.getElementById('vehImageFile');
    const urlInput = document.getElementById('vehImageUrl');
    const preview = document.getElementById('vehImagePreview');
 
    if(openBtn) openBtn.addEventListener('click', () => openVehicleModal(null));
    if(closeBtn) closeBtn.addEventListener('click', closeVehicleModal);
    if(cancelBtn) cancelBtn.addEventListener('click', closeVehicleModal);
    if(overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVehicleModal(); });
 
    if(fileInput) fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            preview.src = URL.createObjectURL(fileInput.files[0]);
            preview.style.display = 'block';
        }
    });
    if(urlInput) urlInput.addEventListener('input', () => {
        if (urlInput.value.trim()) {
            preview.src = urlInput.value.trim();
            preview.style.display = 'block';
        }
    });
 
    if(form) form.addEventListener('submit', handleVehicleFormSubmit);
}
 
function openVehicleModal(id) {
    editingVehicleId = id;
    const form = document.getElementById('vehicleForm');
    if(!form) return;
    form.reset();
    
    const errorBox = document.getElementById('vehicleFormError');
    if(errorBox) errorBox.style.display = 'none';
    
    const preview = document.getElementById('vehImagePreview');
    if(preview) preview.style.display = 'none';
 
    if (id !== null) {
        const v = currentVehicules.find(x => String(x.id) === String(id));
        if (!v) return;
        document.getElementById('vehicleModalTitle').textContent = 'Modifier : ' + v.nom;
        document.getElementById('vehId').value = v.id;
        document.getElementById('vehNom').value = v.nom || '';
        document.getElementById('vehMarque').value = v.marque || '';
        document.getElementById('vehAn').value = v.an || '';
        document.getElementById('vehKm').value = v.km || '';
        document.getElementById('vehCouleur').value = v.couleur || '';
        document.getElementById('vehBoite').value = v.boite || 'Automatique';
        document.getElementById('vehCarburant').value = v.carburant || 'Essence';
        document.getElementById('vehPlaces').value = v.places || 5;
        document.getElementById('vehDispo').checked = !!v.dispo;
        document.getElementById('vehLoc').value = v.loc || '';
        document.getElementById('vehVente').value = v.vente || '';
        document.getElementById('vehDescription').value = v.description || '';
        document.getElementById('vehEquipements').value = (v.equipements || []).join('\n');
        document.getElementById('vehImageUrl').value = /^https?:\/\//i.test(v.img || '') ? v.img : '';
        if (v.img && preview) {
            preview.src = resolveImgSrc(v.img);
            preview.style.display = 'block';
        }
    } else {
        document.getElementById('vehicleModalTitle').textContent = 'Ajouter un véhicule';
        document.getElementById('vehId').value = '';
    }
 
    const overlay = document.getElementById('vehicleModalOverlay');
    if(overlay) overlay.classList.add('open');
}
 
function closeVehicleModal() {
    const overlay = document.getElementById('vehicleModalOverlay');
    if(overlay) overlay.classList.remove('open');
    editingVehicleId = null;
}
 
async function handleVehicleFormSubmit(e) {
    e.preventDefault();
    const errorBox = document.getElementById('vehicleFormError');
    const submitBtn = document.getElementById('vehicleFormSubmit');
    if(errorBox) errorBox.style.display = 'none';
 
    const form = document.getElementById('vehicleForm');
    const formData = new FormData(form);
    formData.set('action', editingVehicleId ? 'update' : 'create');
 
    const rawEquip = formData.get('equipements_raw') || '';
    formData.delete('equipements_raw');
    String(rawEquip).split('\n').map(s => s.trim()).filter(Boolean).forEach(item => {
        formData.append('equipements[]', item);
    });
 
    if (!document.getElementById('vehDispo').checked) {
        formData.delete('dispo');
    }
 
    if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enregistrement...';
    }
 
    try {
        const res = await fetch(API_BASE + 'vehicules.php', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
 
        closeVehicleModal();
        await loadVehicules();
        updateStats();
    } catch (err) {
        if(errorBox) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
        }
    } finally {
        if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer';
        }
    }
}
 
/* ---------- Chargement + rendu des réservations & file d'attente ---------- */
const STATUT_LABELS = { 'En cours': 'En cours de réservation', 'Confirmée': 'Réservé', 'Terminée': 'Terminée', 'liste_attente': "Liste d'attente" };

function formatChrono(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (d > 0) return `${d} j ${h} h ${m} min`;
    if (h > 0) return `${h} h ${m} min ${sec} s`;
    return `${m} min ${sec} s`;
}
function renderChronoText(el) {
    const remaining = Number(el.dataset.until) - Date.now();
    if (remaining > 0) {
        el.textContent = '⏱ libère dans ' + formatChrono(remaining);
        el.style.color = '#d97706';
    } else {
        el.textContent = '⏱ Délai dépassé';
        el.style.color = '#ef4444';
    }
}
function tickChronos() {
    if (document.hidden) return;
    document.querySelectorAll('.admin-chrono').forEach(renderChronoText);
}
setInterval(tickChronos, 1000);

let lastReservationsSig = '';
let lastSalesSig = '';

async function loadReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    const waitingBody = document.getElementById('waitingTableBody');
    try {
        const res = await fetch(API_BASE + 'booking.php?action=list');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
        const nextReservations = data.reservations || [];
        const sig = JSON.stringify(nextReservations);
        if (sig === lastReservationsSig) return;
        lastReservationsSig = sig;
        currentReservations = nextReservations;
        renderReservations();
    } catch (err) {
        console.error(err);
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Erreur de chargement des réservations.</td></tr>`;
        if(waitingBody) waitingBody.innerHTML = `<tr class="empty-row"><td colspan="8">Erreur de chargement de la file d'attente.</td></tr>`;
    }
}

// Fonction pour charger la file d'attente indépendante depuis attente.php
async function loadAttente() {
    const waitingBody = document.getElementById('waitingTableBody');
    try {
        const res = await fetch(API_BASE + 'attente.php?action=list');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
        const nextAttente = data.attente || [];
        const sig = JSON.stringify(nextAttente);
        if (sig === lastAttenteSig) return;
        lastAttenteSig = sig;
        currentAttente = nextAttente;
        renderWaitingList();
    } catch (err) {
        console.error(err);
        if(waitingBody) waitingBody.innerHTML = `<tr class="empty-row"><td colspan="8">Erreur de chargement de la file d'attente.</td></tr>`;
    }
}

// Rendu de la File d'attente séparée depuis currentAttente
function renderWaitingList() {
    const tbody = document.getElementById('waitingTableBody');
    if (!tbody) return;

    if (!currentAttente.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Aucun client en file d'attente actuellement.</td></tr>`;
        return;
    }

    tbody.innerHTML = currentAttente.map(r => {
        const idCardPath = r.id_card || r.identity_doc;
        const licensePath = r.driver_license_file || r.driver_license_path;

        const idCardHtml = idCardPath ? `<a href="${resolveImgSrc(idCardPath)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(idCardPath)}" alt="CNI" style="width:35px; height:35px; object-fit:cover; border-radius:4px;" title="Voir CNI"></a>` : '';
        const licenseHtml = licensePath ? `<a href="${resolveImgSrc(licensePath)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(licensePath)}" alt="Permis" style="width:35px; height:35px; object-fit:cover; border-radius:4px;" title="Voir Permis"></a>` : '';

        const cniCell = [r.id_card_number ? `<strong>CNI :</strong> ${r.id_card_number}` : '', idCardHtml].filter(Boolean).join('<br>') || '—';
        const permisCell = [r.driver_license ? `<strong>Permis :</strong> ${r.driver_license}` : '', licenseHtml].filter(Boolean).join('<br>') || '—';

        // Intégration du bouton WhatsApp pour notifier que l'ancienne réservation est finie
        const waText = encodeURIComponent(`Bonjour ${r.client_nom},\n\nL'ancienne réservation pour le véhicule « ${r.car_name} » chez AutoNems est maintenant terminée. Le véhicule est libre, vous pouvez venir à l'agence pour lancer votre réservation !\n\nÀ très bientôt,\nL'équipe AutoNems`);
        const waPhone = toWhatsAppNumber(r.client_telephone);
        const waBtnHtml = waPhone 
            ? `<a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" class="btn-icon" title="Envoyer un message WhatsApp" style="background:#25d366; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; text-decoration:none; display:inline-block; margin-right:5px;" aria-label="WhatsApp">💬</a>` 
            : '';

        return `
            <tr>
                <td><strong>${r.client_nom || 'Client'}</strong></td>
                <td>${r.client_telephone || '—'}</td>
                <td>${r.car_name || 'Véhicule'}</td>
                <td>${cniCell}</td>
                <td>${permisCell}</td>
                <td><span class="badge" style="background:#d97706; color:#fff;">En attente</span></td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : '—'}</td>
                <td>
                    ${waBtnHtml}
                    <button class="btn-icon btn-promote" data-id="${r.id}" title="Transformer en réservation active" style="background:#2563eb; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-right:5px; font-size:12px; font-weight:600;" aria-label="Transformer en réservation">
                        🚀 Activer
                    </button>
                    <button class="btn-icon btn-delete-attente" data-id="${r.id}" title="Supprimer" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" aria-label="Supprimer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.btn-delete-attente').forEach(btn => {
        btn.addEventListener('click', () => deleteAttente(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-promote').forEach(btn => {
        btn.addEventListener('click', () => promoteWaitingReservation(btn.dataset.id));
    });
}

// Fonction pour promouvoir une personne de la file d'attente vers une réservation active via attente.php
async function promoteWaitingReservation(id) {
    const confirmed = await showConfirmDialog("Voulez-vous promouvoir ce client en réservation active ?");
    if (!confirmed) return;
    try {
        const res = await fetch(API_BASE + 'attente.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'promote', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        lastAttenteSig = '';
        lastReservationsSig = '';
        pollOnce();
    } catch (err) {
        alert('Erreur : ' + err.message);
    }
}

// Fonction pour supprimer un élément de la file d'attente via attente.php
async function deleteAttente(id) {
    const confirmed = await showConfirmDialog("Voulez-vous supprimer ce client de la file d'attente ?");
    if (!confirmed) return;
    try {
        const res = await fetch(API_BASE + 'attente.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'delete', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        lastAttenteSig = '';
        loadAttente();
    } catch (err) {
        alert('Erreur : ' + err.message);
    }
}
 
function renderReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    if(!tbody) return;
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('status-select')) { lastReservationsSig = ''; return; }
    
    // Exclure la liste d'attente du tableau principal des réservations actives/terminées
    const activeReservationsList = currentReservations.filter(r => (r.statut || '').toLowerCase() !== 'liste_attente');

    if (!activeReservationsList.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Aucune réservation active pour le moment.</td></tr>`;
        return;
    }
    tbody.innerHTML = activeReservationsList.map(r => {
        const idCardPath = r.id_card || r.identity_doc;
        const licensePath = r.driver_license_file || r.driver_license_path;

        const idCardHtml = idCardPath ? `<a href="${resolveImgSrc(idCardPath)}" target="_blank"><img class="table-thumb" loading="lazy" decoding="async" src="${resolveImgSrc(idCardPath)}" alt="CNI" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="Voir CNI"></a>` : '';
        const licenseHtml = licensePath ? `<a href="${resolveImgSrc(licensePath)}" target="_blank"><img class="table-thumb" loading="lazy" decoding="async" src="${resolveImgSrc(licensePath)}" alt="Permis" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="Voir Permis"></a>` : '';

        const cniNum = r.id_card_number ? `<strong>CNI :</strong> ${r.id_card_number}` : '';
        const licenseNum = r.driver_license ? `<strong>Permis :</strong> ${r.driver_license}` : '';

        const cniCell = [cniNum, idCardHtml].filter(Boolean).join('<br>') || '—';
        const permisCell = [licenseNum, licenseHtml].filter(Boolean).join('<br>') || '—';

        const statut = r.statut || (r.en_cours ? 'En cours' : 'Terminée');
        const isOff = statut === 'Terminée' || r.en_cours === false;

        const chronoHtml = (statut === 'Confirmée' && Number(r.until_ts))
            ? `<br><small class="admin-chrono" data-until="${Number(r.until_ts)}" style="font-weight:600;"></small>`
            : '';

        return `
            <tr>
                <td><strong>${r.client_nom || 'Client'}</strong></td>
                <td>${r.client_telephone || '—'}</td>
                <td>${r.car_name || 'Véhicule'}</td>
                <td>${r.duree_label || '—'}${chronoHtml}</td>
                <td>${cniCell}</td>
                <td>${permisCell}</td>
                <td>
                    <span class="badge ${isOff ? 'badge-off' : ''}">${STATUT_LABELS[statut] || statut}</span>
                    ${r.hold_expired ? '<br><small style="color:#b45309;font-weight:600;">⏱ Délai dépassé : le véhicule n\'est plus bloqué par ce dossier</small>' : ''}
                    <select class="status-select" data-id="${r.id}" style="display:block; margin-top:6px; padding:4px 6px; border-radius:6px; font-size:12px;">
                        <option value="En cours" ${statut === 'En cours' ? 'selected' : ''}>En cours de réservation</option>
                        <option value="Confirmée" ${statut === 'Confirmée' ? 'selected' : ''} ${(statut !== 'Confirmée' && Number(r.verified) !== 1) ? 'disabled' : ''}>Réservé${(statut !== 'Confirmée' && Number(r.verified) !== 1) ? " 🔒 (vérifier d'abord)" : ''}</option>
                        <option value="Terminée" ${statut === 'Terminée' ? 'selected' : ''}>Terminée</option>
                    </select>
                </td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : '—'}</td>
                <td>
                    ${verifyHtml(r, 'reservation')}${waActionsHtml(r)}
                    <button class="btn-icon btn-delete" data-id="${r.id}" title="Supprimer" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" aria-label="Supprimer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
 
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteReservation(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', () => setVerified(btn.dataset.type, btn.dataset.id, btn.dataset.verified === '1'));
    });

    tbody.querySelectorAll('.btn-wa').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = currentReservations.find(item => String(item.id) === String(btn.dataset.id));
            if (r) openWhatsAppNotice(r);
        });
    });

    tbody.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const id = sel.dataset.id;
            const newStatut = sel.value;

            const resCheck = currentReservations.find(item => String(item.id) === String(id));
            if (newStatut === 'Confirmée' && resCheck && Number(resCheck.verified) !== 1 && resCheck.statut !== 'Confirmée') {
                alert("Dossier non vérifié : vérifiez les photos CNI / permis puis cliquez sur « Marquer comme vérifié » avant de passer la réservation à « Réservé ».");
                sel.value = resCheck.statut || 'En cours';
                sel.blur();
                return;
            }

            const resObj = currentReservations.find(item => String(item.id) === String(id));
            if (resObj) {
                resObj.statut = newStatut;
                if (newStatut === 'Terminée') {
                    resObj.en_cours = false;
                }
            }
            sel.blur();
            renderReservations();
            updateStats();

            await updateReservationStatus(id, newStatut);
        });
    });

    tickChronos();
}

async function updateReservationStatus(id, statut) {
    try {
        const res = await fetch(API_BASE + 'booking.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'update_status', id, statut })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (statut === 'Confirmée') { lastReservationsSig = ''; pollOnce(); }
    } catch (err) {
        alert('Erreur lors du changement de statut : ' + err.message);
        lastReservationsSig = '';
        pollOnce();
    }
}
 
function pollOnce() {
    Promise.all([loadReservations(), loadSales(), loadAttente()]).then(updateStats); // <-- Ajout de loadAttente()[cite: 6]
}

function initReservationsActions() {
    let pollTick = 0;
    setInterval(() => {
        if (document.hidden) return;
        pollTick++;
        const jobs = [loadReservations(), loadAttente()]; // <-- Ajout de loadAttente()[cite: 6]
        if (pollTick % 4 === 0) jobs.push(loadSales());
        Promise.all(jobs).then(updateStats);
    }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pollOnce(); });
}
 
async function deleteReservation(id) {
    const confirmed = await showConfirmDialog('Voulez-vous vraiment supprimer cette réservation ?');
    if (!confirmed) return;
    try {
        const res = await fetch(API_BASE + 'booking.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'delete', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        pollOnce();
    } catch (err) {
        alert('Erreur lors de la suppression : ' + err.message);
    }
}

/* ---------- Gestion de l'ajout manuel de réservation ---------- */
function initBookingModal() {
    const overlay = document.getElementById('bookingModalOverlay');
    const openBtn = document.getElementById('openAddBookingModalBtn');
    const closeBtn = document.getElementById('bookingModalClose');
    const cancelBtn = document.getElementById('bookingFormCancel');
    const form = document.getElementById('bookingForm');

    if(openBtn) openBtn.addEventListener('click', async () => { 
        const select = document.getElementById('bookingCarId');
        
        await loadVehicules();

        if (select) {
            select.innerHTML = '<option value="">-- Choisir un véhicule --</option>' + 
                currentVehicules.map(v => {
                    const carSlug = slugify(v.nom);
                    return `<option value="${carSlug}">${v.nom} (${v.marque || ''})</option>`;
                }).join('');
        }
        if(overlay) overlay.classList.add('open'); 
    });

    if(closeBtn) closeBtn.addEventListener('click', () => { if(overlay) overlay.classList.remove('open'); });
    if(cancelBtn) cancelBtn.addEventListener('click', () => { if(overlay) overlay.classList.remove('open'); });
    if(overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalText = submitBtn.textContent;
                submitBtn.textContent = 'Enregistrement...';
            }

            const formData = new FormData(form);
            formData.set('action', 'create');

            try {
                const res = await fetch(API_BASE + 'booking.php', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);

                overlay.classList.remove('open');
                form.reset();
                pollOnce();
            } catch (err) {
                alert('Erreur : ' + err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitBtn.dataset.originalText || 'Enregistrer';
                }
            }
        });
    }
}

/* ---------- Gestion des Voitures Vendues ---------- */
async function loadSales() {
    const tbody = document.getElementById('salesTableBody');
    try {
        const res = await fetch(API_BASE + 'sales.php?action=list');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
        const nextSales = data.sales || [];
        const sig = JSON.stringify(nextSales);
        if (sig === lastSalesSig) return;
        lastSalesSig = sig;
        currentSales = nextSales;
        renderSales();
    } catch (err) {
        console.error("Erreur ventes :", err);
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="10">Erreur de chargement des ventes.</td></tr>`;
    }
}

function renderSales() {
    const tbody = document.getElementById('salesTableBody');
    if(!tbody) return;
    if (!currentSales.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="10">Aucune vente enregistrée pour le moment.</td></tr>`;
        return;
    }
    tbody.innerHTML = currentSales.map(s => {
        const cniHtml = s.id_card_path 
            ? `<a href="${resolveImgSrc(s.id_card_path)}" target="_blank"><img class="table-thumb" loading="lazy" decoding="async" src="${resolveImgSrc(s.id_card_path)}" alt="CNI" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="${s.id_card_number || 'Voir CNI'}"></a>` 
            : (s.id_card_number || '—');

        const permisHtml = s.driver_license_path 
            ? `<a href="${resolveImgSrc(s.driver_license_path)}" target="_blank"><img class="table-thumb" loading="lazy" decoding="async" src="${resolveImgSrc(s.driver_license_path)}" alt="Permis" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="${s.driver_license_number || 'Voir Permis'}"></a>` 
            : (s.driver_license_number || '—');

        return `
            <tr>
                <td><strong>${s.buyer_nom}</strong></td>
                <td><a href="https://wa.me/${s.buyer_telephone}" target="_blank">${s.buyer_telephone}</a></td>
                <td>${s.car_name}</td>
                <td><span class="badge">${s.payment_method || '—'}</span></td>
                <td>${cniHtml}</td>
                <td>${permisHtml}</td>
                <td><strong style="color:#34d399;">${fmt(s.sale_price)}</strong></td>
                <td>${saleStatutHtml(s)}</td>
                <td>${s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : '—'}</td>
                <td>
                    ${verifyHtml(s, 'sale')}
                    <button class="btn-icon btn-delete-sale" data-id="${s.id}" title="Supprimer" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" aria-label="Supprimer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.btn-delete-sale').forEach(btn => {
        btn.addEventListener('click', () => deleteSale(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', () => setVerified(btn.dataset.type, btn.dataset.id, btn.dataset.verified === '1'));
    });

    tbody.querySelectorAll('.sale-statut-select').forEach(sel => {
        sel.addEventListener('change', () => changeSaleStatut(sel.dataset.id, sel.value, sel));
    });
}

function saleStatutHtml(s) {
    const statut = s.statut || 'achete';
    if (statut === 'achete') return '<span class="badge">Acheté</span>';
    const verified = Number(s.verified) === 1;
    return `
        <span class="badge" style="background:rgba(124,58,237,.9);color:#fff;">En cours d'achat</span>
        <select class="sale-statut-select" data-id="${s.id}" style="display:block; margin-top:6px; padding:4px 6px; border-radius:6px; font-size:12px;">
            <option value="en_cours" selected>En cours d'achat</option>
            <option value="achete" ${verified ? '' : 'disabled'}>Acheté${verified ? '' : " 🔒 (vérifier d'abord)"}</option>
        </select>`;
}

async function changeSaleStatut(id, statut, selectEl) {
    const sale = currentSales.find(x => String(x.id) === String(id));
    if (!sale) return;
    if (statut !== 'achete') return;

    if (Number(sale.verified) !== 1) {
        alert("Dossier non vérifié : vérifiez la CNI et le permis puis cliquez sur « Marquer comme vérifié » avant de passer à « Acheté ».");
        if (selectEl) selectEl.value = 'en_cours';
        return;
    }

    const confirmed = await showConfirmDialog(
        `Confirmer l'achat de « ${sale.car_name} » par ${sale.buyer_nom} ? Le véhicule sera retiré du site, du catalogue et de la base de données.`);
    if (!confirmed) { if (selectEl) selectEl.value = 'en_cours'; return; }

    try {
        const res = await fetch(API_BASE + 'sales.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'set_statut', id, statut: 'achete' })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
    } catch (err) {
        alert('Erreur lors du changement de statut : ' + err.message);
        if (selectEl) selectEl.value = 'en_cours';
        return;
    }

    try {
        await loadVehicules();
        const slug = slugify(sale.car_name);
        const veh = currentVehicules.find(v => slugify(v.nom) === slug);
        if (veh) {
            const res = await fetch(API_BASE + 'vehicules.php', {
                method: 'POST',
                body: new URLSearchParams({ action: 'delete', id: veh.id })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Erreur inconnue');
        }
    } catch (err) {
        alert("Le statut est bien passé à « Acheté », mais le véhicule n'a pas pu être retiré du catalogue : " + err.message + "\nSupprimez-le manuellement dans l'onglet Catalogue.");
    }

    lastSalesSig = '';
    await Promise.all([loadVehicules(), loadSales()]);
    updateStats();
}

function initSalesModal() {
    const overlay = document.getElementById('saleModalOverlay');
    const openBtn = document.getElementById('openAddSaleModalBtn');
    const closeBtn = document.getElementById('saleModalClose');
    const cancelBtn = document.getElementById('saleFormCancel');
    const form = document.getElementById('saleForm');

    if(openBtn) openBtn.addEventListener('click', () => { if(overlay) overlay.classList.add('open'); });
    if(closeBtn) closeBtn.addEventListener('click', () => { if(overlay) overlay.classList.remove('open'); });
    if(cancelBtn) cancelBtn.addEventListener('click', () => { if(overlay) overlay.classList.remove('open'); });
    if(overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalText = submitBtn.textContent;
                submitBtn.textContent = 'Enregistrement...';
            }

            const formData = new FormData(form);
            formData.set('action', 'create');

            try {
                const res = await fetch(API_BASE + 'sales.php', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);

                overlay.classList.remove('open');
                form.reset();
                pollOnce();
            } catch (err) {
                alert('Erreur : ' + err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitBtn.dataset.originalText || 'Enregistrer';
                }
            }
        });
    }
}

async function deleteSale(id) {
    const confirmed = await showConfirmDialog('Voulez-vous vraiment supprimer cette vente de l\'historique ?');
    if (!confirmed) return;
    try {
        const res = await fetch(API_BASE + 'sales.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'delete', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        pollOnce();
    } catch (err) {
        alert('Erreur lors de la suppression : ' + err.message);
    }
}

/* ---------- Paramètres du Compte ---------- */
function initSettingsForm() {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById('settingsFormError');
        const successBox = document.getElementById('settingsFormSuccess');
        const submitBtn = document.getElementById('settingsSubmitBtn');
        
        errorBox.style.display = 'none';
        successBox.style.display = 'none';

        const formData = new FormData(form);
        formData.set('action', 'update_account');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Mise à jour en cours...';

        try {
            const res = await fetch(API_BASE + 'admin_settings.php', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Erreur lors de la mise à jour.');

            successBox.textContent = 'Paramètres mis à jour avec succès !';
            successBox.style.display = 'block';
            document.getElementById('settingsOldPassword').value = '';
            document.getElementById('settingsNewPassword').value = '';
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Mettre à jour le compte';
        }
    });
}