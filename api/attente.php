<?php
// api/attente.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* Mêmes règles que booking.php : un dossier « Réservé » (Confirmée), ou « En cours » depuis moins de 2 h, bloque le véhicule. */
define('RESERVATION_HOLD_MS', 2 * 3600 * 1000);
function hold_condition() {
    return "(statut = 'Confirmée' OR (COALESCE(NULLIF(statut, ''), 'En cours') = 'En cours' AND UNIX_TIMESTAMP(created_at) * 1000 + " . RESERVATION_HOLD_MS . " > ?))";
}

require_once __DIR__ . '/reservation_archive.php'; // fin automatique des réservations expirées

// Supprime un fichier de pièce d'identité enregistré dans uploads/ids/
function remove_uploaded(...$paths) {
    foreach ($paths as $p) {
        if ($p && strpos($p, 'uploads/ids/') === 0 && strpos($p, '..') === false) { @unlink(__DIR__ . '/../' . $p); }
    }
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

// Sécurité Admin
function require_admin_session() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['autonems_admin']) || $_SESSION['autonems_admin'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Accès non autorisé.']);
        exit;
    }
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Toutes les actions de gestion de l'attente nécessitent d'être admin
if (in_array($action, ['list', 'delete', 'promote'], true)) {
    require_admin_session();
}

// 1. LISTER LA FILE D'ATTENTE (Depuis la table 'attente')
if ($action === 'list') {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'attente'");
        if ($checkTable->rowCount() == 0) {
            echo json_encode(['success' => true, 'attente' => []]);
            exit;
        }

        // Premier arrivé, premier servi : le plus ancien en premier, avec son rang pour chaque véhicule
        $stmt = $pdo->query("SELECT * FROM attente ORDER BY id ASC");
        $attente = $stmt->fetchAll();
        $compteurs = [];
        foreach ($attente as &$a) {
            $k = $a['car_id'];
            $compteurs[$k] = ($compteurs[$k] ?? 0) + 1;
            $a['rang'] = $compteurs[$k];
        }
        unset($a);

        echo json_encode(['success' => true, 'attente' => $attente]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// 2. PROMOUVOIR UN CLIENT DE L'ATTENTE VERS UNE RÉSERVATION ACTIVE
// Règles : on respecte l'ordre d'arrivée, et le véhicule doit être réellement libre (aucun dossier ne le bloque).
if ($action === 'promote') {
    $id = $_POST['id'] ?? null;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID manquant.']);
        exit;
    }

    // Libère d'abord les véhicules dont la réservation est arrivée à son terme (archivage automatique, hors transaction)
    archive_expired_reservations($pdo);

    try {
        $pdo->beginTransaction();

        $stmtGet = $pdo->prepare("SELECT *, UNIX_TIMESTAMP(created_at) * 1000 AS created_ms FROM attente WHERE id = ? FOR UPDATE");
        $stmtGet->execute([$id]);
        $row = $stmtGet->fetch();

        if (!$row) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Dossier introuvable en file d\'attente.']);
            exit;
        }

        $car_id = $row['car_id'];
        $nowMs  = (int) round(microtime(true) * 1000);

        // 1) Ordre d'arrivée : un client inscrit avant celui-ci passe en premier
        $stmtFirst = $pdo->prepare("SELECT id, client_nom FROM attente WHERE car_id = ? AND id < ? ORDER BY id ASC LIMIT 1");
        $stmtFirst->execute([$car_id, $row['id']]);
        $first = $stmtFirst->fetch();
        if ($first) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Un client est arrivé avant : ' . ($first['client_nom'] ?: 'client') . ' (n°1 pour ce véhicule). Promouvez-le d\'abord, ou retirez-le de la file s\'il ne répond plus.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 2) Le véhicule doit être libre : on ne met plus fin au dossier d'un autre client
        $stmtHeld = $pdo->prepare("SELECT id, client_nom, statut FROM reservations WHERE car_id = ? AND en_cours = 1 AND " . hold_condition() . " LIMIT 1 FOR UPDATE");
        $stmtHeld->execute([$car_id, $nowMs]);
        $held = $stmtHeld->fetch();
        if ($held) {
            $pdo->rollBack();
            $label = (($held['statut'] ?: 'En cours') === 'Confirmée') ? 'Réservé' : 'En cours de réservation';
            echo json_encode(['success' => false, 'message' => 'Impossible : ce véhicule est encore pris par ' . ($held['client_nom'] ?: 'un client') . ' (' . $label . '). Passez d\'abord son dossier à « Terminée » dans les réservations.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 2 bis) Une vente en cours bloque aussi : on n'active pas une réservation sur un véhicule en cours d'achat
        if (sale_in_progress($pdo, $car_id, $row['car_name'])) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Impossible : ce véhicule est en cours d\'achat par un autre client. Terminez ou supprimez cette vente d\'abord (onglet Ventes).'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 3) Anciens dossiers de ce véhicule qui ne bloquent plus (délai dépassé...) : archivés comme le fait « Terminée »,
        //    ce qui libère le car_id (évite l'erreur de clé unique 1062)
        $stmtOld = $pdo->prepare("SELECT id FROM reservations WHERE car_id = ? FOR UPDATE");
        $stmtOld->execute([$car_id]);
        foreach ($stmtOld->fetchAll() as $old) {
            $pdo->prepare("INSERT INTO historique SELECT * FROM reservations WHERE id = ?")->execute([$old['id']]);
            $pdo->prepare("DELETE FROM reservations WHERE id = ?")->execute([$old['id']]);
        }

        // 4) Durée réellement demandée par le client (et non plus 2 h) : until_ts - date d'inscription
        $requestedMs = (int) $row['until_ts'] - (int) $row['created_ms'];
        if ($row['until_ts'] === null || $requestedMs <= 0) { $requestedMs = 24 * 3600 * 1000; }
        $requestedMs = (int) (round($requestedMs / 60000) * 60000);
        $requestedMs = max(60000, min($requestedMs, 720 * 3600 * 1000));
        $newUntil = $nowMs + $requestedMs;

        $stmtInsertRes = $pdo->prepare("
            INSERT INTO reservations (car_id, car_name, client_nom, client_telephone, duree_label, until_ts, id_card, id_card_number, driver_license, driver_license_file, payment_method, statut, en_cours) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En cours', 1)
        ");
        $stmtInsertRes->execute([
            $row['car_id'],
            $row['car_name'],
            $row['client_nom'],
            $row['client_telephone'],
            $row['duree_label'],
            $newUntil,
            $row['id_card'],
            $row['id_card_number'],
            $row['driver_license'],
            $row['driver_license_file'],
            $row['payment_method']
        ]);

        $newReservationId = (int) $pdo->lastInsertId();

        $stmtDelete = $pdo->prepare("DELETE FROM attente WHERE id = ?");
        $stmtDelete->execute([$id]);

        $pdo->commit();
        echo json_encode(['success' => true, 'reservation_id' => $newReservationId, 'message' => 'Client promu en réservation active (à vérifier puis à passer en « Réservé »).']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la promotion : ' . $e->getMessage()]);
    }
    exit;
}

// 3. SUPPRIMER UN CLIENT DE LA FILE D'ATTENTE
if ($action === 'delete') {
    $id = $_POST['id'] ?? null;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID manquant.']);
        exit;
    }

    try {
        $stmtFiles = $pdo->prepare("SELECT id_card, driver_license_file FROM attente WHERE id = ?");
        $stmtFiles->execute([$id]);
        $files = $stmtFiles->fetch();

        $stmt = $pdo->prepare("DELETE FROM attente WHERE id = ?");
        $stmt->execute([$id]);
        if ($files) { remove_uploaded($files['id_card'], $files['driver_license_file']); }
        echo json_encode(['success' => true, 'message' => 'Élément supprimé de la file d\'attente.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);