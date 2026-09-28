<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/db.php';

function admin_require_login() {
    if (!isset($_SESSION['autonems_admin']) || $_SESSION['autonems_admin'] !== true) {
        http_response_code(401);
        echo json_encode(['error' => 'Accès non autorisé. Veuillez vous connecter.']);
        exit;
    }
}