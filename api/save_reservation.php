<?php
/* ============================================================
   AUTONEMS — api/save_reservation.php
   ------------------------------------------------------------
   Enregistre (ou remplace) la réservation d'un véhicule.
   Attend un corps JSON en POST :
   { "carId": "bmw", "carName": "BMW M4", "durationHours": 24 }

   La validation est refaite ici côté serveur : on ne fait jamais
   confiance uniquement au JavaScript du navigateur.
   ============================================================ */

require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Corps de requête invalide.']);
    exit;
}

$carId = isset($input['carId']) ? trim((string) $input['carId']) : '';
$carName = isset($input['carName']) ? trim((string) $input['carName']) : '';
$durationHours = isset($input['durationHours']) ? (float) $input['durationHours'] : 0;

if (!preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $carId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Identifiant de véhicule invalide.']);
    exit;
}
if ($carName === '' || mb_strlen($carName) > 255) {
    http_response_code(400);
    echo json_encode(['error' => 'Nom de véhicule invalide.']);
    exit;
}
if ($durationHours <= 0 || $durationHours > 720) { // maximum 30 jours
    http_response_code(400);
    echo json_encode(['error' => 'Durée de réservation invalide.']);
    exit;
}

$untilMs = (int) round((microtime(true) + $durationHours * 3600) * 1000);

$stmt = $pdo->prepare("
    INSERT INTO reservations (car_id, car_name, until_ts)
    VALUES (:carId, :carName, :untilTs)
    ON DUPLICATE KEY UPDATE car_name = VALUES(car_name), until_ts = VALUES(until_ts)
");
$stmt->execute([
    ':carId'   => $carId,
    ':carName' => $carName,
    ':untilTs' => $untilMs,
]);

echo json_encode(['success' => true, 'until' => $untilMs], JSON_UNESCAPED_UNICODE);
