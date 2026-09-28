<?php
/**
 * Connexion à la base de données
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$DB_HOST = 'localhost';
$DB_NAME = 'autonems';
$DB_USER = 'root';
$DB_PASS = ''; // WampServer par défaut : root sans mot de passe

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Connexion à la base de données impossible. '
            . 'Vérifiez que WampServer est démarré et que la base "autonems" existe '
            . '(voir README-wampserver.md). Détail technique : ' . $e->getMessage()
    ]);
    exit;
}