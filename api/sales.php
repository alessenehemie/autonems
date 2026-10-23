<?php
// api/sales.php — Gère l'enregistrement et la liste des voitures vendues
header('Content-Type: application/json; charset=utf-8');
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

// Ajoute les colonnes "verified" / "verified_at" / "statut" si la table "sales" existe déjà sans elles.
// Statut : 'en_cours' = achat en cours (véhicule bloqué sur le site) ; 'achete' = vente conclue.
// Les anciennes lignes (ventes déjà enregistrées avant cette mise à jour) reçoivent 'achete' par défaut.
function ensure_sales_columns(PDO $pdo) {
    if ($pdo->query("SHOW TABLES LIKE 'sales'")->rowCount() == 0) return;
    $needed = [
        'verified'    => "TINYINT(1) NOT NULL DEFAULT 0",
        'verified_at' => "DATETIME NULL DEFAULT NULL",
        'statut'      => "VARCHAR(20) NOT NULL DEFAULT 'achete'",
    ];
    foreach ($needed as $col => $definition) {
        $exists = $pdo->query("SHOW COLUMNS FROM sales LIKE '" . $col . "'")->rowCount();
        if (!$exists) {
            try { $pdo->exec("ALTER TABLE sales ADD COLUMN `$col` $definition"); } catch (Exception $e) { /* ignoré */ }
        }
    }
}

// Même règle que slugify() de script.js / purchase-status.js : sert de clé pour relier une vente à la carte du véhicule
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

// Ce véhicule est-il déjà "en cours d'achat" par un autre client ?
function purchase_in_progress(PDO $pdo, $car_name) {
    try {
        ensure_sales_columns($pdo);
        $slug = slugify_name($car_name);
        foreach ($pdo->query("SELECT car_name FROM sales WHERE statut = 'en_cours'") as $row) {
            if (slugify_name($row['car_name']) === $slug) return true;
        }
    } catch (Exception $e) { /* table absente : rien en cours */ }
    return false;
}

define('RESERVATION_HOLD_MS', 2 * 3600 * 1000); // même délai de blocage que booking.php (dossier « En cours »)

// Derniers chiffres d'un numéro de téléphone (compare « +225 07 00 00 00 » et « 0700000000 »)
function phone_tail($tel) {
    $d = preg_replace('/\D+/', '', (string) $tel);
    return substr($d, -8);
}

// Pourquoi ce véhicule ne peut pas être acheté pour le moment :
//  'reserved' = réservation active d'un AUTRE client (Réservé, ou En cours depuis moins de 2 h)
//  'queue'    = des clients l'attendent déjà dans la file d'attente
// Le client qui a lui-même réservé le véhicule peut l'acheter (étape « Voulez-vous acheter ce véhicule ? » du site).
function vehicle_unavailable_reason(PDO $pdo, $car_name, $buyer_tel) {
    $slug = slugify_name($car_name);
    if ($slug === '') return null;
    $nowMs = (int) round(microtime(true) * 1000);
    $buyerTail = phone_tail($buyer_tel);

    try {
        $st = $pdo->prepare("SELECT car_id, car_name, client_telephone FROM reservations WHERE en_cours = 1 AND (statut = 'Confirmée' OR (COALESCE(NULLIF(statut, ''), 'En cours') = 'En cours' AND UNIX_TIMESTAMP(created_at) * 1000 + " . RESERVATION_HOLD_MS . " > ?))");
        $st->execute([$nowMs]);
        foreach ($st->fetchAll() as $r) {
            if (slugify_name($r['car_id']) === $slug || slugify_name($r['car_name']) === $slug) {
                if ($buyerTail !== '' && phone_tail($r['client_telephone']) === $buyerTail) continue;
                return 'reserved';
            }
        }
    } catch (Exception $e) { /* table reservations absente : rien ne bloque */ }

    try {
        foreach ($pdo->query("SELECT car_id, car_name FROM attente")->fetchAll() as $r) {
            if (slugify_name($r['car_id']) === $slug || slugify_name($r['car_name']) === $slug) return 'queue';
        }
    } catch (Exception $e) { /* table attente absente : pas de file */ }

    return null;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- PROTECTION ADMIN (même session que booking.php / attente.php) ---
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
// Publiques : "create" depuis le formulaire d'achat du site (envoie car_details) et "public_list".
// Tout le reste (liste avec CNI/permis, vérification, statut, suppression, enregistrement manuel) est réservé à l'admin.
if (in_array($action, ['list', 'set_verified', 'set_statut', 'delete'], true)
    || ($action === 'create' && !isset($_POST['car_details']))) {
    require_admin_session();
}


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

    // Un seul client à la fois : si le véhicule est déjà "en cours d'achat", on refuse (avant tout enregistrement de photos)
    if (isset($_POST['car_details']) && purchase_in_progress($pdo, $car_name)) {
        echo json_encode(['success' => false, 'code' => 'ALREADY_PURCHASING',
            'message' => "Ce véhicule est déjà en cours d'achat par un autre client."]);
        exit;
    }

    // Véhicule réservé par un autre client, ou attendu par la file d'attente : il n'est pas achetable pour le moment.
    // (L'enregistrement manuel depuis le tableau de bord n'est pas concerné.)
    if (isset($_POST['car_details'])) {
        $reason = vehicle_unavailable_reason($pdo, $car_name, $buyer_telephone);
        if ($reason) {
            echo json_encode(['success' => false, 'code' => 'VEHICLE_UNAVAILABLE',
                'message' => $reason === 'queue'
                    ? "Des clients attendent déjà ce véhicule : il leur est proposé en priorité, vous ne pouvez pas l'acheter pour le moment."
                    : "Ce véhicule est actuellement réservé par un autre client : il n'est pas disponible à l'achat pour le moment."],
                JSON_UNESCAPED_UNICODE);
            exit;
        }
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
            statut VARCHAR(20) NOT NULL DEFAULT 'achete',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        ensure_sales_columns($pdo); // table créée avant cette mise à jour : ajoute "statut" si besoin

        // Formulaire d'achat du site -> "en cours d'achat" (véhicule bloqué). Enregistrement manuel depuis le tableau de bord -> déjà vendu.
        $statut = isset($_POST['car_details']) ? 'en_cours' : 'achete';

        $stmt = $pdo->prepare("INSERT INTO sales (car_name, car_details, buyer_nom, buyer_telephone, sale_price, payment_method, id_card_number, driver_license_number, id_card_path, driver_license_path, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
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
            $driverLicensePath,
            $statut
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

        ensure_sales_columns($pdo);
        $stmt = $pdo->query("SELECT * FROM sales ORDER BY id DESC");
        $sales = $stmt->fetchAll();

        echo json_encode(['success' => true, 'sales' => $sales]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- LISTE PUBLIQUE DES VÉHICULES "EN COURS D'ACHAT" (lue par purchase-status.js : aucune donnée personnelle) ---
if ($action === 'public_list') {
    header('Cache-Control: no-store');
    $purchases = [];
    try {
        ensure_sales_columns($pdo);
        if ($pdo->query("SHOW TABLES LIKE 'sales'")->rowCount() > 0) {
            foreach ($pdo->query("SELECT car_name FROM sales WHERE statut = 'en_cours'") as $row) {
                $slug = slugify_name($row['car_name']);
                if ($slug !== '') { $purchases[$slug] = ['statut' => 'en_cours']; }
            }
        }
        echo json_encode(['success' => true, 'purchases' => (object) $purchases]);
    } catch (Exception $e) {
        echo json_encode(['success' => false]);
    }
    exit;
}

// --- CHANGER LE STATUT D'UNE VENTE : 'en_cours' (en cours d'achat) / 'achete' (acheté) ---
// "Acheté" n'est possible que si l'admin a d'abord marqué le dossier comme vérifié.
if ($action === 'set_statut') {
    $id     = $_POST['id'] ?? null;
    $statut = $_POST['statut'] ?? '';
    if (empty($id) || !in_array($statut, ['en_cours', 'achete'], true)) {
        echo json_encode(['success' => false, 'message' => 'Paramètres invalides.']);
        exit;
    }

    try {
        ensure_sales_columns($pdo);
        $stmt = $pdo->prepare("SELECT id, car_name, verified FROM sales WHERE id = ?");
        $stmt->execute([$id]);
        $sale = $stmt->fetch();
        if (!$sale) {
            echo json_encode(['success' => false, 'message' => 'Vente introuvable.']);
            exit;
        }
        if ($statut === 'achete' && (int) $sale['verified'] !== 1) {
            echo json_encode(['success' => false, 'message' => "Dossier non vérifié : vérifiez la CNI et le permis avant de passer à « Acheté »."]);
            exit;
        }
        $upd = $pdo->prepare("UPDATE sales SET statut = ? WHERE id = ?");
        $upd->execute([$statut, $id]);
        echo json_encode(['success' => true, 'message' => 'Statut mis à jour.', 'car_name' => $sale['car_name']]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
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