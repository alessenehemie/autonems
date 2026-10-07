// dashboard.js — logique complète du tableau de bord admin
 
const API_BASE = '../api/'; // dashboard.html est dans /admin/, l'API est dans /api/ (sibling)
 
let currentVehicules = [];
let currentReservations = [];
let currentSales = [];
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
            resolve(confirm(message)); // Fallback si la modale n'existe pas dans le HTML
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
    initSettingsForm();
    initReservationsActions();
    initSalesModal(); 
    initBookingModal();

    await Promise.all([loadVehicules(), loadReservations(), loadSales()]);
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
 
/* ---------- Stats ---------- */
function updateStats() {
    const total = currentVehicules.length;
    const dispo = currentVehicules.filter(v => v.dispo).length;
    const enCours = currentReservations.filter(r => r.en_cours || r.statut === 'En cours' || r.statut === 'Confirmée').length;
    const totalReservations = currentReservations.length;
    const totalSales = currentSales.length;
 
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDispo').textContent = dispo;
    document.getElementById('statEnCours').textContent = enCours;
    document.getElementById('statReservations').textContent = totalReservations;
    
    const statVentes = document.getElementById('statVentes');
    if (statVentes) statVentes.textContent = totalSales;
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
        <tr>
            <td><img class="table-thumb" src="${resolveImgSrc(v.img)}" alt="${v.nom}" onerror="this.style.visibility='hidden'" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;"></td>
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
 
/* ---------- Chargement + rendu des réservations (Mis à jour avec CNI, Permis & Photos) ---------- */
/* Libellés affichés (les valeurs enregistrées en base restent 'En cours' / 'Confirmée' / 'Terminée') */
const STATUT_LABELS = { 'En cours': 'En cours de réservation', 'Confirmée': 'Réservé', 'Terminée': 'Terminée' };

/* ---------- Chrono des réservations "En cours de réservation" (compte à rebours en direct) ---------- */
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
    document.querySelectorAll('.admin-chrono').forEach(renderChronoText);
}
setInterval(tickChronos, 1000);

async function loadReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    try {
        const res = await fetch(API_BASE + 'booking.php?action=list');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur inconnue');
        currentReservations = data.reservations || [];
        renderReservations();
    } catch (err) {
        console.error(err);
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Erreur de chargement des réservations.</td></tr>`;
    }
}
 
function renderReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    if(!tbody) return;
    // Ne pas redessiner le tableau pendant que l'admin choisit un statut dans la liste déroulante
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('status-select')) return;
    if (!currentReservations.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Aucune réservation reçue pour le moment.</td></tr>`;
        return;
    }
    tbody.innerHTML = currentReservations.map(r => {
        // Récupération des chemins des fichiers (CNI et Permis)
        const idCardPath = r.id_card || r.identity_doc;
        const licensePath = r.driver_license_file || r.driver_license_path;

        // Miniature CNI cliquable
        const idCardHtml = idCardPath 
            ? `<a href="${resolveImgSrc(idCardPath)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(idCardPath)}" alt="CNI" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="Voir CNI"></a>` 
            : '';

        // Miniature Permis cliquable
        const licenseHtml = licensePath 
            ? `<a href="${resolveImgSrc(licensePath)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(licensePath)}" alt="Permis" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="Voir Permis"></a>` 
            : '';

        // Numéros d'identification
        const cniNum = r.id_card_number ? `<strong>CNI :</strong> ${r.id_card_number}` : '';
        const licenseNum = r.driver_license ? `<strong>Permis :</strong> ${r.driver_license}` : '';

        // Deux colonnes séparées (CNI / Permis) pour correspondre à dashboard.html
        const cniCell = [cniNum, idCardHtml].filter(Boolean).join('<br>') || '—';
        const permisCell = [licenseNum, licenseHtml].filter(Boolean).join('<br>') || '—';

        // Gestion du texte et du style du badge de statut
        const statut = r.statut || (r.en_cours ? 'En cours' : 'Terminée');
        const isOff = statut === 'Terminée' || r.en_cours === false;

        // Chrono : conditionné au statut 'Confirmée' (Réservé)
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
                    <select class="status-select" data-id="${r.id}" style="display:block; margin-top:6px; padding:4px 6px; border-radius:6px; font-size:12px;">
                        <option value="En cours" ${statut === 'En cours' ? 'selected' : ''}>En cours de réservation</option>
                        <option value="Confirmée" ${statut === 'Confirmée' ? 'selected' : ''}>Réservé</option>
                        <option value="Terminée" ${statut === 'Terminée' ? 'selected' : ''}>Terminée</option>
                    </select>
                </td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : '—'}</td>
                <td>
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

    tbody.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const id = sel.dataset.id;
            const newStatut = sel.value;

            // 1. Mise à jour immédiate de la variable locale et rafraîchissement instantané de l'interface
            const resObj = currentReservations.find(item => String(item.id) === String(id));
            if (resObj) {
                resObj.statut = newStatut;
                if (newStatut === 'Terminée') {
                    resObj.en_cours = false;
                }
            }
            renderReservations();
            updateStats();

            // 2. Envoi de la requête au serveur en arrière-plan sans bloquer l'affichage
            await updateReservationStatus(id, newStatut);
        });
    });

    tickChronos(); // affiche tout de suite les chronos des nouvelles lignes
}

// Changement de statut par l'admin (ex : "En cours de réservation" -> "Réservé" après accord sur WhatsApp)
async function updateReservationStatus(id, statut) {
    try {
        const res = await fetch(API_BASE + 'booking.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'update_status', id, statut })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
    } catch (err) {
        alert('Erreur lors du changement de statut : ' + err.message);
        pollOnce(); // Re-synchronise avec le serveur en cas d'erreur
    }
}
 
// Fonction de rafraîchissement immédiat (pollOnce) et configuration de l'intervalle automatique
function pollOnce() {
    Promise.all([loadReservations(), loadSales()]).then(updateStats);
}

function initReservationsActions() {
    setInterval(pollOnce, 15000); // Rafraîchissement automatique toutes les 15 secondes
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
        
        // Rafraîchissement immédiat après la suppression
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
                
                // Rafraîchissement immédiat après l'enregistrement d'une réservation
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
        currentSales = data.sales || [];
        renderSales();
    } catch (err) {
        console.error("Erreur ventes :", err);
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Erreur de chargement des ventes.</td></tr>`;
    }
}

function renderSales() {
    const tbody = document.getElementById('salesTableBody');
    if(!tbody) return;
    if (!currentSales.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Aucune vente enregistrée pour le moment.</td></tr>`;
        return;
    }
    tbody.innerHTML = currentSales.map(s => {
        // Génération des miniatures cliquables / affichage des numéros CNI et Permis
        const cniHtml = s.id_card_path 
            ? `<a href="${resolveImgSrc(s.id_card_path)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(s.id_card_path)}" alt="CNI" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="${s.id_card_number || 'Voir CNI'}"></a>` 
            : (s.id_card_number || '—');

        const permisHtml = s.driver_license_path 
            ? `<a href="${resolveImgSrc(s.driver_license_path)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(s.driver_license_path)}" alt="Permis" style="width:35px; height:35px; object-fit:cover; border-radius:4px; cursor:pointer;" title="${s.driver_license_number || 'Voir Permis'}"></a>` 
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
                <td>${s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : '—'}</td>
                <td>
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
                
                // Rafraîchissement immédiat après l'enregistrement d'une vente
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
        
        // Rafraîchissement immédiat après la suppression d'une vente
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