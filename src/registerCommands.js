'use strict';

const { REST, Routes } = require('discord.js');
const logger = require('./utils/logger');

/**
 * Registra (PUT) a lista completa de comandos no Discord. Chamar de novo com a
 * mesma lista e idempotente (o Discord substitui o conjunto inteiro), entao e
 * seguro rodar isso toda vez que o bot iniciar.
 *
 * @param {object} opts
 * @param {string} opts.token
 * @param {string} opts.applicationId - normalmente client.user.id (mais confiavel que CLIENT_ID do .env)
 * @param {string} [opts.guildId] - se definido, registra so nesse servidor (instantaneo). Se vazio, registra globalmente (pode levar ate 1h).
 * @param {object[]} opts.commands - array de SlashCommandBuilder.toJSON()
 */
async function registerCommands({ token, applicationId, guildId, commands }) {
  const rest = new REST({ version: '10' }).setToken(token);

  if (guildId) {
    await rest.put(
      Routes.applicationGuildCommands(applicationId, guildId),
      { body: commands },
    );
    logger.info('deploy', `${commands.length} comandos registrados no servidor ${guildId}`);
  } else {
    await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands },
    );
    logger.info('deploy', `${commands.length} comandos registrados globalmente (pode levar ate 1h para propagar)`);
  }
}

module.exports = { registerCommands };
