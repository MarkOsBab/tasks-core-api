// Deterministic environment for unit tests: no network, no real DB, no real secrets.
// Runs before every test file (vitest `setupFiles`).

process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'unit-test-secret';
process.env['APP_URL'] = process.env['APP_URL'] || 'http://localhost:3002';
process.env['APP_WEB_URL'] = process.env['APP_WEB_URL'] || 'http://localhost:4200';

// Any accidental Prisma query must fail fast instead of reaching a real database.
process.env['DATABASE_URL'] = 'postgresql://unit:unit@127.0.0.1:1/unit_tests_no_db';
process.env['DIRECT_URL'] = process.env['DATABASE_URL'];

// External services stay dark: mailer short-circuits, AI client refuses to build.
process.env['NOTIFICATIONS_EMAIL_ENABLED'] = 'false';
delete process.env['OPENAI_API_KEY'];
delete process.env['AWS_ACCESS_KEY_ID'];
delete process.env['AWS_SECRET_ACCESS_KEY'];
