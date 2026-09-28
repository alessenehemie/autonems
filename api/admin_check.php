<?php
require_once __DIR__ . '/admin_auth.php';
header('Content-Type: application/json; charset=utf-8');

if (isset($_SESSION['autonems_admin']) && $_SESSION['autonems_admin'] === true) {
    echo json_encode(['loggedIn' => true, 'email' => $_SESSION['admin_email'] ?? '']);
} else {
    echo json_encode(['loggedIn' => false]);
}
exit;