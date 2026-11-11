-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mer. 11 nov. 2026 à 09:13
-- Version du serveur : 9.1.0
-- Version de PHP : 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `autonems`
--

-- --------------------------------------------------------

--
-- Structure de la table `admins`
--

DROP TABLE IF EXISTS `admins`;
CREATE TABLE IF NOT EXISTS `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `admins`
--

INSERT INTO `admins` (`id`, `email`, `password`, `created_at`) VALUES
(1, 'admin@autonems.com', '$2y$10$g0s2y0nzsY.KBiGKn7xBROOnMCdRjVI6utThtqpRqMBJbVozfEV96', '2026-09-28 09:20:43');

-- --------------------------------------------------------

--
-- Structure de la table `attente`
--

DROP TABLE IF EXISTS `attente`;
CREATE TABLE IF NOT EXISTS `attente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `car_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `car_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_nom` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_telephone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duree_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `until_ts` bigint DEFAULT NULL,
  `id_card` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_card_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_license` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_license_file` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'liste_attente',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_car_id` (`car_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `historique`
--

DROP TABLE IF EXISTS `historique`;
CREATE TABLE IF NOT EXISTS `historique` (
  `id` int NOT NULL AUTO_INCREMENT,
  `car_id` varchar(50) NOT NULL,
  `client_nom` varchar(100) DEFAULT NULL,
  `client_telephone` varchar(50) DEFAULT NULL,
  `car_name` varchar(255) NOT NULL,
  `until_ts` bigint NOT NULL,
  `duree_label` varchar(100) DEFAULT NULL,
  `id_card` varchar(255) DEFAULT NULL,
  `en_cours` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `client_id` int DEFAULT NULL,
  `mode_contact` varchar(20) DEFAULT 'whatsapp',
  `statut` varchar(30) DEFAULT 'en_attente',
  `driver_license` varchar(255) DEFAULT NULL,
  `driver_license_file` varchar(255) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `id_card_number` varchar(50) DEFAULT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reservations`
--

DROP TABLE IF EXISTS `reservations`;
CREATE TABLE IF NOT EXISTS `reservations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `car_id` varchar(50) NOT NULL,
  `client_nom` varchar(100) DEFAULT NULL,
  `client_telephone` varchar(50) DEFAULT NULL,
  `car_name` varchar(255) NOT NULL,
  `until_ts` bigint NOT NULL,
  `duree_label` varchar(100) DEFAULT NULL,
  `id_card` varchar(255) DEFAULT NULL,
  `en_cours` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `client_id` int DEFAULT NULL,
  `mode_contact` varchar(20) DEFAULT 'whatsapp',
  `statut` varchar(30) DEFAULT 'en_attente',
  `driver_license` varchar(255) DEFAULT NULL,
  `driver_license_file` varchar(255) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `id_card_number` varchar(50) DEFAULT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_car_id` (`car_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `sales`
--

DROP TABLE IF EXISTS `sales`;
CREATE TABLE IF NOT EXISTS `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `car_name` varchar(255) NOT NULL,
  `car_details` text,
  `buyer_nom` varchar(255) NOT NULL,
  `buyer_telephone` varchar(50) NOT NULL,
  `sale_price` decimal(12,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_method` varchar(50) DEFAULT NULL,
  `id_card_number` varchar(100) DEFAULT NULL,
  `driver_license_number` varchar(100) DEFAULT NULL,
  `id_card_path` varchar(255) DEFAULT NULL,
  `driver_license_path` varchar(255) DEFAULT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` datetime DEFAULT NULL,
  `statut` varchar(20) NOT NULL DEFAULT 'achete',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `marque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `img` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `an` int DEFAULT NULL,
  `km` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `boite` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Automatique',
  `carburant` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Essence',
  `places` int DEFAULT '5',
  `couleur` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loc` decimal(10,2) DEFAULT '0.00',
  `vente` decimal(12,2) DEFAULT '0.00',
  `dispo` tinyint(1) DEFAULT '1',
  `description` text COLLATE utf8mb4_unicode_ci,
  `equipements` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `vehicles`
--

INSERT INTO `vehicles` (`id`, `nom`, `marque`, `img`, `an`, `km`, `boite`, `carburant`, `places`, `couleur`, `loc`, `vente`, `dispo`, `description`, `equipements`, `created_at`, `updated_at`) VALUES
(1, 'Hyundai Tucson', 'Hyundai', 'image/hundai.jpg', 2024, '15 000', 'Automatique', 'Essence', 5, 'Gris métallisé', 45000.00, 16500000.00, 1, 'Un SUV familial moderne et fiable, parfait pour la ville comme pour les routes de l\'intérieur. Confort, faible consommation et look actuel.', '[\"Climatisation automatique\", \"Caméra de recul\", \"Bluetooth & Apple CarPlay\", \"Régulateur de vitesse\", \"Jantes alliage 18\"\"]', '2026-09-28 09:55:23', '2026-10-19 15:19:06'),
(2, 'Mercedes-Benz GLE', 'Mercedes', 'image/gle.jpg', 2022, '38 000', 'Automatique', 'Essence', 5, 'Vert émeraude', 70000.00, 24000000.00, 1, 'Le SUV premium par excellence : présence, puissance et intérieur luxueux. Idéal pour vos déplacements professionnels ou cérémonies.', '[\"Sièges cuir chauffants\", \"Toit panoramique\", \"Système AMG Line\", \"Caméra 360°\", \"Suspension pneumatique\"]', '2026-09-28 09:55:23', '2026-10-02 11:09:44'),
(3, 'Range Rover (Nouvelle Gen)', 'Land Rover', 'image/rangerover.jpg', 2023, '22 000', 'Automatique', 'Diesel', 5, 'Marron truffe', 120000.00, 38500000.00, 1, 'L\'incarnation du luxe britannique. Un SUV d\'exception pour ceux qui veulent voyager dans le plus grand confort, sur route comme en tout-terrain.', '[\"Intérieur cuir Windsor\", \"Suspension adaptative\", \"Écran tactile 13.1\"\", \"4 roues motrices intégrales\", \"Assistant de conduite\"]', '2026-09-28 09:55:23', '2026-10-02 07:05:58'),
(4, 'BMW M4', 'BMW', 'image/bmw.jpg', 2021, '41 000', 'Automatique', 'Essence', 4, 'Blanc Alpin', 85000.00, 21500000.00, 1, 'Une pure sportive allemande. Design agressif, sensations fortes garanties — pour les amateurs de conduite dynamique et de style.', '[\"Kit carrosserie M Performance\", \"Sièges baquets\", \"Échappement sport\", \"Jantes 19\"/20\"\", \"Mode Sport +\"]', '2026-09-28 09:55:23', '2026-10-06 11:51:00'),
(5, 'Kia Sportage GT-Line', 'Kia', 'image/kia.jpg', 2025, '8 000', 'Automatique', 'Essence', 5, 'Gris cyber', 50000.00, 13200000.00, 1, 'Le tout dernier Sportage : design futuriste, faible kilométrage, garantie constructeur encore active. Excellent rapport qualité-prix.', '[\"Écran incurvé double\",\"Chargeur à induction\",\"Caméra de recul HD\",\"Sièges chauffants\\/ventilés\",\"Garantie constructeur\"]', '2026-09-28 09:55:23', '2026-10-26 12:52:03'),
(6, 'Peugeot e-308 SW', 'Peugeot', 'image/peugeot.jpg', 2024, '12 000', 'Automatique', 'Électrique', 5, 'Blanc nacré', 48000.00, 14900000.00, 1, 'Le break électrique idéal pour rouler propre sans sacrifier l\'espace ni le style. Silencieux, économique et très agréable au quotidien.', '[\"100% électrique\",\"i-Cockpit numérique\",\"Recharge rapide\",\"Grand coffre familial\",\"Aides à la conduite\"]', '2026-09-28 09:55:23', '2026-10-09 15:20:51'),
(7, 'Toyota Corolla', 'Toyota', 'https://images.unsplash.com/photo-1638618164682-12b986ec2a75?auto=format&fit=crop&w=1200&q=80', 2022, '29 000', 'Automatique', 'Essence', 5, 'Blanc', 30000.00, 10800000.00, 1, 'La berline la plus fiable du marché ivoirien. Entretien économique, pièces disponibles partout à Abidjan — un choix sûr et sans souci.', '[\"Consommation très basse\", \"Climatisation\", \"Bluetooth\", \"Sellerie tissu robuste\", \"Faible coût d\'entretien\"]', '2026-09-28 09:55:23', '2026-09-28 09:55:23'),
(8, 'Toyota Hilux Double Cabine', 'Toyota', 'https://images.unsplash.com/photo-1621786805936-65e5e163c1e9?auto=format&fit=crop&w=1200&q=80', 2021, '52 000', 'Manuelle', 'Diesel', 5, 'Blanc', 55000.00, 17800000.00, 1, 'Le pick-up increvable, taillé pour les chantiers comme pour les pistes. Robuste, spacieux, capable de tout transporter.', '[\"4x4 enclenchable\", \"Benne utilitaire\", \"Châssis renforcé\", \"Climatisation\", \"Idéal chantier/brousse\"]', '2026-09-28 09:55:23', '2026-10-26 09:07:58'),
(9, 'Toyota Land Cruiser Prado', 'Toyota', 'https://images.unsplash.com/photo-1650530579355-7ad9d4766043?auto=format&fit=crop&w=1200&q=80', 2022, '31 000', 'Automatique', 'Diesel', 7, 'Noir', 95000.00, 29500000.00, 1, 'Le 4x4 le plus recherché à Abidjan : fiable, puissant, spacieux jusqu\'à 7 places. Parfait pour les familles et les longs trajets.', '[\"7 places\", \"4 roues motrices\", \"Climatisation 3 zones\", \"Grand coffre\", \"Excellente tenue de route\"]', '2026-09-28 09:55:23', '2026-10-26 09:08:01');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
