CREATE DATABASE IF NOT EXISTS job_aggregator
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE job_aggregator;
SET NAMES utf8mb4;

CREATE TABLE roles (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

CREATE TABLE companies (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NULL,
    website_url VARCHAR(500) NULL,
    description TEXT NULL,
    logo_url VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_companies_name (name),
    UNIQUE KEY uq_companies_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    orga_id INT UNSIGNED NULL,
    company_role ENUM('owner', 'member') NULL,
    role_id INT UNSIGNED NOT NULL,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL,
    password_hash VARCHAR(255) NULL,
    date_of_birth DATE NULL,
    status ENUM('en_recherche', 'recruteur') NOT NULL DEFAULT 'en_recherche',
    banned_at DATETIME NULL,
    ban_reason TEXT NULL,
    profile_photo_url VARCHAR(1000) NULL,
    short_bio VARCHAR(500) NULL,
    linkedin_url VARCHAR(1000) NULL,
    github_url VARCHAR(1000) NULL,
    portfolio_url VARCHAR(1000) NULL,
    work_location VARCHAR(255) NULL,
    cv_url VARCHAR(1000) NULL,
    cv_filename VARCHAR(255) NULL,
    dark_mode TINYINT(1) NOT NULL DEFAULT 0,
    last_login_at DATETIME NULL,
    email_verified_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_id (role_id),
    KEY idx_users_orga_id (orga_id),
    KEY idx_users_company_role (company_role),
    KEY idx_users_status (status),
    KEY idx_users_banned_at (banned_at),

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_users_orga
        FOREIGN KEY (orga_id) REFERENCES companies(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE company_invitations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT UNSIGNED NOT NULL,
    email VARCHAR(255) NOT NULL,
    invited_by_user_id INT UNSIGNED NOT NULL,
    status ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
    responded_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_company_invitations_company_id (company_id),
    KEY idx_company_invitations_email_status (email, status),
    KEY idx_company_invitations_invited_by_user_id (invited_by_user_id),

    CONSTRAINT fk_company_invitations_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_company_invitations_invited_by_user
        FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE auth_providers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    provider_name ENUM('local', 'google', 'github', 'linkedin') NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_provider_unique (provider_name, provider_id),
    KEY idx_auth_providers_user_id (user_id),

    CONSTRAINT fk_auth_providers_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE email_verification_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_email_verification_codes_user_id (user_id),
    KEY idx_email_verification_codes_expires_at (expires_at),

    CONSTRAINT fk_email_verification_codes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    session_token CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    is_revoked TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_sessions_token (session_token),
    KEY idx_sessions_user_id (user_id),
    KEY idx_sessions_expires_at (expires_at),

    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NULL,
    token_hash CHAR(64) NOT NULL,
    is_revoked TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user_id (user_id),
    KEY idx_refresh_tokens_session_id (session_id),
    KEY idx_refresh_tokens_expires_at (expires_at),

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_refresh_tokens_session
        FOREIGN KEY (session_id) REFERENCES sessions(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE skills (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_skills_name (name),
    UNIQUE KEY uq_skills_normalized_name (normalized_name)
) ENGINE=InnoDB;

CREATE TABLE offers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description MEDIUMTEXT NOT NULL,
    description_preview TEXT NULL,
    location VARCHAR(255) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    contract_type VARCHAR(100) NULL,
    remote_policy VARCHAR(100) NULL,
    status ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'published',
    moderation_status ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved',
    premium TINYINT(1) NOT NULL DEFAULT 0,
    views_count INT UNSIGNED NOT NULL DEFAULT 0,
    salary_min DECIMAL(10,2) NULL,
    salary_max DECIMAL(10,2) NULL,
    salary_currency CHAR(3) NOT NULL DEFAULT 'EUR',
    salary_period ENUM('yearly', 'daily') NOT NULL DEFAULT 'yearly',
    source_posted_at DATETIME NULL,
    published_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_offers_company_id (company_id),
    KEY idx_offers_status (status),
    KEY idx_offers_moderation_status (moderation_status),
    KEY idx_offers_premium (premium),
    KEY idx_offers_location (location),
    KEY idx_offers_latitude (latitude),
    KEY idx_offers_longitude (longitude),
    KEY idx_offers_contract_type (contract_type),
    KEY idx_offers_published_at (published_at),
    KEY idx_offers_public_listing (status, moderation_status, expires_at, premium, published_at),
    KEY idx_offers_company_status_updated_at (company_id, status, updated_at),
    KEY idx_offers_created_by_user_id (created_by_user_id),
    KEY idx_offers_updated_by_user_id (updated_by_user_id),

    FULLTEXT KEY ftx_offers_title_description (title, description, description_preview),

    CONSTRAINT fk_offers_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_offers_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_offers_updated_by_user
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT chk_offers_salary_range
        CHECK (
            salary_min IS NULL
            OR salary_max IS NULL
            OR salary_min <= salary_max
        )
) ENGINE=InnoDB;

CREATE TABLE offer_sources (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    offer_id BIGINT UNSIGNED NOT NULL,
    source_name ENUM('welovedevs', 'manual') NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    source_url VARCHAR(1000) NULL,
    raw_payload JSON NULL,
    fetched_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_offer_sources_source_external (source_name, external_id),
    KEY idx_offer_sources_offer_id (offer_id),
    KEY idx_offer_sources_source_name (source_name),

    CONSTRAINT fk_offer_sources_offer
        FOREIGN KEY (offer_id) REFERENCES offers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE offer_skills (
    offer_id BIGINT UNSIGNED NOT NULL,
    skill_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (offer_id, skill_id),
    KEY idx_offer_skills_skill_id (skill_id),

    CONSTRAINT fk_offer_skills_offer
        FOREIGN KEY (offer_id) REFERENCES offers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_offer_skills_skill
        FOREIGN KEY (skill_id) REFERENCES skills(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_skills (
    user_id INT UNSIGNED NOT NULL,
    skill_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, skill_id),
    KEY idx_user_skills_skill_id (skill_id),

    CONSTRAINT fk_user_skills_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_skills_skill
        FOREIGN KEY (skill_id) REFERENCES skills(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE favorites (
    user_id INT UNSIGNED NOT NULL,
    offer_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, offer_id),
    KEY idx_favorites_offer_id (offer_id),
    KEY idx_favorites_user_created_at (user_id, created_at),

    CONSTRAINT fk_favorites_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_favorites_offer
        FOREIGN KEY (offer_id) REFERENCES offers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    offer_id BIGINT UNSIGNED NOT NULL,
    status ENUM('draft', 'submitted', 'viewed', 'accepted', 'rejected', 'withdrawn') NOT NULL DEFAULT 'submitted',
    cover_letter TEXT NULL,
    resume_url VARCHAR(1000) NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_applications_user_offer (user_id, offer_id),
    KEY idx_applications_offer_id (offer_id),
    KEY idx_applications_status (status),
    KEY idx_applications_applied_at (applied_at),
    KEY idx_applications_user_status_applied_at (user_id, status, applied_at),
    KEY idx_applications_offer_status_applied_at (offer_id, status, applied_at),

    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_applications_offer
        FOREIGN KEY (offer_id) REFERENCES offers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    event ENUM('company_invite', 'application_update') NOT NULL,
    event_data JSON NOT NULL,
    seen_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_notifications_user_id_seen_at (user_id, seen_at),
    KEY idx_notifications_user_id_created_at (user_id, created_at),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE moderation_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_user_id INT UNSIGNED NOT NULL,
    target_user_id INT UNSIGNED NULL,
    offer_id BIGINT UNSIGNED NULL,
    action_type ENUM(
        'offer_rejected',
        'offer_archived',
        'offer_restored',
        'user_banned',
        'user_unbanned',
        'role_changed',
        'other'
    ) NOT NULL,
    reason TEXT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_moderation_logs_admin_user_id (admin_user_id),
    KEY idx_moderation_logs_target_user_id (target_user_id),
    KEY idx_moderation_logs_offer_id (offer_id),
    KEY idx_moderation_logs_action_type (action_type),

    CONSTRAINT fk_moderation_logs_admin_user
        FOREIGN KEY (admin_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_moderation_logs_target_user
        FOREIGN KEY (target_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_moderation_logs_offer
        FOREIGN KEY (offer_id) REFERENCES offers(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO roles (name) VALUES
('user'),
('admin');
