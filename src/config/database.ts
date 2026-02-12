export const databaseConfig = {
  url: process.env.DATABASE_URL || 'postgresql://cryptobet:cryptobet@localhost:5432/cryptobet',
  pool: {
    min: 2,
    max: 10,
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
};
