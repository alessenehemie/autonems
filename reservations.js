/* ============================================================
   AUTONEMS — reservations.js
   ------------------------------------------------------------
   Couche unique de gestion des réservations, branchée sur le
   backend PHP + MySQL (dossier api/). Toutes les réservations
   sont donc partagées entre TOUS les visiteurs du site, en
   quasi temps réel (synchronisation toutes les 15 secondes,
   + immédiatement après chaque nouvelle réservation).

   Prérequis : le site doit être servi par WampServer (Apache/PHP),
   c'est-à-dire ouvert via une adresse du type
   http://localhost/autonems/index.html — et non en double-cliquant
   sur le fichier (file://...), sinon PHP ne s'exécute pas.

   Utilisation :
     ReservationStore.subscribe(reservations => { ... })
     ReservationStore.save(carId, carName, durationHours)
   ============================================================ */

const ReservationStore = (function () {
    const API_BASE = 'api/';
    const POLL_INTERVAL_MS = 15000;

    let listeners = [];
    let pollTimer = null;
    let lastKnown = {};

    function notify(data) {
        // Nettoyage local de sécurité pour masquer instantanément les réservations expirées
        // MODIFICATION : le serveur renvoie "until" (et non "expiresAt") ; on accepte les deux.
        const now = Date.now();
        const cleaned = {};
        for (const carId in (data || {})) {
            const item = data[carId];
            const end = Number(item && (item.until || item.expiresAt || 0));
            if (end && end <= now && !(item && item.statut === 'Confirmée')) continue; // expirée -> on l'ignore (sauf "Réservé" confirmé par l'admin)
            cleaned[carId] = item;
        }
        lastKnown = cleaned;

        listeners.forEach(cb => cb(lastKnown));
    }

    function fetchReservations() {
        return fetch(API_BASE + 'booking.php?action=public_list', { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(data => {
                if (data && data.error) {
                    console.warn("AutoNems : ", data.error);
                    return {};
                }
                return data || {};
            })
            .catch(err => {
                console.warn(
                    "AutoNems : impossible de contacter le serveur PHP (api/get_reservations.php). " +
                    "Vérifiez que WampServer est démarré et que le site est bien ouvert via " +
                    "http://localhost/... (et non en double-cliquant sur le fichier).",
                    err
                );
                return lastKnown; // on garde le dernier état connu plutôt que de tout vider
            });
    }

    function pollOnce() {
        return fetchReservations().then(notify);
    }

    function subscribe(callback) {
        listeners.push(callback);
        pollOnce();
        if (!pollTimer) {
            pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') pollOnce();
            });
        }
    }

    function save(carId, carName, durationHours) {
        return fetch(API_BASE + 'save_reservation.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carId, carName, durationHours })
        })
            .then(res => res.json())
            .then(data => {
                if (data && data.error) console.warn("AutoNems : ", data.error);
                return data;
            })
            .catch(err => {
                console.warn("AutoNems : échec de l'enregistrement de la réservation côté serveur.", err);
            })
            .finally(pollOnce); // rafraîchit immédiatement l'affichage pour tout le monde
    }

    // AJOUT : refresh() permet de recharger immédiatement les réservations depuis le serveur
    return { subscribe, save, refresh: pollOnce };
})();