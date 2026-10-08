// Test-only configuration. Values here are throwaway and never used outside tests.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/placeholder';
process.env.CORS_ORIGINS = 'http://localhost:5180,http://localhost:5181';
process.env.COOKIE_SECURE = 'false';
process.env.JWT_ACCESS_SECRET = 'test-secret-'.padEnd(80, 'x');
process.env.OTP_PEPPER = 'test-pepper-'.padEnd(40, 'y');
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ v1: Buffer.alloc(32, 7).toString('base64') });
process.env.DATA_ENCRYPTION_ACTIVE_VERSION = 'v1';
process.env.SMS_PROVIDER = 'console';
