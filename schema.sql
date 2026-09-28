
CREATE DATABASE IF NOT EXISTS autonems
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE autonems;

CREATE TABLE IF NOT EXISTS reservations (
    car_id      VARCHAR(50)  NOT NULL PRIMARY KEY,
    car_name    VARCHAR(255) NOT NULL,
    until_ts    BIGINT       NOT NULL COMMENT 'Horodatage de fin de réservation, en millisecondes',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
