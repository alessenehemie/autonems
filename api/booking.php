<?php
// api/booking.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Connexion à la base de données unifiée
$host = 'localhost';$dbname = 'autonems';
$username = 'root';$password = '';          

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username,$password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erreur de connexion BDD : ' . $e->getMessage()]);
    exit;
}

// Transforme un nom en identifiant (même logique que slugify() de dashboard.js)
function slugify_php($text) {
    $text = mb_strtolower(trim((string)$text), 'UTF-8');
    $text = strtr($text, [
        'à'=>'a','â'=>'a','ä'=>'a','á'=>'a','ç'=>'c','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
        'î'=>'i','ï'=>'i','í'=>'i','ô'=>'o','ö'=>'o','ó'=>'o','ù'=>'u','û'=>'u','ü'=>'u',
        'ú'=>'u','ÿ'=>'y','œ'=>'oe'
    ]);
    $text = preg_replace('/\s+/', '-',$text);
    $text = preg_replace('/[^a-z0-9_\-]+/', '',$text);
    return preg_replace('/-+/', '-', $text);
}

// Nettoie un texte reçu (retire le HTML, limite la longueur à celle de la colonne SQL)
function clean_text($value,$max) {
    if ($value === null) return null;
    return mb_substr(trim(strip_tags((string)$value)), 0,$max);
}

// Répare une ancienne table "reservations" (colonnes ou index manquants)
function ensure_reservations_columns(PDO $pdo) {$needed = [
        'client_nom'          => "VARCHAR(100) DEFAULT NULL",
        'client_telephone'    => "VARCHAR(50) DEFAULT NULL",
        'duree_label'         => "VARCHAR(100) DEFAULT NULL",
        'id_card'             => "VARCHAR(255) DEFAULT NULL",
        'id_card_number'      => "VARCHAR(50) DEFAULT NULL",
        'driver_license'      => "VARCHAR(255) DEFAULT NULL",
        'driver_license_file' => "VARCHAR(255) DEFAULT NULL",
        'payment_method'      => "VARCHAR(50) DEFAULT NULL",
        'en_cours'            => "TINYINT(1) DEFAULT 1",
        'statut'              => "VARCHAR(50) DEFAULT 'En cours'",
        'mode_contact'        => "VARCHAR(50) DEFAULT 'Manuel'",
    ];
    foreach ($needed as $col =>$definition) {
        $exists =$pdo->query("SHOW COLUMNS FROM reservations LIKE '" . $col . "'")->rowCount();
        if (!$exists) {
            try { $pdo->exec("ALTER TABLE reservations ADD COLUMN `$col` $definition"); } catch (Exception $e) { /* ignoré */ }
        }
    }
    
    // Modification : Vérifie si un index simple existe déjà, sinon le crée (et nettoie l'ancien index unique si présent)
    $hasIndex =$pdo->query("SHOW INDEX FROM reservations WHERE Column_name = 'car_id'")->rowCount();
    if (!$hasIndex) {
        try { $pdo->exec("ALTER TABLE reservations ADD KEY idx_car_id (car_id)"); } catch (Exception $e) { /* ignoré */ }
    }
}

// Récupération de l'action demandée (en GET ou en POST)
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- 1. CRÉER / ENREGISTRER UNE RÉSERVATION (Depuis le site public ou l'admin) ---
if ($action === 'create') {
    $car_id           =$_POST['car_id'] ?? null;
    $client_nom       =$_POST['client_nom'] ?? null;
    $client_telephone =$_POST['client_telephone'] ?? null;
    $car_name         =$_POST['car_name'] ?? null;
    
    // --- GESTION DE LA DURÉE ET DE L'EXPIRATION EN MILLISECONDES ---
    $duration_hours   = isset($_POST['duration_hours']) ? (int)$_POST['duration_hours'] : null;
    
    if ($duration_hours) {
        $duration_hours = max(1, min($duration_hours, 720));
        $until_ts = (int) round(microtime(true) * 1000) + ($duration_hours * 3600 * 1000);
        $duree_label =$duration_hours >= 24 ? ($duration_hours / 24) . ' jour(s)' :$duration_hours . ' heures';
    } else {
        $nowForUntil = (int) round(microtime(true) * 1000);$until_ts    = isset($_POST['until_ts']) ? (int)$_POST['until_ts'] : ($nowForUntil + (3 * 24 * 3600 * 1000));$until_ts    = max($nowForUntil + 60000, min($until_ts, $nowForUntil + (30 * 24 * 3600 * 1000)));$duree_label = isset($_POST['duree_label']) ? clean_text($_POST['duree_label'], 100) : null;
    }

    $statut           =$_POST['statut'] ?? 'En cours';
    if (!in_array($statut, ['En cours', 'Confirmée', 'Terminée'], true)) { $statut = 'En cours'; }
    $en_cours         = ($statut === 'Terminée') ? 0 : 1;

    // --- RÉCEPTION DES NOUVEAUX CHAMPS (Permis & Paiement) ---
    $id_card_number   = clean_text($_POST['id_card_number'] ?? null, 50);
    $driver_license   = clean_text($_POST['driver_license'] ?? null, 255);
    $payment_method   = clean_text($_POST['payment_method'] ?? null, 50);

    // Nettoyage des textes reçus
    $client_nom       = clean_text($client_nom, 100);
    $client_telephone = clean_text($client_telephone, 50);
    $car_name         = clean_text($car_name, 255);
    $car_id           = clean_text($car_id, 50);

    if (empty($client_nom) || empty($client_telephone)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir tous les champs obligatoires (nom, téléphone).']);
        exit;
    }

    if (empty($car_name) && !empty($car_id)) {
        if (is_numeric($car_id)) {
            $stmtCar =$pdo->prepare("SELECT nom FROM vehicles WHERE id = ?");
            $stmtCar->execute([$car_id]);
            $carData =$stmtCar->fetch();
            if ($carData) {
                $car_name =$carData['nom'];
                $car_id = slugify_php($car_name);
            } else {
                $car_name = 'Véhicule #' . $car_id;
            }
        } else {
            $car_name = null;
            $allCars =$pdo->query("SELECT nom FROM vehicles")->fetchAll();
            foreach ($allCars as$c) {
                if (slugify_php($c['nom']) ===$car_id) { $car_name =$c['nom']; break; }
            }
            if (!$car_name) {
                $car_name = ucwords(str_replace('-', ' ',$car_id));
            }
        }
    } elseif (!empty($car_name) && empty($car_id)) {
        $car_id = slugify_php($car_name);
    }

    if (!empty($car_id)) { $car_id = slugify_php($car_id); }
    if (empty($car_id) || empty($car_name)) {
        echo json_encode(['success' => false, 'message' => 'Véhicule non précisé.']);
        exit;
    }
    $car_id = mb_substr($car_id, 0, 50);

    // --- GESTION DE LA PIÈCE D'IDENTITÉ ---
    $id_card_path = null;
    $fileKey = isset($_FILES['id_card']) ? 'id_card' : (isset($_FILES['identity_doc']) ? 'identity_doc' : null);

    if ($fileKey && isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath =$_FILES[$fileKey]['tmp_name'];$fileName = $_FILES[$fileKey]['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];

        $mimeOk = true;
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime  =$finfo ? finfo_file($finfo,$fileTmpPath) : '';
            if ($finfo) { finfo_close($finfo); }
            $mimeOk = in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true);
        }
        $sizeOk = $_FILES[$fileKey]['size'] <= 5 * 1024 * 1024;

        if (in_array($fileExtension,$allowedExtensions) && $mimeOk &&$sizeOk) {
            $newFileName = bin2hex(random_bytes(16)) . '.' .$fileExtension;
            $uploadFileDir = __DIR__ . '/../uploads/ids/';

            if (!is_dir($uploadFileDir)) {
                @mkdir($uploadFileDir, 0755, true);
            }

            $htaccessFile =$uploadFileDir . '.htaccess';
            if (!file_exists($htaccessFile)) {
                $rules = "Options -Indexes\n" . '<FilesMatch "\.(php|phtml|phar|php[0-9])$">' . "\n" . "    Require all denied\n</FilesMatch>\n";
                @file_put_contents($htaccessFile,$rules);
            }

            $dest_path = $uploadFileDir .$newFileName;

            if (@move_uploaded_file($fileTmpPath,$dest_path)) {
                $id_card_path = 'uploads/ids/' .$newFileName;
            }
        }
    }

    // --- GESTION DE L'UPLOAD DU PERMIS DE CONDUIRE ---
    $driver_license_path = null;
    if (isset($_FILES['driver_license_file']) &&$_FILES['driver_license_file']['error'] === UPLOAD_ERR_OK) {
        $dlTmpPath =$_FILES['driver_license_file']['tmp_name'];
        $dlFileName =$_FILES['driver_license_file']['name'];
        $dlFileExtension = strtolower(pathinfo($dlFileName, PATHINFO_EXTENSION));

        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];

        $dlMimeOk = true;
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime  =$finfo ? finfo_file($finfo,$dlTmpPath) : '';
            if ($finfo) { finfo_close($finfo); }
            $dlMimeOk = in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true);
        }
        $dlSizeOk =$_FILES['driver_license_file']['size'] <= 5 * 1024 * 1024;

        if (in_array($dlFileExtension,$allowedExtensions) && $dlMimeOk &&$dlSizeOk) {
            $newDlFileName = 'permis_' . bin2hex(random_bytes(16)) . '.' . $dlFileExtension;
            $uploadFileDir = __DIR__ . '/../uploads/ids/';

            if (!is_dir($uploadFileDir)) {
                @mkdir($uploadFileDir, 0755, true);
            }

            $dest_path = $uploadFileDir .$newDlFileName;

            if (@move_uploaded_file($dlTmpPath,$dest_path)) {
                $driver_license_path = 'uploads/ids/' .$newDlFileName;
            }
        }
    }

    // --- CONTRÔLE SERVEUR (formulaire public) ---
    // Le site public n'envoie pas de "statut" : dans ce cas, tous les documents sont obligatoires
    // (un envoi direct à l'API sans passer par le formulaire est donc refusé).
    if (!isset($_POST['statut'])) {
        $missing = [];
        if (empty($id_card_number))    { $missing[] = 'numéro de CNI'; }
        if (!$id_card_path)            { $missing[] = 'photo de la CNI (JPG, PNG ou PDF, 5 Mo max)'; }
        if (empty($driver_license))    { $missing[] = 'numéro de permis'; }
        if (!$driver_license_path)     { $missing[] = 'photo du permis (JPG, PNG ou PDF, 5 Mo max)'; }
        if (empty($payment_method))    { $missing[] = 'mode de paiement'; }
        if ($missing) {
            if ($id_card_path)         { @unlink(__DIR__ . '/../' . $id_card_path); }
            if ($driver_license_path)  { @unlink(__DIR__ . '/../' . $driver_license_path); }
            echo json_encode(['success' => false, 'message' => 'Informations manquantes ou invalides : ' . implode(', ', $missing) . '.']);
            exit;
        }
    }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS reservations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            car_id VARCHAR(50) NOT NULL,
            client_nom VARCHAR(100) DEFAULT NULL,
            client_telephone VARCHAR(50) DEFAULT NULL,
            car_name VARCHAR(255) NOT NULL,
            until_ts BIGINT NOT NULL,
            duree_label VARCHAR(100) DEFAULT NULL,
            id_card VARCHAR(255) DEFAULT NULL,
            id_card_number VARCHAR(50) DEFAULT NULL,
            driver_license VARCHAR(255) DEFAULT NULL,
            driver_license_file VARCHAR(255) DEFAULT NULL,
            payment_method VARCHAR(50) DEFAULT NULL,
            en_cours TINYINT(1) DEFAULT 1,
            statut VARCHAR(50) DEFAULT 'En cours',
            mode_contact VARCHAR(50) DEFAULT 'Manuel',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_car_id (car_id)
        )");

        ensure_reservations_columns($pdo);

        $pdo->beginTransaction();

        $nowCheck  = (int) round(microtime(true) * 1000);
        $stmtCheck =$pdo->prepare("SELECT id FROM reservations WHERE car_id = ? AND en_cours = 1 AND (until_ts > ? OR statut = 'Confirmée') FOR UPDATE");
        $stmtCheck->execute([$car_id,$nowCheck]);
        if ($stmtCheck->fetch()) {$pdo->rollBack();
            if ($id_card_path) { @unlink(__DIR__ . '/../' .$id_card_path); }
            if ($driver_license_path) { @unlink(__DIR__ . '/../' .$driver_license_path); }
            echo json_encode(['success' => false, 'message' => 'Ce véhicule est déjà réservé.']);
            exit;
        }

        // Modification : Insertion simple sans ON DUPLICATE KEY UPDATE pour conserver l'historique complet
        $stmt =$pdo->prepare("INSERT INTO reservations (car_id, client_nom, client_telephone, car_name, until_ts, duree_label, id_card, id_card_number, driver_license, driver_license_file, payment_method, en_cours, statut) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                               
        $stmt->execute([
            $car_id,$client_nom, $client_telephone,$car_name, $until_ts,$duree_label, $id_card_path,$id_card_number, $driver_license, $driver_license_path,$payment_method, $en_cours,$statut
        ]);

        // "En cours de réservation" : on ne touche pas à "dispo" (le site affiche l'état via la table reservations).
        // "Réservé" (Confirmée) => véhicule indisponible ; "Terminée" => véhicule libéré.
        if ($statut === 'Confirmée' || $statut === 'Terminée') {
            $stmtUpdateCar =$pdo->prepare("UPDATE vehicles SET dispo = ? WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
            $stmtUpdateCar->execute([$statut === 'Confirmée' ? 0 : 1, $car_id,$car_name]);
        }

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Réservation enregistrée avec succès !']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {$pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'enregistrement : ' . $e->getMessage()]);
    }
    exit;
}

// --- 2. LISTER LES RÉSERVATIONS (Pour le tableau de bord admin) ---
if ($action === 'list') {
    try {
        $checkTable =$pdo->query("SHOW TABLES LIKE 'reservations'");
        if ($checkTable->rowCount() == 0) {
            echo json_encode(['success' => true, 'reservations' => []]);
            exit;
        }

        $stmt =$pdo->query("SELECT * FROM reservations ORDER BY id DESC");
        $reservations =$stmt->fetchAll();

        foreach ($reservations as &$r) {$r['en_cours'] = isset($r['en_cours']) ? (bool)$r['en_cours'] : true;
        }

        echo json_encode(['success' => true, 'reservations' => $reservations]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- LISTE PUBLIQUE (site client) : uniquement l'état des véhicules, aucune donnée personnelle ---
if ($action === 'public_list') {
    try {
        $out = [];
        if ($pdo->query("SHOW TABLES LIKE 'reservations'")->rowCount() > 0) {
            $now  = (int) round(microtime(true) * 1000);
            $stmt = $pdo->prepare("SELECT car_id, car_name, until_ts, statut FROM reservations
                                   WHERE en_cours = 1 AND (until_ts > ? OR statut = 'Confirmée') ORDER BY id ASC");
            $stmt->execute([$now]);
            foreach ($stmt->fetchAll() as $r) {
                $out[$r['car_id']] = [
                    'car'     => $r['car_name'],
                    'carName' => $r['car_name'],
                    'until'   => (int) $r['until_ts'],
                    'statut'  => $r['statut'] ?: 'En cours'
                ];
            }
        }
        echo json_encode((object) $out, JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// --- MODIFIER LE STATUT D'UNE RÉSERVATION (admin) : En cours de réservation -> Réservé -> Terminée ---
if ($action === 'update_status') {
    $id     = $_POST['id'] ?? null;
    $statut = $_POST['statut'] ?? '';
    if (empty($id) || !in_array($statut, ['En cours', 'Confirmée', 'Terminée'], true)) {
        echo json_encode(['success' => false, 'message' => 'Réservation ou statut invalide.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $stmtGet = $pdo->prepare("SELECT car_id, car_name FROM reservations WHERE id = ? FOR UPDATE");
        $stmtGet->execute([$id]);
        $resData = $stmtGet->fetch();
        if (!$resData) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Réservation introuvable.']);
            exit;
        }

        $en_cours = ($statut === 'Terminée') ? 0 : 1;
        $stmt = $pdo->prepare("UPDATE reservations SET statut = ?, en_cours = ? WHERE id = ?");
        $stmt->execute([$statut, $en_cours, $id]);

        // Réservé (Confirmée) => véhicule indisponible ; sinon => véhicule libéré
        $stmtCar = $pdo->prepare("UPDATE vehicles SET dispo = ? WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
        $stmtCar->execute([$statut === 'Confirmée' ? 0 : 1, $resData['car_id'], $resData['car_name']]);

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Statut mis à jour.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
    }
    exit;
}

// --- 3. SUPPRIMER UNE RÉSERVATION (Pour le tableau de bord admin) ---
if ($action === 'delete') {
    $id =$_POST['id'] ?? null;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID de réservation manquant.']);
        exit;
    }

    try {
        $stmtGet =$pdo->prepare("SELECT car_id, car_name FROM reservations WHERE id = ?");
        $stmtGet->execute([$id]);
        $resData =$stmtGet->fetch();

        $pdo->beginTransaction();

        $stmt =$pdo->prepare("DELETE FROM reservations WHERE id = ?");
        $stmt->execute([$id]);

        if ($resData) {
            $car_id =$resData['car_id'];
            $car_name =$resData['car_name'];
            $stmtReleaseCar =$pdo->prepare("UPDATE vehicles SET dispo = 1 WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
            $stmtReleaseCar->execute([$car_id,$car_name]);
        }

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Réservation supprimée et véhicule libéré.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {$pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);