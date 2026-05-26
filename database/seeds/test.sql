USE job_aggregator;

INSERT INTO companies (id, name, slug, website_url, description)
VALUES
	(1, 'Starz Test Company', 'starz-test-company', 'https://example.com', 'Entreprise de test')
ON DUPLICATE KEY UPDATE
	name = VALUES(name),
	slug = VALUES(slug),
	website_url = VALUES(website_url),
	description = VALUES(description);

INSERT INTO users (
	id,
	orga_id,
	company_role,
	role_id,
	firstname,
	lastname,
	email,
	password_hash,
	status,
	email_verified_at
)
VALUES
	(
		1,
		NULL,
		NULL,
		(SELECT id FROM roles WHERE name = 'user'),
		'User',
		'Test',
		'user@example.com',
		'$2b$10$VdIhetmPJMR7fx0Pjcg9vehqQULoDdLbdUXA2Yvtwpyg5yzi/J89W',
		'en_recherche',
		NOW()
	),
	(
		2,
		1,
		'owner',
		(SELECT id FROM roles WHERE name = 'user'),
		'Recruiter',
		'Test',
		'recruiter@example.com',
		'$2b$10$VdIhetmPJMR7fx0Pjcg9vehqQULoDdLbdUXA2Yvtwpyg5yzi/J89W',
		'recruteur',
		NOW()
	),
	(
		4,
		NULL,
		NULL,
		(SELECT id FROM roles WHERE name = 'user'),
		'Invited',
		'Test',
		'invited@example.com',
		'$2b$10$VdIhetmPJMR7fx0Pjcg9vehqQULoDdLbdUXA2Yvtwpyg5yzi/J89W',
		'en_recherche',
		NOW()
	),
	(
		3,
		NULL,
		NULL,
		(SELECT id FROM roles WHERE name = 'admin'),
		'Admin',
		'Test',
		'admin@example.com',
		'$2b$10$VdIhetmPJMR7fx0Pjcg9vehqQULoDdLbdUXA2Yvtwpyg5yzi/J89W',
		'en_recherche',
		NOW()
	)
ON DUPLICATE KEY UPDATE
	firstname = VALUES(firstname),
	lastname = VALUES(lastname),
	email = VALUES(email),
	password_hash = VALUES(password_hash),
	status = VALUES(status),
	email_verified_at = VALUES(email_verified_at);

INSERT INTO auth_providers (user_id, provider_name, provider_id, email)
VALUES
	(1, 'local', '1', 'user@example.com'),
	(2, 'local', '2', 'recruiter@example.com'),
	(3, 'local', '3', 'admin@example.com'),
	(4, 'local', '4', 'invited@example.com')
ON DUPLICATE KEY UPDATE
	email = VALUES(email);

INSERT INTO offers (
	id,
	company_id,
	title,
	description,
	description_preview,
	location,
	contract_type,
	remote_policy,
	status,
	moderation_status,
	published_at,
	created_by_user_id
)
VALUES
	(
		1,
		1,
		'Backend Developer Test',
		'Construire et maintenir une API Node.js TypeScript.',
		'API Node.js TypeScript',
		'Paris, France',
		'CDI',
		'hybrid',
		'published',
		'approved',
		NOW(),
		2
	)
ON DUPLICATE KEY UPDATE
	title = VALUES(title),
	description = VALUES(description),
	status = VALUES(status),
	moderation_status = VALUES(moderation_status);

INSERT INTO skills (id, name, normalized_name)
VALUES
	(1, 'NodeJS', 'nodejs'),
	(2, 'TypeScript', 'typescript')
ON DUPLICATE KEY UPDATE
	name = VALUES(name),
	normalized_name = VALUES(normalized_name);

INSERT IGNORE INTO offer_skills (offer_id, skill_id)
VALUES
	(1, 1),
	(1, 2);
