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

// Ménage : supprime les réservations expirées
$pdo->prepare("DELETE FROM reservations WHERE until_ts <= :now")->execute([':now' => $nowMs]);

$stmt = $pdo->query("SELECT car_id, car_name, until_ts FROM reservations");
$rows = $stmt->fetchAll();

$result = [];
foreach ($rows as $row) {
    $result[$row['car_id']] = [
        'until' => (int) $row['until_ts'],
        'car'   => $row['car_name'],
    ];
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);
