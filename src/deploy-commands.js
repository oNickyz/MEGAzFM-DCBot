'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const { logger } = require('./utils/logger');
const { registerCommands } = require('./registerCommands');

async function main() {
  if (!config.discordToken || !config.clientId) {
    logger.error('deploy', 'DISCORD_TOKEN e CLIENT_ID sao obrigatorios no .env para rodar este script');
    process.exit(1);
  }

  const commandsDir = path.join(__dirname, 'commands');
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
  const commands = files.map((f) => require(path.join(commandsDir, f)).data.toJSON());

  try {
    await registerCommands({
      token: config.discordToken,
      applicationId: config.clientId,
      guildId: config.guildId,
      commands,
    });
  } catch (err) {
    logger.error('deploy', `falha ao registrar comandos: ${err.message}`);
    process.exit(1);
  }
}

main();
