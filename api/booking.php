<?php
// api/booking.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* Durée pendant laquelle un dossier « En cours de réservation » bloque le véhicule (depuis sa création).
   Passé ce délai, le véhicule est de nouveau réservable, mais le dossier reste visible dans l'admin (« délai dépassé »). */
define('RESERVATION_HOLD_HOURS', 2);
define('RESERVATION_HOLD_MS', RESERVATION_HOLD_HOURS * 3600 * 1000);

/* Condition SQL : la réservation bloque le véhicule si elle est « Réservé » (Confirmée),
   ou « En cours » depuis moins de RESERVATION_HOLD_HOURS heures. Un seul paramètre « ? » = l'heure actuelle en ms. */
function hold_condition() {
    return "(statut = 'Confirmée' OR (COALESCE(NULLIF(statut, ''), 'En cours') = 'En cours' AND UNIX_TIMESTAMP(created_at) * 1000 + " . RESERVATION_HOLD_MS . " > ?))";
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

require_once __DIR__ . '/reservation_archive.php'; // fin automatique des réservations expirées

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

if (!function_exists('slugify_name')) {
function slugify_name($text) {
    $t = mb_strtolower((string) $text, 'UTF-8');
    if (class_exists('Normalizer')) {
        $n = Normalizer::normalize($t, Normalizer::FORM_D);
        if ($n !== false) { $t = $n; }
        $t = preg_replace('/[\x{0300}-\x{036f}]/u', '', $t);
    } else {
        $c = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $t);
        if ($c !== false) { $t = preg_replace('/[`\'^"~]/', '', $c); }
    }
    $t = preg_replace('/[\s\x{00A0}\x{2000}-\x{200B}\x{202F}\x{3000}]+/u', '-', $t);
    $t = preg_replace('/[^a-z0-9_\-]+/', '', $t);
    return preg_replace('/-{2,}/', '-', $t);
}
}

// Ce véhicule est-il « en cours d'achat » (vente au statut « en_cours » dans sales) ?
function sale_in_progress(PDO $pdo, ...$names) {
    $slugs = array_values(array_filter(array_map('slugify_name', $names)));
    if (!$slugs) return false;
    try {
        foreach ($pdo->query("SELECT car_name FROM sales WHERE statut = 'en_cours'")->fetchAll() as $row) {
            if (in_array(slugify_name($row['car_name']), $slugs, true)) return true;
        }
    } catch (Exception $e) { /* table sales absente : aucune vente en cours */ }
    return false;
}

// Nettoie un texte reçu (retire le HTML, limite la longueur à celle de la colonne SQL)
function clean_text($value,$max) {
    if ($value === null) return null;
    return mb_substr(trim(strip_tags((string)$value)), 0,$max);
}

// Supprime des fichiers déjà enregistrés (en cas de refus ou d'erreur après l'upload)
function remove_uploaded(...$paths) {
    foreach ($paths as $p) {
        if ($p && strpos($p, 'uploads/ids/') === 0 && strpos($p, '..') === false) { @unlink(__DIR__ . '/../' . $p); }
    }
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
        'verified'            => "TINYINT(1) NOT NULL DEFAULT 0",
        'verified_at'         => "DATETIME NULL DEFAULT NULL",
    ];
    foreach ($needed as $col =>$definition) {
        $exists =$pdo->query("SHOW COLUMNS FROM reservations LIKE '" . $col . "'")->rowCount();
        if (!$exists) {
            try { $pdo->exec("ALTER TABLE reservations ADD COLUMN `$col` $definition"); } catch (Exception $e) { /* ignoré */ }
        }
    }
    
    $hasIndex =$pdo->query("SHOW INDEX FROM reservations WHERE Column_name = 'car_id'")->rowCount();
    if (!$hasIndex) {
        try { $pdo->exec("ALTER TABLE reservations ADD KEY idx_car_id (car_id)"); } catch (Exception $e) { /* ignoré */ }
    }
}

// Récupération de l'action demandée (en GET ou en POST)
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- PROTECTION ADMIN ---
function require_admin_session() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['autonems_admin']) || $_SESSION['autonems_admin'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Accès non autorisé. Veuillez vous connecter en tant qu\'administrateur.']);
        exit;
    }
}
if (in_array($action, ['list', 'update_status', 'set_verified', 'delete'], true)) {
    require_admin_session();
}

// --- 1. CRÉER / ENREGISTRER UNE RÉSERVATION OU UNE INSCRIPTION EN ATTENTE ---
if ($action === 'create') {
    $car_id           = $_POST['car_id'] ?? null;
    $client_nom       = $_POST['client_nom'] ?? null;
    $client_telephone = $_POST['client_telephone'] ?? null;
    $car_name         = $_POST['car_name'] ?? null;
    
    // Détection si on est en mode "liste_attente" (provenant de script.js)
    $resMode          = $_POST['mode'] ?? $_POST['statut'] ?? 'En cours';
    $isWaitingList    = ($resMode === 'liste_attente');

    // --- GESTION DE LA DURÉE ET DE L'EXPIRATION EN MILLISECONDES ---
    $duration_hours   = isset($_POST['duration_hours']) ? (int)$_POST['duration_hours'] : null;
    
    if ($duration_hours) {
        $duration_hours = max(1, min($duration_hours, 720));
        $until_ts = (int) round(microtime(true) * 1000) + ($duration_hours * 3600 * 1000);
        $duree_label =$duration_hours >= 24 ? ($duration_hours / 24) . ' jour(s)' :$duration_hours . ' heures';
    } else {
        $nowForUntil = (int) round(microtime(true) * 1000);
        $until_ts    = isset($_POST['until_ts']) ? (int)$_POST['until_ts'] : ($nowForUntil + (3 * 24 * 3600 * 1000));
        $until_ts    = max($nowForUntil + 60000, min($until_ts, $nowForUntil + (30 * 24 * 3600 * 1000)));
        $duree_label = isset($_POST['duree_label']) ? clean_text($_POST['duree_label'], 100) : null;
    }

    $statut = $isWaitingList ? 'liste_attente' : ($_POST['statut'] ?? 'En cours');
    if (!$isWaitingList && !in_array($statut, ['En cours', 'Confirmée', 'Terminée'], true)) { 
        $statut = 'En cours'; 
    }

    if (!$isWaitingList && $statut === 'Confirmée') {
        echo json_encode(['success' => false, 'message' => "Dossier non vérifié : créez la réservation « En cours de réservation », vérifiez les photos CNI / permis, puis passez-la à « Réservé »."]);
        exit;
    }
    $en_cours = ($statut === 'Terminée') ? 0 : 1;

    // --- RÉCEPTION DES CHAMPS (Permis & Paiement) ---
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

    // --- CONTRÔLE DES DOCUMENTS : mêmes règles pour la réservation du site ET pour la liste d'attente ---
    if ($isWaitingList || !isset($_POST['statut'])) {
        $missing = [];
        if (empty($id_card_number))    { $missing[] = 'numéro de CNI'; }
        if (!$id_card_path)            { $missing[] = 'photo de la CNI (JPG, PNG ou PDF, 5 Mo max)'; }
        if (empty($driver_license))    {$missing[] = 'numéro de permis'; }
        if (!$driver_license_path)     {$missing[] = 'photo du permis (JPG, PNG ou PDF, 5 Mo max)'; }
        if (empty($payment_method))    {$missing[] = 'mode de paiement'; }
        if ($missing) {
            if ($id_card_path)         { @unlink(__DIR__ . '/../' .$id_card_path); }
            if ($driver_license_path)  { @unlink(__DIR__ . '/../' .$driver_license_path); }
            echo json_encode(['success' => false, 'message' => 'Informations manquantes ou invalides : ' . implode(', ', $missing) . '.']);
            exit;
        }

        $normCni    = preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $id_card_number));$normPermis = preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $driver_license));$sameNumber = ($normCni !== '' &&$normCni === $normPermis);$samePhoto  = ($id_card_path &&$driver_license_path
                       && sha1_file(__DIR__ . '/../' . $id_card_path) === sha1_file(__DIR__ . '/../' .$driver_license_path));
        if ($sameNumber ||$samePhoto) {
            if ($id_card_path)        { @unlink(__DIR__ . '/../' .$id_card_path); }
            if ($driver_license_path) { @unlink(__DIR__ . '/../' .$driver_license_path); }
            echo json_encode(['success' => false, 'message' => $sameNumber
                ? 'Le numéro de permis doit être différent du numéro de CNI.'
                : 'La photo de la CNI et celle du permis doivent être deux documents différents.']);
            exit;
        }
    }

    // --- VENTE EN COURS : on ne réserve pas (ni n'inscrit en file) un véhicule dont l'achat est en cours ---
    // Les ajouts manuels de l'admin (qui postent un statut) ne sont pas bloqués.
    if (($isWaitingList || !isset($_POST['statut'])) && sale_in_progress($pdo, $car_id, $car_name)) {
        if ($id_card_path)        { @unlink(__DIR__ . '/../' . $id_card_path); }
        if ($driver_license_path) { @unlink(__DIR__ . '/../' . $driver_license_path); }
        echo json_encode(['success' => false, 'code' => 'PURCHASE_IN_PROGRESS',
            'message' => "Ce véhicule est en cours d'achat par un autre client : il n'est pas disponible à la réservation pour le moment."],
            JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Libère d'abord les véhicules dont la réservation est arrivée à son terme (archivage automatique)
    archive_expired_reservations($pdo);

    // --- CAS 1 : SI C'EST UNE INSCRIPTION EN LISTE D'ATTENTE ---
    if ($isWaitingList) {
        try {
            // S'assurer que la table attente existe
            $pdo->exec("CREATE TABLE IF NOT EXISTS attente (
                id INT AUTO_INCREMENT PRIMARY KEY,
                car_id VARCHAR(50) NOT NULL,
                car_name VARCHAR(255) NOT NULL,
                client_nom VARCHAR(100) NOT NULL,
                client_telephone VARCHAR(50) NOT NULL,
                duree_label VARCHAR(100) DEFAULT NULL,
                until_ts BIGINT DEFAULT NULL,
                id_card VARCHAR(255) DEFAULT NULL,
                id_card_number VARCHAR(50) DEFAULT NULL,
                driver_license VARCHAR(255) DEFAULT NULL,
                driver_license_file VARCHAR(255) DEFAULT NULL,
                payment_method VARCHAR(50) DEFAULT NULL,
                statut VARCHAR(50) DEFAULT 'liste_attente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_car_id (car_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // La liste d'attente n'a de sens que si le véhicule est réellement pris par un autre dossier
            $held = false;
            if ($pdo->query("SHOW TABLES LIKE 'reservations'")->rowCount() > 0) {
                ensure_reservations_columns($pdo);
                $stmtHeld = $pdo->prepare("SELECT id FROM reservations WHERE car_id = ? AND en_cours = 1 AND " . hold_condition() . " LIMIT 1");
                $stmtHeld->execute([$car_id, (int) round(microtime(true) * 1000)]);
                $held = (bool) $stmtHeld->fetch();
            }
            // Véhicule libre mais des clients attendent déjà : on peut rejoindre la file
            if (!$held) {
                $stmtQ = $pdo->prepare("SELECT COUNT(*) FROM attente WHERE car_id = ?");
                $stmtQ->execute([$car_id]);
                $held = ((int) $stmtQ->fetchColumn()) > 0;
            }
            if (!$held) {
                remove_uploaded($id_card_path, $driver_license_path);
                echo json_encode(['success' => false, 'message' => 'Ce véhicule est disponible actuellement : vous pouvez le réserver directement.']);
                exit;
            }

            // Pas d'inscription en double (même téléphone, même véhicule)
            $digits = preg_replace('/\D+/', '', (string) $client_telephone);
            $stmtDup = $pdo->prepare("SELECT client_telephone FROM attente WHERE car_id = ?");
            $stmtDup->execute([$car_id]);
            foreach ($stmtDup->fetchAll() as $d) {
                if ($digits !== '' && preg_replace('/\D+/', '', (string) $d['client_telephone']) === $digits) {
                    remove_uploaded($id_card_path, $driver_license_path);
                    echo json_encode(['success' => false, 'message' => 'Vous êtes déjà inscrit(e) en liste d\'attente pour ce véhicule.']);
                    exit;
                }
            }

            $stmtAttente = $pdo->prepare("INSERT INTO attente (car_id, car_name, client_nom, client_telephone, duree_label, until_ts, id_card, id_card_number, driver_license, driver_license_file, payment_method, statut) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtAttente->execute([
                $car_id, $car_name, $client_nom, $client_telephone, $duree_label, $until_ts, 
                $id_card_path, $id_card_number, $driver_license, $driver_license_path, $payment_method, $statut
            ]);

            $stmtRank = $pdo->prepare("SELECT COUNT(*) FROM attente WHERE car_id = ?");
            $stmtRank->execute([$car_id]);
            $rang = (int) $stmtRank->fetchColumn();
            echo json_encode(['success' => true, 'rang' => $rang,
                'message' => 'Inscription en liste d\'attente enregistrée avec succès ! Vous êtes n°' . $rang . ' pour ce véhicule.']);
        } catch (Exception $e) {
            remove_uploaded($id_card_path, $driver_license_path);
            echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'enregistrement en liste d\'attente : ' . $e->getMessage()]);
        }
        exit;
    }

    // --- CAS 2 : RÉSERVATION CLASSIQUE (Table reservations) ---

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
            verified TINYINT(1) NOT NULL DEFAULT 0,
            verified_at DATETIME NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_car_id (car_id)
        )");

        ensure_reservations_columns($pdo);

        $pdo->beginTransaction();

        $nowCheck  = (int) round(microtime(true) * 1000);
        $stmtCheck =$pdo->prepare("SELECT id FROM reservations WHERE car_id = ? AND en_cours = 1 AND " . hold_condition() . " FOR UPDATE");
        $stmtCheck->execute([$car_id,$nowCheck]);
        if ($stmtCheck->fetch()) {$pdo->rollBack();
            if ($id_card_path) { @unlink(__DIR__ . '/../' .$id_card_path); }
            if ($driver_license_path) { @unlink(__DIR__ . '/../' .$driver_license_path); }
            echo json_encode(['success' => false, 'message' => 'Ce véhicule est déjà réservé.']);
            exit;
        }

        // Priorité à la file d'attente : une réservation directe du site (sans statut posté) ne doit pas
        // passer devant les clients qui attendent déjà ce véhicule. L'admin (qui poste un statut) reste libre d'agir.
        if (!isset($_POST['statut']) && $pdo->query("SHOW TABLES LIKE 'attente'")->rowCount() > 0) {
            $stmtQueue = $pdo->prepare("SELECT COUNT(*) FROM attente WHERE car_id = ?");
            $stmtQueue->execute([$car_id]);
            if ((int) $stmtQueue->fetchColumn() > 0) {
                $pdo->rollBack();
                if ($id_card_path) { @unlink(__DIR__ . '/../' . $id_card_path); }
                if ($driver_license_path) { @unlink(__DIR__ . '/../' . $driver_license_path); }
                echo json_encode(['success' => false, 'message' => "Des clients attendent déjà ce véhicule : il leur est proposé en priorité. Inscrivez-vous en liste d'attente."]);
                exit;
            }
        }

        $stmt =$pdo->prepare("INSERT INTO reservations (car_id, client_nom, client_telephone, car_name, until_ts, duree_label, id_card, id_card_number, driver_license, driver_license_file, payment_method, en_cours, statut) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                               
        $stmt->execute([$car_id,$client_nom,$client_telephone,$car_name,$until_ts,$duree_label,$id_card_path,$id_card_number,$driver_license, $driver_license_path,$payment_method, $en_cours,$statut
        ]);

        if ($statut === 'Confirmée' || $statut === 'Terminée') {
            $stmtUpdateCar =$pdo->prepare("UPDATE vehicles SET dispo = ? WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
            $stmtUpdateCar->execute([$statut === 'Confirmée' ? 0 : 1, $car_id,$car_name]);
        }

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Réservation enregistrée avec succès !']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {$pdo->rollBack(); }
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

        archive_expired_reservations($pdo); // les dossiers dont la durée est dépassée passent dans l'historique
        $stmt =$pdo->query("SELECT *, UNIX_TIMESTAMP(created_at) * 1000 AS created_ms FROM reservations ORDER BY id DESC");
        $reservations =$stmt->fetchAll();

        foreach ($reservations as &$r) {$r['en_cours'] = isset($r['en_cours']) ? (bool)$r['en_cours'] : true;
            $r['hold_until']   = (int) ($r['created_ms'] ?? 0) + RESERVATION_HOLD_MS;
            $r['hold_expired'] =$r['en_cours'] && (($r['statut'] ?: 'En cours') === 'En cours') &&$r['hold_until'] < (int) round(microtime(true) * 1000);
        }

        echo json_encode(['success' => true, 'reservations' => $reservations]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- HISTORIQUE DES RÉSERVATIONS (admin) : lit la table « historique » ---
if ($action === 'history') {
    if (session_status() === PHP_SESSION_NONE) { session_start(); }
    if (!isset($_SESSION['autonems_admin']) || $_SESSION['autonems_admin'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Accès non autorisé.']);
        exit;
    }
    try {
        if ($pdo->query("SHOW TABLES LIKE 'historique'")->rowCount() == 0) {
            echo json_encode(['success' => true, 'historique' => []]);
            exit;
        }
        $stmt = $pdo->query("SELECT * FROM historique ORDER BY id DESC");
        echo json_encode(['success' => true, 'historique' => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- FILE D'ATTENTE PUBLIQUE : nombre de clients en attente par véhicule (aucune donnée personnelle) ---
if ($action === 'public_queue') {
    try {
        $out = [];
        if ($pdo->query("SHOW TABLES LIKE 'attente'")->rowCount() > 0) {
            foreach ($pdo->query("SELECT car_id, COUNT(*) AS n FROM attente GROUP BY car_id")->fetchAll() as $r) {
                $out[$r['car_id']] = (int) $r['n'];
            }
        }
        echo json_encode((object) $out, JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// --- LISTE PUBLIQUE (site client) ---
if ($action === 'public_list') {
    try {
        $out = [];
        if ($pdo->query("SHOW TABLES LIKE 'reservations'")->rowCount() > 0) {
            archive_expired_reservations($pdo);
            $now  = (int) round(microtime(true) * 1000);
            $stmt =$pdo->prepare("SELECT car_id, car_name, until_ts, statut, UNIX_TIMESTAMP(created_at) * 1000 AS created_ms FROM reservations
                                   WHERE en_cours = 1 AND " . hold_condition() . " ORDER BY id ASC");
            $stmt->execute([$now]);
            foreach ($stmt->fetchAll() as$r) {
                $out[$r['car_id']] = [
                    'car'     => $r['car_name'],
                    'carName' => $r['car_name'],
                    'until'   => (($r['statut'] ?: 'En cours') === 'Confirmée') ? (int) $r['until_ts'] : ((int)$r['created_ms'] + RESERVATION_HOLD_MS),
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

// --- MODIFIER LE STATUT D'UNE RÉSERVATION (admin) ---
if ($action === 'update_status') {
    $id     =$_POST['id'] ?? null;
    $statut =$_POST['statut'] ?? '';
    if (empty($id) || !in_array($statut, ['En cours', 'Confirmée', 'Terminée'], true)) {
        echo json_encode(['success' => false, 'message' => 'Réservation ou statut invalide.']);
        exit;
    }

    try {
        if ($statut === 'Confirmée') {
            $chk =$pdo->prepare("SELECT * FROM reservations WHERE id = ?");
            $chk->execute([$id]);
            $row =$chk->fetch();
            if ($row && (int) ($row['verified'] ?? 0) !== 1 && ($row['statut'] ?? '') !== 'Confirmée') {
                echo json_encode(['success' => false, 'message' => "Dossier non vérifié : vérifiez les photos CNI / permis puis cliquez sur « Marquer comme vérifié » avant de passer la réservation à « Réservé »."]);
                exit;
            }
        }

        $pdo->beginTransaction();

        $stmtGet =$pdo->prepare("SELECT car_id, car_name, statut, until_ts, UNIX_TIMESTAMP(created_at) * 1000 AS created_ms FROM reservations WHERE id = ? FOR UPDATE");
        $stmtGet->execute([$id]);
        $resData =$stmtGet->fetch();
        if (!$resData) {$pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Réservation introuvable.']);
            exit;
        }

        $en_cours = ($statut === 'Terminée') ? 0 : 1;

        if ($statut === 'Confirmée' && ($resData['statut'] ?? '') !== 'Confirmée') {
            $nowMs = (int) round(microtime(true) * 1000);
            $stmtConf =$pdo->prepare("SELECT id, client_nom, statut FROM reservations WHERE car_id = ? AND id <> ? AND en_cours = 1 AND " . hold_condition() . " LIMIT 1 FOR UPDATE");
            $stmtConf->execute([$resData['car_id'], $id,$nowMs]);
            $other =$stmtConf->fetch();
            if ($other) {$pdo->rollBack();
                $otherLabel = (($other['statut'] ?: 'En cours') === 'Confirmée') ? 'Réservé' : 'En cours de réservation';
                echo json_encode(['success' => false, 'message' => "Impossible : ce véhicule est déjà pris par un autre dossier (n°" . $other['id'] . " — " . ($other['client_nom'] ?: 'client') . ", " . $otherLabel . "). Passez d'abord ce dossier à « Terminée »."], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        // --- INTÉGRATION DE L'ARCHIVAGE AUTOMATIQUE ET DU DÉBLOQUAGE DU VÉHICULE ---
        if ($statut === 'Terminée') {
            // 1. Copie de la ligne vers la table historique
            $stmtArchive =$pdo->prepare("INSERT INTO historique SELECT * FROM reservations WHERE id = ?");
            $stmtArchive->execute([$id]);

            // 2. Suppression de la table active pour libérer définitivement le car_id (évite l'erreur 1062)
            $stmtDel =$pdo->prepare("DELETE FROM reservations WHERE id = ?");
            $stmtDel->execute([$id]);

            // 3. Forcer la remise à disposition immédiate du véhicule (dispo = 1)
            $stmtCar =$pdo->prepare("UPDATE vehicles SET dispo = 1 WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
            $stmtCar->execute([$resData['car_id'],$resData['car_name']]);
        } else {
            // Logique standard pour "En cours" ou "Confirmée"
            $newUntilTs = null;
            if ($statut === 'Confirmée' && ($resData['statut'] ?? '') !== 'Confirmée') {
                $dureeMs = (int) $resData['until_ts'] - (int)$resData['created_ms'];
                $dureeMs = (int) (round($dureeMs / 60000) * 60000);
                $dureeMs = max(60000, min($dureeMs, 720 * 3600 * 1000));
                $newUntilTs = (int) round(microtime(true) * 1000) +$dureeMs;
            }

            if ($newUntilTs !== null) {
                $stmt =$pdo->prepare("UPDATE reservations SET statut = ?, en_cours = ?, until_ts = ? WHERE id = ?");
                $stmt->execute([$statut,$en_cours, $newUntilTs,$id]);
            } else {
                $stmt =$pdo->prepare("UPDATE reservations SET statut = ?, en_cours = ? WHERE id = ?");
                $stmt->execute([$statut, $en_cours,$id]);
            }

            // Mettre à jour la disponibilité du véhicule (0 si Confirmée, 1 sinon)
            $stmtCar =$pdo->prepare("UPDATE vehicles SET dispo = ? WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?");
            $stmtCar->execute([$statut === 'Confirmée' ? 0 : 1, $resData['car_id'],$resData['car_name']]);
        }

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Statut mis à jour avec succès.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {$pdo->rollBack(); }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
    }
    exit;
}

// --- MARQUER UN DOSSIER COMME VÉRIFIÉ / À VÉRIFIER ---
if ($action === 'set_verified') {
    $id       =$_POST['id'] ?? null;
    $verified = (isset($_POST['verified']) &&$_POST['verified'] == '1') ? 1 : 0;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID de réservation manquant.']);
        exit;
    }

    try {
        ensure_reservations_columns($pdo);
        $stmt =$pdo->prepare("UPDATE reservations SET verified = ?, verified_at = " . ($verified ? "NOW()" : "NULL") . " WHERE id = ?");
        $stmt->execute([$verified,$id]);
        echo json_encode(['success' => true, 'message' => $verified ? 'Dossier marqué comme vérifié.' : 'Vérification annulée.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
    }
    exit;
}

// --- 3. SUPPRIMER UNE RÉSERVATION ---
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
        if ($pdo->inTransaction()) {$pdo->rollBack(); }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);