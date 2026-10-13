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

// Nettoie un texte reçu (retire le HTML, limite la longueur à celle de la colonne SQL)
function clean_text($value, $max) {
    if ($value === null) return null;
    return mb_substr(trim(strip_tags((string)$value)), 0, $max);
}

// Enregistre une photo de document (CNI / permis) de façon sécurisée :
// extension + type MIME contrôlés (jpg, png, pdf), 5 Mo max, nom aléatoire, dossier protégé contre l'exécution de PHP.
// $keys = noms possibles du champ fichier (site public et tableau de bord n'utilisent pas les mêmes noms).
function save_uploaded_doc(array $keys, $prefix) {
    foreach ($keys as $key) {
        if (!isset($_FILES[$key]) || $_FILES[$key]['error'] !== UPLOAD_ERR_OK) continue;

        $tmp = $_FILES[$key]['tmp_name'];
        $ext = strtolower(pathinfo($_FILES[$key]['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'pdf'], true)) return null;
        if ($_FILES[$key]['size'] > 5 * 1024 * 1024) return null;

        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime  = $finfo ? finfo_file($finfo, $tmp) : '';
            if ($finfo) { finfo_close($finfo); }
            if (!in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true)) return null;
        }

        $dir = __DIR__ . '/../uploads/ids/';
        if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
        $htaccess = $dir . '.htaccess';
        if (!file_exists($htaccess)) {
            @file_put_contents($htaccess, "Options -Indexes\n" . '<FilesMatch "\.(php|phtml|phar|php[0-9])$">' . "\n" . "    Require all denied\n</FilesMatch>\n");
        }

        $name = $prefix . bin2hex(random_bytes(16)) . '.' . $ext;
        if (@move_uploaded_file($tmp, $dir . $name)) return 'uploads/ids/' . $name;
        return null;
    }
    return null;
}

// Ajoute les colonnes "verified" / "verified_at" si la table "sales" existe déjà sans elles
function ensure_sales_columns(PDO $pdo) {
    $needed = [
        'verified'    => "TINYINT(1) NOT NULL DEFAULT 0",
        'verified_at' => "DATETIME NULL DEFAULT NULL",
    ];
    foreach ($needed as $col => $definition) {
        $exists = $pdo->query("SHOW COLUMNS FROM sales LIKE '" . $col . "'")->rowCount();
        if (!$exists) {
            try { $pdo->exec("ALTER TABLE sales ADD COLUMN `$col` $definition"); } catch (Exception $e) { /* ignoré */ }
        }
    }
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

    // Nettoyage des textes reçus (le tableau de bord affiche ces valeurs telles quelles : on retire tout HTML)
    $car_name              = clean_text($car_name, 255);
    $car_details           = clean_text($car_details, 2000);
    $buyer_nom             = clean_text($buyer_nom, 100);
    $buyer_telephone       = clean_text($buyer_telephone, 50);
    $payment_method        = clean_text($payment_method, 50);
    $id_card_number        = clean_text($id_card_number, 100);
    $driver_license_number = clean_text($driver_license_number, 100);
    $sale_price            = is_numeric($sale_price) ? max(0, (float) $sale_price) : 0;

    if (empty($buyer_nom) || empty($buyer_telephone) || empty($car_name)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir les informations obligatoires (nom, téléphone, véhicule).']);
        exit;
    }

    // Photos enregistrées dans uploads/ids/ (dossier protégé, noms aléatoires, types contrôlés).
    // Le site public envoie "idCardFile" / "driverLicenseFile", le tableau de bord envoie "id_card_path" / "driver_license_path".
    $idCardPath        = save_uploaded_doc(['idCardFile', 'id_card_path'], 'cni_');
    $driverLicensePath = save_uploaded_doc(['driverLicenseFile', 'driver_license_path'], 'permis_');

    // --- CONTRÔLE SERVEUR (formulaire d'achat du site) ---
    // Le site public envoie "car_details" : dans ce cas, numéros et photos CNI / permis sont obligatoires
    // (un envoi direct à l'API sans passer par le formulaire est donc refusé).
    if (isset($_POST['car_details'])) {
        $missing = [];
        if (empty($id_card_number))        { $missing[] = 'numéro de CNI'; }
        if (!$idCardPath)                  { $missing[] = 'photo de la CNI (JPG, PNG ou PDF, 5 Mo max)'; }
        if (empty($driver_license_number)) { $missing[] = 'numéro de permis'; }
        if (!$driverLicensePath)           { $missing[] = 'photo du permis (JPG, PNG ou PDF, 5 Mo max)'; }
        if ($missing) {
            if ($idCardPath)        { @unlink(__DIR__ . '/../' . $idCardPath); }
            if ($driverLicensePath) { @unlink(__DIR__ . '/../' . $driverLicensePath); }
            echo json_encode(['success' => false, 'message' => 'Informations manquantes ou invalides : ' . implode(', ', $missing) . '.']);
            exit;
        }

        // Cohérence : la CNI et le permis doivent être deux documents différents (numéros et photos)
        $normCni    = preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $id_card_number));
        $normPermis = preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $driver_license_number));
        $sameNumber = ($normCni !== '' && $normCni === $normPermis);
        $samePhoto  = ($idCardPath && $driverLicensePath
                       && sha1_file(__DIR__ . '/../' . $idCardPath) === sha1_file(__DIR__ . '/../' . $driverLicensePath));
        if ($sameNumber || $samePhoto) {
            if ($idCardPath)        { @unlink(__DIR__ . '/../' . $idCardPath); }
            if ($driverLicensePath) { @unlink(__DIR__ . '/../' . $driverLicensePath); }
            echo json_encode(['success' => false, 'message' => $sameNumber
                ? 'Le numéro de permis doit être différent du numéro de CNI.'
                : 'La photo de la CNI et celle du permis doivent être deux documents différents.']);
            exit;
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
            verified TINYINT(1) NOT NULL DEFAULT 0,
            verified_at DATETIME NULL DEFAULT NULL,
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

// --- MARQUER UN DOSSIER COMME VÉRIFIÉ / À VÉRIFIER (admin : contrôle visuel des photos CNI et permis) ---
if ($action === 'set_verified') {
    $id       = $_POST['id'] ?? null;
    $verified = (isset($_POST['verified']) && $_POST['verified'] == '1') ? 1 : 0;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID de vente manquant.']);
        exit;
    }

    try {
        ensure_sales_columns($pdo);
        $stmt = $pdo->prepare("UPDATE sales SET verified = ?, verified_at = " . ($verified ? "NOW()" : "NULL") . " WHERE id = ?");
        $stmt->execute([$verified, $id]);
        echo json_encode(['success' => true, 'message' => $verified ? 'Dossier marqué comme vérifié.' : 'Vérification annulée.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
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