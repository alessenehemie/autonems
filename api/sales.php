<?php
// api/sales.php — Gère l'enregistrement et la liste des voitures vendues
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- 1. ENREGISTRER UNE VENTE ---
if ($action === 'create') {
    $car_name              = $_POST['car_name'] ?? null;
    $car_details           = $_POST['car_details'] ?? null; 
    $buyer_nom             = $_POST['buyer_nom'] ?? null;
    $buyer_telephone       = $_POST['buyer_telephone'] ?? null;
    $sale_price            = $_POST['sale_price'] ?? null;
    $payment_method        = $_POST['payment_method'] ?? null;
    $id_card_number        = $_POST['id_card_number'] ?? null;
    $driver_license_number = $_POST['driver_license_number'] ?? null;

    if (empty($buyer_nom) || empty($buyer_telephone) || empty($car_name)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir les informations obligatoires (nom, téléphone, véhicule).']);
        exit;
    }

    // Utilisation directe de ton sous-dossier uploads existant (situé à la racine du projet par rapport à api/)
    $uploadDir = '../uploads/';
    $idCardPath = null;
    $driverLicensePath = null;

    // Traitement de la photo CNI
    if (isset($_FILES['idCardFile']) && $_FILES['idCardFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpName = $_FILES['idCardFile']['tmp_name'];
        $fileName = time() . '_cni_' . basename($_FILES['idCardFile']['name']);
        $destination = $uploadDir . $fileName;
        if (move_uploaded_file($fileTmpName, $destination)) {
            $idCardPath = 'uploads/' . $fileName;
        }
    }

    // Traitement de la photo du Permis
    if (isset($_FILES['driverLicenseFile']) && $_FILES['driverLicenseFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpName = $_FILES['driverLicenseFile']['tmp_name'];
        $fileName = time() . '_permis_' . basename($_FILES['driverLicenseFile']['name']);
        $destination = $uploadDir . $fileName;
        if (move_uploaded_file($fileTmpName, $destination)) {
            $driverLicensePath = 'uploads/' . $fileName;
        }
    }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS sales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            car_name VARCHAR(255) NOT NULL,
            car_details TEXT DEFAULT NULL,
            buyer_nom VARCHAR(100) NOT NULL,
            buyer_telephone VARCHAR(50) NOT NULL,
            sale_price DECIMAL(12,2) DEFAULT 0,
            payment_method VARCHAR(50) DEFAULT NULL,
            id_card_number VARCHAR(100) DEFAULT NULL,
            driver_license_number VARCHAR(100) DEFAULT NULL,
            id_card_path VARCHAR(255) DEFAULT NULL,
            driver_license_path VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $stmt = $pdo->prepare("INSERT INTO sales (car_name, car_details, buyer_nom, buyer_telephone, sale_price, payment_method, id_card_number, driver_license_number, id_card_path, driver_license_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->execute([
            $car_name, 
            $car_details, 
            $buyer_nom, 
            $buyer_telephone, 
            $sale_price, 
            $payment_method, 
            $id_card_number, 
            $driver_license_number, 
            $idCardPath, 
            $driverLicensePath
        ]);

        echo json_encode(['success' => true, 'message' => 'Vente et documents enregistrés avec succès !']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'enregistrement de la vente : ' . $e->getMessage()]);
    }
    exit;
}

// --- 2. LISTER LES VENTES ---
if ($action === 'list') {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'sales'");
        if ($checkTable->rowCount() == 0) {
            echo json_encode(['success' => true, 'sales' => []]);
            exit;
        }

        $stmt = $pdo->query("SELECT * FROM sales ORDER BY id DESC");
        $sales = $stmt->fetchAll();

        echo json_encode(['success' => true, 'sales' => $sales]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- 3. SUPPRIMER UNE VENTE ---
if ($action === 'delete') {
    $id = $_POST['id'] ?? null;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID de vente manquant.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM sales WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Vente supprimée.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);