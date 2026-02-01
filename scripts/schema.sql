CREATE DATABASE IF NOT EXISTS farmlokal;
USE farmlokal;

CREATE TABLE products (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255)   NOT NULL,
  description TEXT,
  category    VARCHAR(100)   NOT NULL,
  price       DECIMAL(10, 2) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Pagination & default sorting
CREATE INDEX idx_products_created_at ON products (created_at, id);

-- Price sorting
CREATE INDEX idx_products_price ON products (price, id);

-- Name sorting
CREATE INDEX idx_products_name ON products (name, id);

-- Category filtering
CREATE INDEX idx_products_category ON products (category);

-- Full-text search
CREATE FULLTEXT INDEX idx_products_search ON products (name, description);
