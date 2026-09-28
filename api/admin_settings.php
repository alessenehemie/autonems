<?php
// api/admin_settings.php — Gère la mise à jour permanente de l'email et du mot de passe admin en BDD
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Vérifie si l'admin est connecté
if (!isset($_SESSION['admin_logged']) || $_SESSION['admin_logged'] !== true) {
    echo json_encode(['success' => false, 'message' => 'Non autorisé.']);
    exit;
}

// Connexion à la base de données unifiée (identique à booking.php)
$host = 'localhost';
$dbname = 'autonems';
$username = 'root';      
$password = '';          

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erreur de connexion BDD : ' . $e->getMessage()]);
    exit;
}

// Traitement de la mise à jour du compte
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_account') {
    $newEmail          = trim($_POST['email'] ?? '');
    $oldPassword       = $_POST['old_password'] ?? '';
    $newPassword       = $_POST['new_password'] ?? '';
    $currentAdminEmail = $_SESSION['admin_email'] ?? '';

    if (empty($newEmail)) {
        echo json_encode(['success' => false, 'message' => "L'adresse e-mail ne peut pas être vide."]);
        exit;
    }

    try {
        // 1. Mise à jour de l'e-mail dans la base de données (table 'admins')
        // Assure-toi que ta table s'appelle bien 'admins' et possède les colonnes 'email' et 'password'
        $stmt = $pdo->prepare("UPDATE admins SET email = ? WHERE email = ?");
        $stmt->execute([$newEmail, $currentAdminEmail]);

        // 2. Si un nouveau mot de passe est renseigné, on le met à jour de façon sécurisée (hash)
        if (!empty($newPassword)) {
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmtPwd = $pdo->prepare("UPDATE admins SET password = ? WHERE email = ?");
            $stmtPwd->execute([$hashedPassword, $newEmail]);
        }

        // 3. Mise à jour de la session en cours pour refléter le nouveau mail immédiatement
        $_SESSION['admin_email'] = $newEmail;

        echo json_encode([
            'success' => true,
            'message' => 'Paramètres mis à jour et enregistrés avec succès dans la base de données !',
            'email' => $newEmail
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour SQL : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Requête invalide.']);