<?php
// api/client_login.php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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

$email = $_POST['email'] ?? '';
$pass = $_POST['password'] ?? '';

if (empty($email) || empty($pass)) {
    echo json_encode(['success' => false, 'message' => 'Veuillez renseigner votre e-mail et votre mot de passe.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM clients WHERE email = ?");
    $stmt->execute([$email]);
    $client = $stmt->fetch();

    if ($client && password_verify($pass, $client['password'])) {
        // Enregistrement des données dans la session PHP
        $_SESSION['client_id'] = $client['id'];
        $_SESSION['client_nom'] = $client['nom'];
        $_SESSION['client_prenom'] = $client['prenom'];
        $_SESSION['client_email'] = $client['email'];

        echo json_encode([
            'success' => true, 
            'message' => 'Connexion réussie !',
            'client' => [
                'nom' => $client['nom'],
                'prenom' => $client['prenom']
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'E-mail ou mot de passe incorrect.']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erreur de connexion : ' . $e->getMessage()]);
}