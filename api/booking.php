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

    // --- GESTION DE L'UPLOAD DE LA PIÈCE D'IDENTITÉ ---
    $id_card_path = null;
    if (isset($_FILES['identity_doc']) && $_FILES['identity_doc']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['identity_doc']['tmp_name'];
        $fileName = $_FILES['identity_doc']['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];

        if (in_array($fileExtension, $allowedExtensions)) {
            $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
            $uploadFileDir = '../uploads/ids/';

            if (!is_dir($uploadFileDir)) {
                mkdir($uploadFileDir, 0755, true);
            }

            $dest_path = $uploadFileDir . $newFileName;

            if (move_uploaded_file($fileTmpPath, $dest_path)) {
                $id_card_path = 'uploads/ids/' . $newFileName;
            }
        }
    }

    try {
        // S'assure que la table existe (avec la colonne id_card incluse) pour éviter les plantages
        $pdo->exec("CREATE TABLE IF NOT EXISTS reservations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            car_id VARCHAR(50) NOT NULL,
            client_nom VARCHAR(100) DEFAULT NULL,
            client_telephone VARCHAR(50) DEFAULT NULL,
            car_name VARCHAR(255) NOT NULL,
            until_ts BIGINT NOT NULL,
            duree_label VARCHAR(100) DEFAULT NULL,
            id_card VARCHAR(255) DEFAULT NULL,
            en_cours TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        // --- DÉBUT DE TRANSACTION SQL & VERROUILLAGE ANTI-RACE CONDITION ---
        $pdo->beginTransaction();

        // --- VÉRIFICATION SÉCURITÉ BACK-END : VÉHICULE DÉJÀ RÉSERVÉ ? ---
        if ($car_id) {
            // Utilisation de FOR UPDATE pour verrouiller et empêcher les conflits en cas de requêtes simultanées
            $stmtCheckActive = $pdo->prepare("SELECT id FROM reservations WHERE car_id = ? AND until_ts > ? FOR UPDATE");
            $stmtCheckActive->execute([$car_id, round(microtime(true) * 1000)]);
            if ($stmtCheckActive->fetch()) {
                $pdo->rollBack();
                echo json_encode([
                    'success' => false, 
                    'message' => 'Ce véhicule vient d\'être réservé par un autre utilisateur et n\'est plus disponible.'
                ]);
                exit;
            }
        }

        // --- VÉRIFICATION ANTI-DOUBLON (Moins de 5 secondes) ---
        $checkStmt = $pdo->prepare("SELECT id FROM reservations WHERE client_nom = ? AND client_telephone = ? AND car_name = ? AND created_at >= (NOW() - INTERVAL 5 SECOND)");
        $checkStmt->execute([$client_nom, $client_telephone, $car_name]);
        if ($checkStmt->fetch()) {
            $pdo->commit();
            // Un doublon récent existe déjà, on renvoie un succès fictif pour ne pas bloquer l'interface client, sans réinsérer
            echo json_encode(['success' => true, 'message' => 'Réservation déjà enregistrée avec succès !']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO reservations (car_id, client_nom, client_telephone, car_name, until_ts, duree_label, id_card, en_cours) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$car_id, $client_nom, $client_telephone, $car_name, $until_ts, $duree_label, $id_card_path]);

        // Validation de la transaction
        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Réservation enregistrée avec succès !']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
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