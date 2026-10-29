/* ============================================================
   AUTONEMS — purchase-status.js   (site public)
   ------------------------------------------------------------
   Quand un client a rempli le formulaire d'achat, le véhicule est
   « en cours d'achat » :
     - le badge de la voiture affiche « En cours d'achat »
     - les boutons « Réserver » et « Acheter » deviennent grisés
       et ne réagissent plus (cartes ET fenêtre de détails)
   L'état est lu toutes les 15 s dans api/sales.php?action=public_list
   (aucune donnée personnelle). Ce fichier ne modifie pas script.js :
   il s'ajoute simplement dans index.html, après script.js.
   ============================================================ */
(function () {
    'use strict';

    var API_URL = '../api/sales.php?action=public_list';
    var POLL_MS = 15000;
    var LOCK_MSG = "Ce véhicule est en cours d'achat : la réservation et l'achat sont momentanément indisponibles.";
    var BADGE_LABEL = "En cours d'achat";

    var purchases = {};      // { slug: { statut } }  ->  véhicules en cours d'achat
    var warned = {};         // véhicules déjà signalés au client pendant qu'il remplit un formulaire
    var observers = [];      // [{ observer, node, options }]
    var rafPending = false;

    /* ---------- Outils ---------- */
    function slugify(text) {
        return String(text == null ? '' : text).toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    }
    function isLocked(slug) { return !!(slug && purchases[slug]); }

    function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
    function setAttr(el, name, value) { if (el && el.getAttribute(name) !== value) el.setAttribute(name, value); }
    function addCls(el, name) { if (el && !el.classList.contains(name)) el.classList.add(name); }
    function delCls(el, name) { if (el && el.classList.contains(name)) el.classList.remove(name); }

    /* ---------- Styles (grisé, badge, message) ---------- */
    function injectStyle() {
        if (document.getElementById('ps-style')) return;
        var st = document.createElement('style');
        st.id = 'ps-style';
        st.textContent =
            '.ps-locked{opacity:.45!important;filter:grayscale(1)!important;cursor:not-allowed!important;' +
            'background:#6b7280!important;background-image:none!important;border-color:#6b7280!important;color:#e5e7eb!important;' +
            'box-shadow:none!important;transform:none!important}' +
            '.ps-locked:hover,.ps-locked:focus{transform:none!important;filter:grayscale(1)!important}' +
            '.badge.badge-purchase{background:rgba(124,58,237,.92)!important;color:#fff!important;border-color:#a78bfa!important}' +
            '.ps-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1f2937;color:#fff;' +
            'padding:12px 18px;border-radius:12px;z-index:100000;max-width:90vw;box-shadow:0 10px 30px rgba(0,0,0,.4);' +
            'font-size:.95rem;line-height:1.4;text-align:center}';
        document.head.appendChild(st);
    }

    var toastTimer = null;
    function toast(message) {
        var t = document.getElementById('ps-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'ps-toast';
            t.className = 'ps-toast';
            t.setAttribute('role', 'status');
            document.body.appendChild(t);
        }
        t.textContent = message;
        t.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.style.display = 'none'; }, 4500);
    }

    /* ---------- Verrouillage d'un bouton / lien ---------- */
    function lockEl(el) {
        if (!el) return;
        if (el.tagName === 'A') {
            var href = el.getAttribute('href');
            if (href) {                       // le lien est mis de côté (même si le site vient de le renouveler)
                el.setAttribute('data-ps-href', href);
                el.removeAttribute('href');
            }
        }
        addCls(el, 'ps-locked');
        setAttr(el, 'aria-disabled', 'true');
        setAttr(el, 'tabindex', '-1');
        setAttr(el, 'title', LOCK_MSG);
    }
    function unlockEl(el) {
        if (!el || !el.classList.contains('ps-locked')) return;
        delCls(el, 'ps-locked');
        el.removeAttribute('aria-disabled');
        el.removeAttribute('tabindex');
        el.removeAttribute('title');
        if (el.hasAttribute('data-ps-href')) {
            if (!el.getAttribute('href')) el.setAttribute('href', el.getAttribute('data-ps-href'));
            el.removeAttribute('data-ps-href');
        }
    }

    function applyBadge(badge, locked) {
        if (!badge) return;
        if (locked) {
            setText(badge, BADGE_LABEL);
            addCls(badge, 'badge-reserve');
            addCls(badge, 'badge-purchase');
        } else {
            delCls(badge, 'badge-purchase'); // le texte d'origine est remis par le site au prochain rafraîchissement
        }
    }

    /* ---------- Application de l'état sur la page ---------- */
    function applyCard(card) {
        var slug = card.getAttribute('data-id');
        var locked = isLocked(slug);
        applyBadge(card.querySelector('.badge'), locked);

        var sub = card.querySelector('.badge-timer');   // « libère dans … » (réservation) : inutile ici
        if (sub) {
            var wanted = locked ? 'none' : '';
            if (sub.style.display !== wanted) sub.style.display = wanted;
        }
        var buttons = card.querySelectorAll('.btn-reserve, .btn-acheter-card');
        for (var i = 0; i < buttons.length; i++) { if (locked) lockEl(buttons[i]); else unlockEl(buttons[i]); }
    }

    function applyModal() {
        var title = document.getElementById('modalTitle');
        if (!title) return;
        var locked = isLocked(slugify(title.textContent || ''));

        applyBadge(document.getElementById('modalBadge'), locked);
        var reserveBtn = document.getElementById('modalReserveBtn');
        var buyBtn = document.getElementById('modalAchatBtn');
        if (locked) { lockEl(reserveBtn); lockEl(buyBtn); } else { unlockEl(reserveBtn); unlockEl(buyBtn); }

        var timer = document.getElementById('modalTimer');
        if (timer && locked) {
            if (timer.hidden) timer.hidden = false;
            setText(timer, "Ce véhicule est actuellement en cours d'achat par un client.");
        }
    }

    // Le client remplit déjà le formulaire de réservation quand le véhicule passe « en cours d'achat »
    function applyReservationModal() {
        var modal = document.getElementById('reservationModal');
        var nameEl = document.getElementById('resCarName');
        if (!modal || !nameEl || !modal.classList.contains('open')) return;
        var slug = slugify(nameEl.textContent || '');
        if (isLocked(slug) && !warned[slug]) {
            warned[slug] = true;
            toast("Ce véhicule vient de passer « en cours d'achat » : votre réservation ne pourra plus être enregistrée.");
        }
    }

    function applyAll() {
        disconnectAll();                 // nos propres modifications ne relancent pas l'observation
        try {
            var cards = document.querySelectorAll('.vehicle-card');
            for (var i = 0; i < cards.length; i++) applyCard(cards[i]);
            applyModal();
            applyReservationModal();
        } finally {
            connectAll();
        }
    }

    function scheduleApply() {
        if (rafPending) return;
        rafPending = true;
        var run = function () { rafPending = false; applyAll(); };
        if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
        else setTimeout(run, 0);
    }

    /* ---------- Surveillance de la page (le site redessine les cartes régulièrement) ---------- */
    function setupObservers() {
        if (typeof MutationObserver !== 'function') return;
        var targets = [
            { node: document.getElementById('vehicleGrid'), options: { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'href'] } },
            { node: document.getElementById('vehicleModal'), options: { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'href', 'hidden'] } },
            { node: document.getElementById('reservationModal'), options: { attributes: true, attributeFilter: ['class'] } }
        ];
        targets.forEach(function (t) {
            if (!t.node) return;
            observers.push({ observer: new MutationObserver(scheduleApply), node: t.node, options: t.options });
        });
        connectAll();
    }
    function connectAll() { observers.forEach(function (o) { o.observer.observe(o.node, o.options); }); }
    function disconnectAll() { observers.forEach(function (o) { o.observer.disconnect(); }); }

    /* ---------- Clics sur un bouton verrouillé : rien ne se passe ---------- */
    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('.ps-locked') : null;
        if (!el) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        toast(LOCK_MSG);
    }, true);

    // Sécurité : même appelée directement, la fenêtre de réservation ne s'ouvre pas pour un véhicule verrouillé
    function wrapReservationOpener() {
        var fn = window.openReservationModal;
        if (typeof fn !== 'function' || fn.__psWrapped) return;
        var wrapped = function (id) {
            if (isLocked(id)) { toast(LOCK_MSG); return; }
            return fn.apply(this, arguments);
        };
        wrapped.__psWrapped = true;
        window.openReservationModal = wrapped;
    }

    // Quand un véhicule est libéré (achat annulé), le site redessine ses cartes pour retrouver leur état normal
    function rerenderFleet() {
        try {
            if (typeof window.renderFleet === 'function' && typeof window.currentFilteredList === 'function') {
                window.renderFleet(window.currentFilteredList());
            }
        } catch (e) { /* ignoré */ }
    }

    /* ---------- Lecture de l'état sur le serveur ---------- */
    function poll() {
        return fetch(API_URL, { cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (!data || data.success !== true) return;       // en cas de doute, on garde l'état précédent
                var next = data.purchases || {};
                var released = Object.keys(purchases).filter(function (k) { return !next[k]; });
                purchases = next;
                released.forEach(function (k) { delete warned[k]; });
                if (released.length) rerenderFleet();
                applyAll();
            })
            .catch(function () { /* serveur injoignable : on garde l'état précédent */ });
    }

    function init() {
        injectStyle();
        wrapReservationOpener();
        setupObservers();
        poll();
        setInterval(function () { if (!document.hidden) poll(); }, POLL_MS);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // Pour les tests / le débogage
    window.__purchaseStatus = { apply: applyAll, state: function () { return purchases; }, poll: poll };
})();