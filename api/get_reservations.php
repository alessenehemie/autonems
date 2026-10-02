<?php
/* ============================================================
   AUTONEMS — api/get_reservations.php
   ------------------------------------------------------------
   Renvoie toutes les réservations actives, au format :
   { "carId1": { "until": 1234567890123, "car": "Nom du véhicule" }, ... }

   Les réservations dont le chrono est terminé sont supprimées
   automatiquement à chaque appel : elles redeviennent donc
   "Disponible" sur le site sans aucune action manuelle.
   ============================================================ */

require __DIR__ . '/db.php';

$nowMs = (int) round(microtime(true) * 1000);

// AJOUT : avant de supprimer les réservations expirées, on remet les véhicules concernés en "disponible"
// dans la table vehicles (sinon dispo restait à 0 indéfiniment côté admin).
$stmtExpired = $pdo->prepare("SELECT car_id, car_name FROM reservations WHERE until_ts <= :now");
$stmtExpired->execute([':now' => $nowMs]);
$stmtRelease = $pdo->prepare("UPDATE vehicles SET dispo = 1 WHERE nom = ? OR LOWER(REPLACE(nom, ' ', '-')) = ?");
foreach ($stmtExpired->fetchAll() as $exp) {
    $stmtRelease->execute([$exp['car_name'], $exp['car_id']]);
}

// Ménage : supprime les réservations expirées
$pdo->prepare("DELETE FROM reservations WHERE until_ts <= :now")->execute([':now' => $nowMs]);

// MODIFICATION : on ne renvoie que les réservations réellement actives (statut différent de "Terminée")
$stmt = $pdo->query("SELECT car_id, car_name, until_ts FROM reservations WHERE en_cours = 1 AND statut <> 'Terminée'");
$rows = $stmt->fetchAll();

$result = [];
foreach ($rows as $row) {
    $result[$row['car_id']] = [
        'until' => (int) $row['until_ts'],
        'car'   => $row['car_name'],
    ];
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);