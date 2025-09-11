// Configuration file to ensure environment variables are available
const config = {
  auth: {
    user: process.env.APP_USER || 'madx',
    password: process.env.APP_PW || 'As0YlmF3[9\\4'
  },
  ahrefs: {
    apiKey: process.env.AHREFS_API
  },
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  }
};

module.exports = config;