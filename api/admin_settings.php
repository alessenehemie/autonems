<?php
// api/admin_settings.php — Gère la mise à jour de l'email et/ou du mot de passe admin en BDD
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Vérifie si l'admin est connecté (corrigé pour correspondre à $_SESSION['autonems_admin'] du login)
if (!isset($_SESSION['autonems_admin']) || $_SESSION['autonems_admin'] !== true) {
    echo json_encode(['success' => false, 'message' => 'Non autorisé.']);
    exit;
}

// Connexion à la base de données
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

    // Validations de base
    if (empty($newEmail)) {
        echo json_encode(['success' => false, 'message' => "L'adresse e-mail ne peut pas être vide."]);
        exit;
    }

    if (empty($oldPassword)) {
        echo json_encode(['success' => false, 'message' => "Le mot de passe actuel est requis pour valider les modifications."]);
        exit;
    }

    try {
        // 1. Récupérer l'administrateur actuel en BDD
        $stmtAdmin = $pdo->prepare("SELECT * FROM admins WHERE email = ?");
        $stmtAdmin->execute([$currentAdminEmail]);
        $adminData = $stmtAdmin->fetch();

        if (!$adminData) {
            echo json_encode(['success' => false, 'message' => 'Administrateur introuvable en base de données.']);
            exit;
        }

        // 2. Vérifier que le mot de passe actuel saisi est correct
        if (!password_verify($oldPassword, $adminData['password'])) {
            echo json_encode(['success' => false, 'message' => 'Le mot de passe actuel est incorrect.']);
            exit;
        }

        // 3. Mettre à jour l'e-mail dans la base de données
        $stmt = $pdo->prepare("UPDATE admins SET email = ? WHERE email = ?");
        $stmt->execute([$newEmail, $currentAdminEmail]);

        // 4. Si un nouveau mot de passe est renseigné, on le hache et on le met à jour
        if (!empty($newPassword)) {
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmtPwd = $pdo->prepare("UPDATE admins SET password = ? WHERE email = ?");
            $stmtPwd->execute([$hashedPassword, $newEmail]);
        }

        // 5. Mettre à jour la session en cours avec le nouvel e-mail
        $_SESSION['admin_email'] = $newEmail;

        echo json_encode([
            'success' => true,
            'message' => 'Compte (email / mot de passe) mis à jour avec succès !',
            'email' => $newEmail
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour SQL : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Requête invalide.']);