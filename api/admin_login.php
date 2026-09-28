<?php
session_start();
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

// Récupérer les données JSON envoyées par JavaScript
$data = json_decode(file_get_contents('php://input'), true);

$email = $data['email'] ?? '';
$password = $data['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Veuillez remplir tous les champs.']);
    exit;
}

try {
    // Chercher l'administrateur dans la base de données
    $stmt = $pdo->prepare("SELECT * FROM admins WHERE email = ?");
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    // Vérifier si l'admin existe et si le mot de passe correspond au hash
    if ($admin && password_verify($password, $admin['password'])) {
        // Initialiser la session sécurisée
        $_SESSION['autonems_admin'] = true;
        $_SESSION['admin_email'] = $admin['email'];

        echo json_encode(['success' => true, 'message' => 'Connexion réussie']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Email ou mot de passe incorrect.']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur serveur : ' . $e->getMessage()]);
}