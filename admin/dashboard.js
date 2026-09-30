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
    const enCours = currentReservations.filter(r => r.en_cours).length;
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
            <td><img class="table-thumb" src="${resolveImgSrc(v.img)}" alt="${v.nom}" onerror="this.style.visibility='hidden'"></td>
            <td>${v.nom}</td>
            <td>${v.marque || '—'}</td>
            <td>${fmt(v.loc)}</td>
            <td>${fmt(v.vente)}</td>
            <td><span class="badge ${v.dispo ? '' : 'badge-off'}">${v.dispo ? 'Disponible' : 'Indisponible'}</span></td>
            <td>
                <button class="btn-icon btn-edit" data-id="${v.id}" style="background:#10b981; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-right:5px; font-weight:600;">Modifier</button>
                <button class="btn-icon btn-delete" data-id="${v.id}" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">Supprimer</button>
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
    if (!confirm(`Supprimer "${v ? v.nom : id}" ? Cette action est définitive.`)) return;
 
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
 
/* ---------- Chargement + rendu des réservations (Ordre modifié) ---------- */
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
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Erreur de chargement des réservations.</td></tr>`;
    }
}
 
function renderReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    if(!tbody) return;
    if (!currentReservations.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Aucune réservation reçue pour le moment.</td></tr>`;
        return;
    }
    tbody.innerHTML = currentReservations.map(r => {
        const idCardPath = r.identity_doc || r.id_card;
        const idCardHtml = idCardPath 
            ? `<a href="${resolveImgSrc(idCardPath)}" target="_blank"><img class="table-thumb" src="${resolveImgSrc(idCardPath)}" alt="Carte d'identité" style="width:40px; height:40px; object-fit:cover; border-radius:4px; cursor:pointer;" title="Cliquer pour agrandir"></a>` 
            : '—';

        return `
            <tr>
                <td><strong>${r.client_nom || 'Client'}</strong></td>
                <td>${r.client_telephone || '—'}</td>
                <td>${r.car_name || 'Véhicule'}</td>
                <td>${r.duree_label || '—'}</td>
                <td>${idCardHtml}</td>
                <td><span class="badge ${r.en_cours ? '' : 'badge-off'}">${r.en_cours ? 'En cours' : 'Terminée'}</span></td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : '—'}</td>
                <td><button class="btn-icon btn-delete" data-id="${r.id}" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">Supprimer</button></td>
            </tr>
        `;
    }).join('');
 
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteReservation(btn.dataset.id));
    });
}
 
function initReservationsActions() {
    setInterval(() => {
        Promise.all([loadReservations(), loadSales()]).then(updateStats);
    }, 30000);
}
 
async function deleteReservation(id) {
    if (!confirm('Supprimer cette réservation ?')) return;
    try {
        const res = await fetch(API_BASE + 'booking.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'delete', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        await loadReservations();
        updateStats();
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

    // Modification pour forcer le chargement et l'affichage des véhicules à chaque ouverture
    if(openBtn) openBtn.addEventListener('click', async () => { 
        const select = document.getElementById('bookingCarId');
        
        // Recharge systématiquement pour s'assurer d'avoir les derniers véhicules ajoutés
        await loadVehicules();

        if (select) {
            select.innerHTML = '<option value="">-- Choisir un véhicule --</option>' + 
                currentVehicules.map(v => `<option value="${v.id}">${v.nom} (${v.marque || ''})</option>`).join('');
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
                await loadReservations();
                updateStats();
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
        if(tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Erreur de chargement des ventes.</td></tr>`;
    }
}

function renderSales() {
    const tbody = document.getElementById('salesTableBody');
    if(!tbody) return;
    if (!currentSales.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Aucune vente enregistrée pour le moment.</td></tr>`;
        return;
    }
    tbody.innerHTML = currentSales.map(s => `
        <tr>
            <td><strong>${s.buyer_nom}</strong></td>
            <td><a href="https://wa.me/${s.buyer_telephone}" target="_blank">${s.buyer_telephone}</a></td>
            <td>${s.car_name}</td>
            <td>${s.car_details || '—'}</td>
            <td><strong style="color:#34d399;">${fmt(s.sale_price)}</strong></td>
            <td>${s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : '—'}</td>
            <td><button class="btn-delete-sale" data-id="${s.id}" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">Supprimer</button></td>
        </tr>
    `).join('');

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
                await loadSales();
                updateStats();
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
    if (!confirm('Supprimer cette vente de l\'historique ?')) return;
    try {
        const res = await fetch(API_BASE + 'sales.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'delete', id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        await loadSales();
        updateStats();
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