<?php
// api/reservation_archive.php
// Fonctions partagées : fin automatique des réservations dont la durée est dépassée.
// Ce fichier ne doit rien afficher ni envoyer d'en-têtes : il est inclus par booking.php, attente.php et vehicules.php.

/**
 * Archive UN dossier de réservation. C'est la même chose que le choix manuel « Terminée » dans le tableau de bord :
 *   1) statut « Terminée »  2) copie dans la table « historique »  3) suppression de « reservations » (libère le car_id)
 *   4) véhicule remis à disposition.
 *
 * $onlyIfExpiredMs : si renseigné, le dossier n'est archivé que s'il est TOUJOURS actif et expiré à cet instant
 * (évite les doublons quand plusieurs visiteurs déclenchent le nettoyage en même temps).
 * À appeler en dehors de toute transaction (la fonction ouvre la sienne).
 * Retourne true si le dossier a été archivé.
 */
function archive_reservation(PDO $pdo, $id, $onlyIfExpiredMs = null) {
    $pdo->beginTransaction();
    try {
        if ($onlyIfExpiredMs !== null) {
            $st = $pdo->prepare("SELECT id, car_id, car_name FROM reservations WHERE id = ? AND en_cours = 1 AND until_ts IS NOT NULL AND until_ts <= ? FOR UPDATE");
            $st->execute([$id, $onlyIfExpiredMs]);
        } else {
            $st = $pdo->prepare("SELECT id, car_id, car_name FROM reservations WHERE id = ? FOR UPDATE");
            $st->execute([$id]);
        }
        $res = $st->fetch();
        if (!$res) { $pdo->rollBack(); return false; }

        // On marque « Terminée » AVANT la copie : l'historique garde ainsi le bon statut
        $pdo->prepare("UPDATE reservations SET statut = 'Terminée', en_cours = 0 WHERE id = ?")->execute([$id]);
        $pdo->prepare("INSERT INTO historique SELECT * FROM reservations WHERE id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM reservations WHERE id = ?")->execute([$id]);
        $pdo->prepare("UPDATE vehicles SET dispo = 1 WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?")->execute([$res['car_id'], $res['car_name']]);

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        return false;
    }
}

/**
 * Archive tous les dossiers actifs dont l'heure de fin (until_ts) est dépassée,
 * ainsi que les dossiers « Terminée » encore présents dans « reservations ».
 * Appelée à chaque chargement des listes (réservations, catalogue) : pas besoin de tâche planifiée.
 * Retourne le nombre de dossiers archivés.
 */
function archive_expired_reservations(PDO $pdo) {
    $n = 0;
    try {
        $nowMs = (int) round(microtime(true) * 1000);
        $st = $pdo->prepare("SELECT id FROM reservations WHERE en_cours = 1 AND until_ts IS NOT NULL AND until_ts > 0 AND until_ts <= ? AND COALESCE(statut, '') <> 'liste_attente'");
        $st->execute([$nowMs]);
        foreach ($st->fetchAll() as $r) {
            if (archive_reservation($pdo, $r['id'], $nowMs)) { $n++; }
        }

        // Dossiers déjà marqués « Terminée » mais restés dans « reservations » (ancienne fin automatique,
        // ou réservation saisie directement comme terminée) : ils rejoignent l'historique eux aussi.
        $done = $pdo->query("SELECT id FROM reservations WHERE statut = 'Terminée'");
        foreach ($done->fetchAll() as $r) {
            if (archive_reservation($pdo, $r['id'])) { $n++; }
        }
    } catch (Exception $e) { /* table reservations ou historique absente : on ignore */ }
    return $n;
}