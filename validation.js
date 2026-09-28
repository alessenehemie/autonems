

const AutoNemsValidation = (function () {
    /* Nom : lettres (accents inclus), espaces, apostrophes, tirets.
       Exige au moins deux "mots" (nom + prénom) de 2 lettres min chacun. */
    const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,}(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]{2,})+$/;

    /* Téléphone ivoirien : 10 chiffres commençant par 01, 05, 07, 21, 23, 25 ou 27.
       Accepte un préfixe international +225 / 00225 et des espaces entre les chiffres. */
    const PHONE_REGEX = /^(?:\+225|00225)?(01|05|07|21|23|25|27)\d{8}$/;

    function cleanPhone(raw) {
        return (raw || '').replace(/[\s.\-]/g, '');
    }

    function validateName(value) {
        const v = (value || '').trim();
        if (!v) return { valid: false, empty: true };
        if (/\d/.test(v)) return { valid: false, message: "Le nom ne doit contenir aucun chiffre." };
        if (!NAME_REGEX.test(v)) return { valid: false, message: "Entrez votre nom ET votre prénom, en lettres uniquement (ex : Kouassi Jean)." };
        return { valid: true };
    }

    function validatePhone(value) {
        const raw = (value || '').trim();
        if (!raw) return { valid: false, empty: true };
        const cleaned = cleanPhone(raw);
        if (/[^0-9+]/.test(cleaned) || !PHONE_REGEX.test(cleaned)) {
            return { valid: false, message: "Numéro invalide. Utilisez un numéro ivoirien à 10 chiffres (ex : 07 69 58 34 94)." };
        }
        return { valid: true };
    }

    return { validateName, validatePhone };
})();
