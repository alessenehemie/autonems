<?php
// api/booking.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Connexion à la base de données unifiée
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

// Récupération de l'action demandée (en GET ou en POST)
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- 1. CRÉER / ENREGISTRER UNE RÉSERVATION (Depuis le site public) ---
if ($action === 'create') {
    $car_id           = $_POST['car_id'] ?? null;
    $client_nom       = $_POST['client_nom'] ?? null;
    $client_telephone = $_POST['client_telephone'] ?? null;
    $car_name         = $_POST['car_name'] ?? null;
    $until_ts         = $_POST['until_ts'] ?? time();
    $duree_label      = $_POST['duree_label'] ?? null;

    if (empty($client_nom) || empty($client_telephone) || empty($car_name)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir tous les champs obligatoires (nom, téléphone, véhicule).']);
        exit;
    }

    try {
        // S'assure que la table existe pour éviter les plantages
        $pdo->exec("CREATE TABLE IF NOT EXISTS reservations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            car_id VARCHAR(50) NOT NULL,
            client_nom VARCHAR(100) DEFAULT NULL,
            client_telephone VARCHAR(50) DEFAULT NULL,
            car_name VARCHAR(255) NOT NULL,
            until_ts BIGINT NOT NULL,
            duree_label VARCHAR(100) DEFAULT NULL,
            en_cours TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $stmt = $pdo->prepare("INSERT INTO reservations (car_id, client_nom, client_telephone, car_name, until_ts, duree_label, en_cours) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$car_id, $client_nom, $client_telephone, $car_name, $until_ts, $duree_label]);

        echo json_encode(['success' => true, 'message' => 'Réservation enregistrée avec succès !']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'enregistrement : ' . $e->getMessage()]);
    }
    exit;
}

// --- 2. LISTER LES RÉSERVATIONS (Pour le tableau de bord admin) ---
if ($action === 'list') {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'reservations'");
        if ($checkTable->rowCount() == 0) {
            echo json_encode(['success' => true, 'reservations' => []]);
            exit;
        }

        $stmt = $pdo->query("SELECT * FROM reservations ORDER BY id DESC");
        $reservations = $stmt->fetchAll();

        foreach ($reservations as &$r) {
            $r['en_cours'] = isset($r['en_cours']) ? (bool)$r['en_cours'] : true;
        }

        echo json_encode(['success' => true, 'reservations' => $reservations]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- 3. SUPPRIMER UNE RÉSERVATION (Pour le tableau de bord admin) ---
if ($action === 'delete') {
    $id = $_POST['id'] ?? null;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID de réservation manquant.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM reservations WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Réservation supprimée.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);