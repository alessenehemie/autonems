<?php
// api/auth_client.php
session_start();
header('Content-Type: application/json; charset=utf-8');

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

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- VÉRIFIER SI LE CLIENT EST CONNECTÉ ---
if ($action === 'check') {
    if (isset($_SESSION['client_id'])) {
        echo json_encode([
            'success' => true,
            'logged_in' => true,
            'client' => [
                'id' => $_SESSION['client_id'],
                'nom' => $_SESSION['client_nom'],
                'prenom' => $_SESSION['client_prenom']
            ]
        ]);
    } else {
        echo json_encode(['success' => true, 'logged_in' => false]);
    }
    exit;
}

// --- INSCRIPTION D'UN CLIENT ---
if ($action === 'register') {
    $nom = trim($_POST['nom'] ?? '');
    $prenom = trim($_POST['prenom'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $pass = $_POST['password'] ?? '';

    if (empty($nom) || empty($prenom) || empty($email) || empty($pass)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir tous les champs.']);
        exit;
    }

    try {
        // Vérifier si l'email existe déjà
        $check = $pdo->prepare("SELECT id FROM clients WHERE email = ?");
        $check->execute([$email]);
        if ($check->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Cet email est déjà utilisé.']);
            exit;
        }

        $hashedPassword = password_hash($pass, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO clients (nom, prenom, email, password) VALUES (?, ?, ?, ?)");
        $stmt->execute([$nom, $prenom, $email, $hashedPassword]);

        // Connecter automatiquement le client après son inscription
        $_SESSION['client_id'] = $pdo->lastInsertId();
        $_SESSION['client_nom'] = $nom;
        $_SESSION['client_prenom'] = $prenom;

        echo json_encode(['success' => true, 'message' => 'Compte créé avec succès !']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'inscription : ' . $e->getMessage()]);
    }
    exit;
}

// --- CONNEXION D'UN CLIENT ---
if ($action === 'login') {
    $email = trim($_POST['email'] ?? '');
    $pass = $_POST['password'] ?? '';

    if (empty($email) || empty($pass)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir tous les champs.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM clients WHERE email = ?");
        $stmt->execute([$email]);
        $client = $stmt->fetch();

        if ($client && password_verify($pass, $client['password'])) {
            $_SESSION['client_id'] = $client['id'];
            $_SESSION['client_nom'] = $client['nom'];
            $_SESSION['client_prenom'] = $client['prenom'];

            echo json_encode(['success' => true, 'message' => 'Connexion réussie !']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Email ou mot de passe incorrect.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la connexion : ' . $e->getMessage()]);
    }
    exit;
}

// --- DÉCONNEXION ---
if ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Déconnecté avec succès.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);