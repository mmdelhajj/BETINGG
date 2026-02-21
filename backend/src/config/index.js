"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(key, defaultValue) {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
function optionalEnv(key, defaultValue) {
    return process.env[key] ?? defaultValue;
}
exports.config = {
    // Server
    PORT: parseInt(requireEnv('PORT', '3001'), 10),
    NODE_ENV: requireEnv('NODE_ENV', 'development'),
    // Database
    DATABASE_URL: requireEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/cryptobet'),
    // Redis
    REDIS_URL: requireEnv('REDIS_URL', 'redis://localhost:6379'),
    // JWT
    JWT_SECRET: requireEnv('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
    JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET', 'dev-jwt-refresh-secret-change-in-production'),
    JWT_ACCESS_EXPIRY: requireEnv('JWT_ACCESS_EXPIRY', '15m'),
    JWT_REFRESH_EXPIRY: requireEnv('JWT_REFRESH_EXPIRY', '7d'),
    // OAuth - Google
    GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET'),
    GOOGLE_CALLBACK_URL: optionalEnv('GOOGLE_CALLBACK_URL', 'http://localhost:3001/api/auth/google/callback'),
    // OAuth - GitHub
    GITHUB_CLIENT_ID: optionalEnv('GITHUB_CLIENT_ID'),
    GITHUB_CLIENT_SECRET: optionalEnv('GITHUB_CLIENT_SECRET'),
    GITHUB_CALLBACK_URL: optionalEnv('GITHUB_CALLBACK_URL', 'http://localhost:3001/api/auth/github/callback'),
    // Frontend
    FRONTEND_URL: requireEnv('FRONTEND_URL', 'http://localhost:3000'),
    // External APIs
    COINGECKO_API_URL: optionalEnv('COINGECKO_API_URL', 'https://api.coingecko.com/api/v3'),
    THE_ODDS_API_KEY: optionalEnv('THE_ODDS_API_KEY'),
    GOALSERVE_API_KEY: optionalEnv('GOALSERVE_API_KEY'),
    // MoonPay
    MOONPAY_API_KEY: optionalEnv('MOONPAY_API_KEY'),
    MOONPAY_SECRET: optionalEnv('MOONPAY_SECRET'),
    // SMTP / Email
    SMTP_HOST: optionalEnv('SMTP_HOST'),
    SMTP_PORT: parseInt(optionalEnv('SMTP_PORT', '587') ?? '587', 10),
    SMTP_USER: optionalEnv('SMTP_USER'),
    SMTP_PASS: optionalEnv('SMTP_PASS'),
    SMTP_FROM: optionalEnv('SMTP_FROM', 'noreply@cryptobet.com'),
};
exports.default = exports.config;
