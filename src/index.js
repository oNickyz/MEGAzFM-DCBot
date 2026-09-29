'use strict';

const path = require('path');
const { startBot } = require('./bootstrap');
const { logger } = require('./utils/logger');

logger.info('radio', 'iniciando...');

startBot({
  commandsDirs: [path.join(__dirname, 'commands')],
}).catch((err) => {
  logger.error('boot', `falha fatal ao iniciar o bot: ${err.message}`);
  process.exit(1);
});
