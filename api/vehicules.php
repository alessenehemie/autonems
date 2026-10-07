<?php
// api/vehicules.php
header('Content-Type: application/json; charset=utf-8');

session_start();

// Connexion à la base de données
$host = 'localhost';
$dbname = 'autonems'; // Remplace par le nom exact de ta base de données
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

// --- 1. LISTER LES VÉHICULES ---
if ($action === 'list') {
    try {
        // Libère les véhicules dont la réservation est expirée (sinon dispo reste à 0 pour toujours)
        try {
            $nowMs = (int) round(microtime(true) * 1000);
            $expired = $pdo->prepare("SELECT car_id, car_name FROM reservations WHERE en_cours = 1 AND until_ts <= ?");
            $expired->execute([$nowMs]);
            foreach ($expired->fetchAll() as $r) {
                $pdo->prepare("UPDATE vehicles SET dispo = 1 WHERE LOWER(REPLACE(nom, ' ', '-')) = ? OR nom = ?")
                    ->execute([$r['car_id'], $r['car_name']]);
            }
            $pdo->prepare("UPDATE reservations SET en_cours = 0, statut = 'Terminée' WHERE en_cours = 1 AND until_ts <= ?")
                ->execute([$nowMs]);
        } catch (Exception $e) { /* table reservations absente : on ignore */ }

        $stmt = $pdo->query("SELECT * FROM vehicles ORDER BY id DESC");
        $vehicules = $stmt->fetchAll();

        foreach ($vehicules as &$v) {
            $v['dispo'] = (bool)$v['dispo'];
            $v['equipements'] = !empty($v['equipements']) ? json_decode($v['equipements'], true) : [];
        }

        echo json_encode(['success' => true, 'vehicules' => $vehicules]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- 2. CRÉER OU METTRE À JOUR UN VÉHICULE (Admin) ---
if ($action === 'create' || $action === 'update') {
    $id = $_POST['id'] ?? null;
    $nom = trim($_POST['nom'] ?? '');
    $marque = trim($_POST['marque'] ?? '');
    $an = intval($_POST['an'] ?? 0);
    $km = trim($_POST['km'] ?? '');
    $couleur = trim($_POST['couleur'] ?? '');
    $boite = trim($_POST['boite'] ?? 'Automatique');
    $carburant = trim($_POST['carburant'] ?? 'Essence');
    $places = intval($_POST['places'] ?? 5);
    $dispo = isset($_POST['dispo']) ? 1 : 0;
    $loc = floatval($_POST['loc'] ?? 0);
    $vente = floatval($_POST['vente'] ?? 0);
    $description = trim($_POST['description'] ?? '');
    
    $equipements = isset($_POST['equipements']) && is_array($_POST['equipements']) ? $_POST['equipements'] : [];
    $equipementsJson = json_encode($equipements, JSON_UNESCAPED_UNICODE);

    if (empty($nom)) {
        echo json_encode(['success' => false, 'message' => 'Le nom du véhicule est obligatoire.']);
        exit;
    }

    $imgPath = trim($_POST['img_url'] ?? '');

    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../uploads/vehicules/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        $fileExt = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
        $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

        if (in_array($fileExt, $allowedExts)) {
            $fileName = 'vehicule_' . time() . '_' . mt_rand(1000, 9999) . '.' . $fileExt;
            $destPath = $uploadDir . $fileName;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
                $imgPath = 'uploads/vehicules/' . $fileName;
            }
        }
    }

    try {
        if ($action === 'create') {
            $stmt = $pdo->prepare("INSERT INTO vehicles (nom, marque, img, an, km, boite, carburant, places, couleur, loc, vente, dispo, description, equipements, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$nom, $marque, $imgPath, $an, $km, $boite, $carburant, $places, $couleur, $loc, $vente, $dispo, $description, $equipementsJson]);
            echo json_encode(['success' => true, 'message' => 'Véhicule ajouté avec succès.']);
        } else {
            if (empty($imgPath) && !empty($id)) {
                $stmtOld = $pdo->prepare("SELECT img FROM vehicles WHERE id = ?");
                $stmtOld->execute([$id]);
                $oldVeh = $stmtOld->fetch();
                $imgPath = $oldVeh['img'] ?? '';
            }

            $stmt = $pdo->prepare("UPDATE vehicles SET nom = ?, marque = ?, img = ?, an = ?, km = ?, boite = ?, carburant = ?, places = ?, couleur = ?, loc = ?, vente = ?, dispo = ?, description = ?, equipements = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$nom, $marque, $imgPath, $an, $km, $boite, $carburant, $places, $couleur, $loc, $vente, $dispo, $description, $equipementsJson, $id]);
            echo json_encode(['success' => true, 'message' => 'Véhicule mis à jour avec succès.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur BDD : ' . $e->getMessage()]);
    }
    exit;
}

// --- 3. SUPPRIMER UN VÉHICULE ---
if ($action === 'delete') {
    $id = $_POST['id'] ?? null;
    if (empty($id)) {
        echo json_encode(['success' => false, 'message' => 'ID de véhicule manquant.']);
        exit;
    }

    try {
        $stmtImg = $pdo->prepare("SELECT img FROM vehicles WHERE id = ?");
        $stmtImg->execute([$id]);
        $veh = $stmtImg->fetch();
        if ($veh && !empty($veh['img']) && !preg_match('/^https?:\/\//i', $veh['img'])) {
            $fullPath = '../' . $veh['img'];
            if (file_exists($fullPath)) {
                @unlink($fullPath);
            }
        }

        $stmt = $pdo->prepare("DELETE FROM vehicles WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Véhicule supprimé.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression : ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Action non reconnue.']);