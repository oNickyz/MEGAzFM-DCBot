'use strict';

const { REST, Routes } = require('discord.js');
const { logger } = require('./utils/logger');

/**
 * Registra os slash commands na API do Discord.
 * Se guildId estiver definido, registra no servidor (instantaneo, ideal
 * para desenvolvimento). Caso contrario, registra globalmente (leva
 * ate ~1h para propagar em todos os servidores).
 */
async function registerCommands({ token, applicationId, guildId, commands }) {
  const rest = new REST({ version: '10' }).setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands });
    logger.info('deploy', `${commands.length} comandos registrados no servidor (guild) ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(applicationId), { body: commands });
    logger.info('deploy', `${commands.length} comandos registrados globalmente (pode levar ate 1h para propagar)`);
  }
}

module.exports = { registerCommands };
