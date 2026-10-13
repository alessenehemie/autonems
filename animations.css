/* =====================================================================
   AutoNems — animations.css
   À charger APRÈS enhance.css. Ne modifie aucun de vos fichiers :
   retirez cette ligne dans index.html pour revenir à l'état précédent.
   ===================================================================== */

/* =====================================================================
   1. CORRECTIF : véhicule réservé => boutons bien visibles comme bloqués
   (cible la classe .is-locked ET les attributs disabled / aria-disabled)
   ===================================================================== */
.btn-full.is-locked,
button.btn-reserve:disabled,
.btn-acheter-card[aria-disabled="true"],
#modalReserveBtn:disabled,
#modalAchatBtn[aria-disabled="true"] {
    background: #e5e7eb !important;
    color: #6b7280 !important;
    border: 1.5px dashed #9ca3af !important;
    opacity: 1 !important;
    filter: none !important;
    box-shadow: none !important;
    transform: none !important;
    cursor: not-allowed !important;
    pointer-events: none !important;
    user-select: none;
}
/* petit cadenas devant le texte (remplace l'effet de brillance) */
.btn-full.is-locked.is-locked::before {
    content: '🔒';
    display: inline-block;
    position: static;
    inset: auto;
    width: auto;
    height: auto;
    background: none;
    transform: none;
    transition: none;
    margin-right: 6px;
    font-size: .85em;
}

/* Badges : couleurs bien distinctes */
.badge.badge-reserve { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.badge.badge-reserve:not(.badge-pending)::before { content: '🔒'; margin-right: 5px; }
.badge.badge-pending {
    background: linear-gradient(135deg, #fbbf24, #d97706);
    color: #1f1300;
    animation: badgePop .4s ease, pendingRing 2s ease-out .4s infinite;
}
.badge.badge-pending::before {
    content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 7px;
    border-radius: 50%; background: currentColor; animation: dotBlink 1.2s ease-in-out infinite;
}
.badge:not(.badge-reserve) { animation: badgePop .4s ease, availGlow 3s ease-in-out .4s infinite; }
.badge-timer { animation: timerBlink 2.2s ease-in-out infinite; }
.badge-timer::before { content: '⏱'; margin-right: 5px; }

@keyframes pendingRing {
    0%   { box-shadow: 0 0 0 0 rgba(251, 191, 36, .6); }
    100% { box-shadow: 0 0 0 14px rgba(251, 191, 36, 0); }
}
@keyframes availGlow {
    0%, 100% { box-shadow: 0 6px 16px -4px rgba(0, 0, 0, .3); }
    50%      { box-shadow: 0 6px 20px -2px rgba(46, 213, 107, .65); }
}
@keyframes dotBlink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
@keyframes timerBlink { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }

/* Carte réservée : image grisée + ruban en diagonale */
.vehicle-card { position: relative; }
.vehicle-card.is-reserved { border-color: rgba(239, 68, 68, .35); }
.vehicle-card.is-pending  { border-color: rgba(245, 158, 11, .45); }
.vehicle-card.is-reserved .img-container img,
.vehicle-card.is-reserved:hover .img-container img {
    filter: grayscale(.85) brightness(.9) !important;
}
.vehicle-card.is-reserved .img-container::before {
    content: 'INDISPONIBLE';
    position: absolute; z-index: 4; top: 24px; left: -44px; width: 170px; padding: 5px 0;
    text-align: center; transform: rotate(-45deg);
    background: linear-gradient(90deg, #b91c1c, #ef4444); color: #fff;
    font-size: .68rem; font-weight: 800; letter-spacing: 1.5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, .3); pointer-events: none;
}
.vehicle-card.is-pending .img-container::before {
    content: 'EN ATTENTE';
    background: linear-gradient(90deg, #d97706, #f59e0b); color: #1f1300;
}

/* Quand l'état d'une voiture change (libre -> réservée, etc.) : onde lumineuse */
@keyframes stateFlash {
    0%   { box-shadow: 0 0 0 0 rgba(217, 119, 6, .75); }
    100% { box-shadow: 0 0 0 24px rgba(217, 119, 6, 0); }
}
.vehicle-card.state-changed { animation: stateFlash 1s ease-out 1 !important; }

/* Les rafraîchissements automatiques (toutes les 15-20 s) ne rejouent plus
   l'animation d'entrée des cartes : plus de clignotement de la grille */
#vehicleGrid.is-refresh .card.reveal,
#vehicleGrid.is-refresh .card.reveal.active {
    opacity: 1; transform: none; filter: none; animation: none;
}

/* =====================================================================
   2. ANIMATIONS SUPPLÉMENTAIRES
   ===================================================================== */

/* Apparition de la page */
body { animation: pageIn .7s ease backwards; }
@keyframes pageIn { from { opacity: 0; } to { opacity: 1; } }

/* ----- Hero ----- */
.hero-content {
    position: relative; z-index: 1;
    transform: translate3d(calc(var(--mx, 0) * -14px), calc(var(--my, 0) * -10px + var(--sy, 0px)), 0);
    opacity: calc(1 - var(--so, 0));
    transition: transform .25s ease-out;
}
.hero .scroll-hint { opacity: calc(1 - var(--so, 0) * 2.5); }

.hero-content > * { animation: heroIn 1s var(--ease-out) backwards; }
.hero-content > *:nth-child(2) { animation-delay: .12s; }
.hero-content > *:nth-child(3) { animation-delay: .24s; }
.hero-content > *:nth-child(4) { animation-delay: .36s; }
.hero-content > *:nth-child(5) { animation-delay: .48s; }
@keyframes heroIn {
    from { opacity: 0; transform: translateY(28px); filter: blur(8px); }
    to   { opacity: 1; transform: none; filter: none; }
}
.hero-content > .hero-kicker { animation: heroIn 1s var(--ease-out) backwards, kickerFloat 5s ease-in-out 1s infinite; }
@keyframes kickerFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }

.hero .btn-solid { animation: ctaGlow 3s ease-in-out 1.5s infinite; }
@keyframes ctaGlow {
    0%, 100% { filter: drop-shadow(0 0 0 rgba(217, 119, 6, 0)); }
    50%      { filter: drop-shadow(0 8px 20px rgba(217, 119, 6, .55)); }
}

.hero-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.hero-particles span {
    position: absolute; bottom: -20px; border-radius: 50%; opacity: 0;
    background: radial-gradient(circle, rgba(242, 177, 85, .9), rgba(217, 119, 6, 0));
    animation: particleRise linear infinite;
}
@keyframes particleRise {
    0%   { transform: translate3d(0, 0, 0) scale(.6); opacity: 0; }
    10%  { opacity: .9; }
    90%  { opacity: .5; }
    100% { transform: translate3d(var(--dx, 0), -110vh, 0) scale(1.1); opacity: 0; }
}
.hero-spot {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: radial-gradient(520px circle at var(--spx, 50%) var(--spy, 40%), rgba(242, 177, 85, .16), transparent 60%);
}

/* ----- Titres de section : trait animé ----- */
.section-title::after {
    background: linear-gradient(90deg, var(--accent-gold), var(--accent-gold-light), var(--accent-gold));
    background-size: 200% 100%;
    animation: lineFlow 3s linear infinite;
}
@keyframes lineFlow { to { background-position: -200% 0; } }
.section-title.reveal::after { width: 0; transition: width 1s var(--ease-out) .3s; }
.section-title.reveal.active::after { width: 70px; }

/* ----- Cartes véhicules ----- */
.vehicle-card::before {
    content: ''; position: absolute; left: 0; top: 0; width: 100%; height: 3px; z-index: 4;
    background: linear-gradient(90deg, var(--accent-gold), var(--accent-gold-light), var(--accent-gold));
    transform: scaleX(0); transform-origin: left; pointer-events: none;
    transition: transform .6s var(--ease-out);
}
.vehicle-card:hover::before { transform: scaleX(1); }
.vehicle-card.is-reserved::before { background: linear-gradient(90deg, #ef4444, #f87171); }

.card:hover .spec-chip { transform: translateY(-2px); }
.card:hover .spec-chip:nth-child(2) { transition-delay: .05s; }
.card:hover .spec-chip:nth-child(3) { transition-delay: .10s; }
.card:hover .spec-chip:nth-child(4) { transition-delay: .15s; }

.card .price {
    background-image: linear-gradient(100deg, #b45309 25%, #f6c26b 45%, #d97706 55%, #b45309 75%);
    background-size: 250% 100%; background-position: 100% 0;
}
.card:hover .price { animation: priceShine 1.6s ease-out 1; }
@keyframes priceShine { to { background-position: -100% 0; } }

/* ----- Boutons : balayage lumineux + ripple au clic ----- */
.btn-full::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, .35) 50%, transparent 70%);
    transform: translateX(-120%); transition: transform .7s var(--ease-out);
}
.btn-full:hover::before { transform: translateX(120%); }

.chip, .btn-details, .btn-submit, .modal-close { position: relative; overflow: hidden; }
.modal-close { position: absolute; }
.ripple {
    position: absolute; border-radius: 50%; pointer-events: none;
    background: rgba(255, 255, 255, .45); transform: scale(0);
    animation: ripple .65s ease-out forwards;
}
.btn-details .ripple, .chip:not(.chip-active) .ripple, .btn-outline .ripple, .modal-close .ripple {
    background: rgba(217, 119, 6, .28);
}
@keyframes ripple { to { transform: scale(1); opacity: 0; } }

.chip-active { animation: chipPop .45s var(--ease-spring); }
@keyframes chipPop { from { transform: scale(.88); } to { transform: scale(1); } }

/* ----- Confiance ----- */
.trust-item h4 { transition: color .3s; }
.trust-item:hover h4 { color: var(--accent-gold-hover); }

/* ----- Bouton WhatsApp flottant : petit rebond périodique ----- */
.whatsapp-float { animation: waBounce 6s ease-in-out 3s infinite; }
@keyframes waBounce {
    0%, 86%, 100% { translate: 0 0; }
    90% { translate: 0 -14px; }
    94% { translate: 0 0; }
    97% { translate: 0 -6px; }
}

/* ----- Formulaire : flash vert quand un champ devient valide ----- */
input.valid, select.valid { animation: validFlash .7s ease; }
@keyframes validFlash {
    0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, .55); }
    100% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
}

/* ----- Accessibilité ----- */
@media (prefers-reduced-motion: reduce) {
    .hero-content { transform: none !important; opacity: 1 !important; }
    .hero-particles, .hero-spot { display: none; }
}
@media (hover: none) {
    .hero-spot { display: none; }
}