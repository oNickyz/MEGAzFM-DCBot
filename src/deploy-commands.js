'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const { registerCommands } = require('./registerCommands');
const logger = require('./utils/logger');

async function main() {
  if (!config.discordToken || !config.clientId) {
    logger.error('deploy', 'DISCORD_TOKEN e CLIENT_ID sao obrigatorios no .env para registrar comandos');
    process.exit(1);
  }

  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  const commands = commandFiles.map((file) => {
    const command = require(path.join(commandsPath, file));
    return command.data.toJSON();
  });

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
