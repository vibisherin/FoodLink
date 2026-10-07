CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  role ENUM('admin','restaurant','ngo') NOT NULL,
  google_id VARCHAR(64) NULL UNIQUE,
  avatar_url VARCHAR(500) NULL,
  language ENUM('en','hi','ta') NOT NULL DEFAULT 'en',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  phone VARCHAR(25) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rest_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ngos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  phone VARCHAR(25) NULL,
  daily_capacity_meals INT NOT NULL DEFAULT 100,
  max_radius_km DECIMAL(5,1) NOT NULL DEFAULT 10.0,
  accepted_categories VARCHAR(100) NOT NULL DEFAULT 'cooked,bakery,produce,dairy,packaged',
  has_vehicle TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ngo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS food_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ngo_id INT NOT NULL,
  category ENUM('cooked','bakery','produce','dairy','packaged') NOT NULL,
  quantity DECIMAL(8,2) NOT NULL,
  unit ENUM('kg','litres','packs','plates') NOT NULL,
  servings_requested INT NOT NULL DEFAULT 1,
  priority ENUM('Urgent','High','Normal') NOT NULL DEFAULT 'Normal',
  reason VARCHAR(255) NULL,
  status ENUM('Pending','Partially Fulfilled','Matched','Fulfilled','Cancelled') NOT NULL DEFAULT 'Pending',
  fulfilled_quantity DECIMAL(8,2) NOT NULL DEFAULT 0,
  fulfilled_servings INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_request_ngo_status (ngo_id, status),
  INDEX idx_request_priority (priority, created_at),
  CONSTRAINT fk_request_ngo FOREIGN KEY (ngo_id) REFERENCES ngos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS food_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  category ENUM('cooked','bakery','produce','dairy','packaged') NOT NULL DEFAULT 'cooked',
  quantity DECIMAL(8,2) NOT NULL,
  remaining_quantity DECIMAL(8,2) NULL,
  unit ENUM('kg','litres','packs','plates') NOT NULL DEFAULT 'kg',
  servings INT NOT NULL DEFAULT 1,
  expiry_time DATETIME NOT NULL,
  status ENUM('Available','Expiring Soon','Reserved','Donated','Expired') NOT NULL DEFAULT 'Available',
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_food_status_expiry (status, expiry_time),
  CONSTRAINT fk_food_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  food_id INT NOT NULL,
  ngo_id INT NOT NULL,
  initiated_by ENUM('restaurant','ngo') NOT NULL,
  status ENUM('Pending','Accepted','Picked Up','Completed','Declined','Cancelled') NOT NULL DEFAULT 'Pending',
  match_score DECIMAL(5,2) NULL,
  servings_delivered INT NULL,
  request_id INT NULL,
  quantity_delivered DECIMAL(8,2) NULL,
  unit_delivered ENUM('kg','litres','packs','plates') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_don_ngo_status (ngo_id, status),
  CONSTRAINT fk_don_food FOREIGN KEY (food_id) REFERENCES food_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_don_ngo FOREIGN KEY (ngo_id) REFERENCES ngos(id) ON DELETE CASCADE,
  CONSTRAINT fk_don_request FOREIGN KEY (request_id) REFERENCES food_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recently_accessed (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  entity_type ENUM('food','ngo','donation') NOT NULL,
  entity_id INT NOT NULL,
  title VARCHAR(190) NOT NULL,
  accessed_at DATETIME NOT NULL,
  UNIQUE KEY uq_recent (user_id, entity_type, entity_id),
  INDEX idx_recent_user_time (user_id, accessed_at),
  CONSTRAINT fk_recent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(60) NOT NULL,
  details VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_time (created_at)
);
