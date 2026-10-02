<?php
// api/booking.php
header('Content-Type: application/json; charset=utf-8');
// MODIFICATION : "Access-Control-Allow-Origin: *" retiré (le site et l'API sont sur la même origine, aucun autre site n'a besoin d'appeler cette API)
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

// AJOUT : transforme un nom en identifiant (même logique que slugify() de dashboard.js)
// ex: "Range Rover (Nouvelle Gen)" -> "range-rover-nouvelle-gen"
function slugify_php($text) {
    $text = mb_strtolower(trim((string)$text), 'UTF-8');
    $text = strtr($text, [
        'à'=>'a','â'=>'a','ä'=>'a','á'=>'a','ç'=>'c','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
        'î'=>'i','ï'=>'i','í'=>'i','ô'=>'o','ö'=>'o','ó'=>'o','ù'=>'u','û'=>'u','ü'=>'u',
        'ú'=>'u','ÿ'=>'y','œ'=>'oe'
    ]);
    $text = preg_replace('/\s+/', '-', $text);
    $text = preg_replace('/[^a-z0-9_\-]+/', '', $text);
    return preg_replace('/-+/', '-', $text);
}

// AJOUT : nettoie un texte reçu (retire le HTML, limite la longueur à celle de la colonne SQL)
function clean_text($value, $max) {
    if ($value === null) return null;
    return mb_substr(trim(strip_tags((string)$value)), 0, $max);
}

// AJOUT : répare une ancienne table "reservations" (colonnes ou index UNIQUE manquants)
function ensure_reservations_columns(PDO $pdo) {
    $needed = [
        'client_nom'       => "VARCHAR(100) DEFAULT NULL",
        'client_telephone' => "VARCHAR(50) DEFAULT NULL",
        'duree_label'      => "VARCHAR(100) DEFAULT NULL",
        'id_card'          => "VARCHAR(255) DEFAULT NULL",
        'en_cours'         => "TINYINT(1) DEFAULT 1",
        'statut'           => "VARCHAR(50) DEFAULT 'En cours'",
        'mode_contact'     => "VARCHAR(50) DEFAULT 'Manuel'",
    ];
    foreach ($needed as $col => $definition) {
        $exists = $pdo->query("SHOW COLUMNS FROM reservations LIKE '" . $col . "'")->rowCount();
        if (!$exists) {
            try { $pdo->exec("ALTER TABLE reservations ADD COLUMN `$col` $definition"); } catch (Exception $e) { /* ignoré */ }
        }
    }
    $hasUnique = $pdo->query("SHOW INDEX FROM reservations WHERE Column_name = 'car_id' AND Non_unique = 0")->rowCount();
    if (!$hasUnique) {
        // Échoue silencieusement s'il existe déjà des doublons : dans ce cas, les supprimer à la main dans phpMyAdmin
        try { $pdo->exec("ALTER TABLE reservations ADD UNIQUE KEY unique_car_id (car_id)"); } catch (Exception $e) { /* ignoré */ }
    }
}

// Récupération de l'action demandée (en GET ou en POST)
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- 1. CRÉER / ENREGISTRER UNE RÉSERVATION (Depuis le site public ou l'admin) ---
if ($action === 'create') {
    $car_id           = $_POST['car_id'] ?? null;
    $client_nom       = $_POST['client_nom'] ?? null;
    $client_telephone = $_POST['client_telephone'] ?? null;
    $car_name         = $_POST['car_name'] ?? null;
    
    // --- GESTION DE LA DURÉE ET DE L'EXPIRATION EN MILLISECONDES ---
    $duration_hours   = isset($_POST['duration_hours']) ? (int)$_POST['duration_hours'] : null;
    
    if ($duration_hours) {
        // Si la durée en heures est fournie (ex: depuis l'admin avec le nouveau menu déroulant)
        $duration_hours = max(1, min($duration_hours, 720)); // AJOUT : entre 1 heure et 30 jours
        $until_ts = (int) round(microtime(true) * 1000) + ($duration_hours * 3600 * 1000);
        // Génération automatique d'un libellé propre
        $duree_label = $duration_hours >= 24 ? ($duration_hours / 24) . ' jour(s)' : $duration_hours . ' heures';
    } else {
        // Sinon, on récupère directement until_ts s'il est fourni, ou on applique 3 jours par défaut
        $nowForUntil = (int) round(microtime(true) * 1000);
        // MODIFICATION : le serveur ne fait pas confiance à until_ts envoyé par le navigateur :
        // on le borne entre "maintenant + 1 minute" et "maintenant + 30 jours".
        $until_ts    = isset($_POST['until_ts']) ? (int)$_POST['until_ts'] : ($nowForUntil + (3 * 24 * 3600 * 1000));
        $until_ts    = max($nowForUntil + 60000, min($until_ts, $nowForUntil + (30 * 24 * 3600 * 1000)));
        $duree_label = isset($_POST['duree_label']) ? clean_text($_POST['duree_label'], 100) : null;
    }

    $statut           = $_POST['statut'] ?? 'En cours'; // Récupération du statut choisi dans l'admin
    // AJOUT : seuls les statuts connus sont acceptés
    if (!in_array($statut, ['En cours', 'Confirmée', 'Terminée'], true)) { $statut = 'En cours'; }
    // AJOUT : une réservation "Terminée" ne doit pas bloquer le véhicule
    $en_cours         = ($statut === 'Terminée') ? 0 : 1;

    // AJOUT : nettoyage des textes reçus (pas de HTML, longueurs limitées)
    $client_nom       = clean_text($client_nom, 100);
    $client_telephone = clean_text($client_telephone, 50);
    $car_name         = clean_text($car_name, 255);
    $car_id           = clean_text($car_id, 50);

    if (empty($client_nom) || empty($client_telephone)) {
        echo json_encode(['success' => false, 'message' => 'Veuillez remplir tous les champs obligatoires (nom, téléphone).']);
        exit;
    }

    // Si le nom du véhicule n'est pas envoyé mais qu'on a l'ID ou le slug, on gère les deux cas
    if (empty($car_name) && !empty($car_id)) {
        // Si car_id est purement numérique (ancien format admin)
        if (is_numeric($car_id)) {
            $stmtCar = $pdo->prepare("SELECT nom FROM vehicles WHERE id = ?");
            $stmtCar->execute([$car_id]);
            $carData = $stmtCar->fetch();
            if ($carData) {
                $car_name = $carData['nom'];
                // Normalisation en slug pour unifier avec le site public
                $car_id = slugify_php($car_name);
            } else {
                $car_name = 'Véhicule #' . $car_id;
            }
        } else {
            // MODIFICATION : si c'est un slug (envoyé par l'admin), on retrouve le VRAI nom dans la table vehicles
            // (sinon "Range Rover (Nouvelle Gen)" devenait "Range Rover Nouvelle Gen" et la mise à jour dispo échouait)
            $car_name = null;
            $allCars = $pdo->query("SELECT nom FROM vehicles")->fetchAll();
            foreach ($allCars as $c) {
                if (slugify_php($c['nom']) === $car_id) { $car_name = $c['nom']; break; }
            }
            if (!$car_name) {
                $car_name = ucwords(str_replace('-', ' ', $car_id));
            }
        }
    } elseif (!empty($car_name) && empty($car_id)) {
        // Si on a le nom mais pas le car_id, on génère le slug
        $car_id = slugify_php($car_name);
    }

    // AJOUT : un véhicule doit obligatoirement être identifié (sinon une ligne avec car_id vide serait créée)
    if (!empty($car_id)) { $car_id = slugify_php($car_id); }
    if (empty($car_id) || empty($car_name)) {
        echo json_encode(['success' => false, 'message' => 'Véhicule non précisé.']);
        exit;
    }
    $car_id = mb_substr($car_id, 0, 50);

    // --- GESTION DE LA PIÈCE D'IDENTITÉ (Chemin absolu sécurisé anti-erreur HTML) ---
    $id_card_path = null;
    $fileKey = isset($_FILES['id_card']) ? 'id_card' : (isset($_FILES['identity_doc']) ? 'identity_doc' : null);

    if ($fileKey && isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES[$fileKey]['tmp_name'];
        $fileName = $_FILES[$fileKey]['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];

        // AJOUT : on vérifie aussi le vrai type du fichier (pas seulement l'extension) et sa taille (5 Mo max)
        $mimeOk = true;
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime  = $finfo ? finfo_file($finfo, $fileTmpPath) : '';
            if ($finfo) { finfo_close($finfo); }
            $mimeOk = in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true);
        }
        $sizeOk = $_FILES[$fileKey]['size'] <= 5 * 1024 * 1024;

        if (in_array($fileExtension, $allowedExtensions) && $mimeOk && $sizeOk) {
            $newFileName = bin2hex(random_bytes(16)) . '.' . $fileExtension; // MODIFICATION : nom aléatoire impossible à deviner
            
            // Chemin absolu basé sur l'emplacement réel du script
            $uploadFileDir = __DIR__ . '/../uploads/ids/';

            if (!is_dir($uploadFileDir)) {
                @mkdir($uploadFileDir, 0755, true);
            }

            // AJOUT : empêche le listing du dossier et l'exécution de scripts PHP dans uploads/ids
            $htaccessFile = $uploadFileDir . '.htaccess';
            if (!file_exists($htaccessFile)) {
                $rules = "Options -Indexes\n" . '<FilesMatch "\.(php|phtml|phar|php[0-9])$">' . "\n" . "    Require all denied\n</FilesMatch>\n";
                @file_put_contents($htaccessFile, $rules);
            }

            $dest_path = $uploadFileDir . $newFileName;

            if (@move_uploaded_file($fileTmpPath, $dest_path)) {
                $id_card_path = 'uploads/ids/' . $newFileName;
            }
        }
    }

    try {
        // S'assure que la table existe avec toutes les colonnes nécessaires et un index UNIQUE sur car_id
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
            statut VARCHAR(50) DEFAULT 'En cours',
            mode_contact VARCHAR(50) DEFAULT 'Manuel',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_car_id (car_id)
        )");

        // AJOUT : répare une ancienne table (colonnes ou index unique manquants)
        ensure_reservations_columns($pdo);

        // --- DÉBUT DE TRANSACTION SQL & VERROUILLAGE ANTI-RACE CONDITION ---
        $pdo->beginTransaction();

        // AJOUT : on refuse si ce véhicule a déjà une réservation active (évite d'écraser le client précédent).
        // FOR UPDATE verrouille la ligne : deux demandes simultanées ne peuvent plus passer en même temps.
        $nowCheck  = (int) round(microtime(true) * 1000);
        $stmtCheck = $pdo->prepare("SELECT id FROM reservations WHERE car_id = ? AND en_cours = 1 AND until_ts > ? FOR UPDATE");
        $stmtCheck->execute([$car_id, $nowCheck]);
        if ($stmtCheck->fetch()) {
            $pdo->rollBack();
            if ($id_card_path) { @unlink(__DIR__ . '/../' . $id_card_path); } // supprime la pièce d'identité envoyée pour rien
            echo json_encode(['success' => false, 'message' => 'Ce véhicule est déjà réservé.']);
            exit;
        }

        // Insertion ou mise à jour automatique si le car_id existe déjà (évite les doublons et uniformise l'admin / site public)
        $stmt = $pdo->prepare("INSERT INTO reservations (car_id, client_nom, client_telephone, car_name, until_ts, duree_label, id_card, en_cours, statut) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                               ON DUPLICATE KEY UPDATE 
                               client_nom = VALUES(client_nom),
                               client_telephone = VALUES(client_telephone),
                               car_name = VALUES(car_name),
                               until_ts = VALUES(until_ts),
                               duree_label = VALUES(duree_label),
                               id_card = VALUES(id_card),
                               en_cours = VALUES(en_cours),
                               created_at = CURRENT_TIMESTAMP,
                               statut = VALUES(statut)");
                               
        $stmt->execute([$car_id, $client_nom, $client_telephone, $car_name, $until_ts, $duree_label, $id_card_path, $en_cours, $statut]);

        // MISE À JOUR AUTOMATIQUE : Le véhicule devient indisponible (dispo = 0) dans la table vehicles
        // MODIFICATION : dispo = 0 seulement si la réservation est active, sinon le véhicule est libéré
        $stmtUpdateCar = $pdo->prepare("UPDATE vehicles SET dispo = ? WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
        $stmtUpdateCar->execute([$en_cours ? 0 : 1, $car_id, $car_name]);

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
        // Récupérer les infos de la réservation avant de la supprimer pour retrouver le véhicule associé
        $stmtGet = $pdo->prepare("SELECT car_id, car_name FROM reservations WHERE id = ?");
        $stmtGet->execute([$id]);
        $resData = $stmtGet->fetch();

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("DELETE FROM reservations WHERE id = ?");
        $stmt->execute([$id]);

        // Si la réservation est supprimée, on remet le véhicule en disponible (dispo = 1)
        if ($resData) {
            $car_id = $resData['car_id'];
            $car_name = $resData['car_name'];
            $stmtReleaseCar = $pdo->prepare("UPDATE vehicles SET dispo = 1 WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
            $stmtReleaseCar->execute([$car_id, $car_name]);
        }

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Réservation supprimée et véhicule libéré.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);