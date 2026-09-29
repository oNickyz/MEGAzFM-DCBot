'use strict';

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events, MessageFlags } = require('discord.js');
const { config, validateConfig } = require('./config');
const { logger } = require('./utils/logger');
const { registerCommands } = require('./registerCommands');
const { RadioManager } = require('./radio/manager');
const { VoicePlayer } = require('./radio/player');
const { StationSwitchCooldown } = require('./radio/cooldowns');

/**
 * Bootstrap compartilhado do bot. Recebe uma lista de diretorios de
 * comandos (permite que a versao Private combine os comandos do Core com
 * comandos privados adicionais, sem duplicar este arquivo) e,
 * opcionalmente, uma classe VoicePlayer alternativa (permite que a versao
 * Private injete uma subclasse com suporte a fontes extras, ex: YouTube).
 *
 * Uso no Core:
 *    startBot({ commandsDirs: [path.join(__dirname, 'commands')] });
 *
 * Uso no Private (exemplo):
 *    startBot({
 *      commandsDirs: [coreCommandsDir, privateCommandsDir],
 *      VoicePlayerClass: PrivateVoicePlayer,
 *    });
 */
async function startBot({ commandsDirs, VoicePlayerClass = VoicePlayer } = {}) {
  if (!validateConfig(logger)) {
    logger.error('boot', 'corrija o .env antes de iniciar o bot.');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.commands = new Collection();
  const dirs = Array.isArray(commandsDirs) ? commandsDirs : [commandsDirs];
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(dir, file));
      if (command && command.data && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
      }
    }
  }

  const cooldown = new StationSwitchCooldown({
    userCooldownMs: config.publicUserCooldownMs,
    globalCooldownMs: config.publicGlobalCooldownMs,
    adminCooldownMs: config.adminCooldownMs,
  });

  let radioManager = null;

  client.once(Events.ClientReady, async () => {
    logger.info('discord', `conectado como ${client.user.tag}`);

    try {
      const commandsJson = client.commands.map((cmd) => cmd.data.toJSON());
      await registerCommands({
        token: config.discordToken,
        applicationId: client.user.id,
        guildId: config.guildId,
        commands: commandsJson,
      });
    } catch (err) {
      logger.error('deploy', `falha ao registrar comandos automaticamente: ${err.message}`);
      logger.error('deploy', 'rode "npm run deploy" manualmente, ou verifique se o escopo "applications.commands" foi concedido ao convidar o bot.');
    }

    let guild;
    try {
      guild = config.guildId ? await client.guilds.fetch(config.guildId) : client.guilds.cache.first();
    } catch (err) {
      logger.error('discord', `nao foi possivel obter o servidor (guild): ${err.message}`);
      return;
    }
    if (!guild) {
      logger.error('discord', 'nenhum servidor (guild) disponivel para iniciar a radio');
      return;
    }

    radioManager = new RadioManager({ config, guild, VoicePlayerClass });
    client.radioManager = radioManager;

    radioManager.scanLibrary();

    try {
      await radioManager.connectVoice();
    } catch (err) {
      logger.error('voice', `falha ao conectar ao canal de voz: ${err.message}`);
      return;
    }

    radioManager.startStation(config.defaultStation);

    if (config.textChannelId) {
      try {
        const channel = await client.channels.fetch(config.textChannelId);
        if (channel && channel.isTextBased()) {
          await channel.send(`📻 ${config.botName} esta online.`);
        }
      } catch (err) {
        logger.warn('discord', `nao foi possivel enviar mensagem no canal de texto configurado: ${err.message}`);
      }
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!radioManager && !interaction.isAutocomplete()) {
      if (interaction.isRepliable()) {
        try {
          await interaction.reply({ content: 'O bot ainda esta inicializando, tente novamente em alguns segundos.', flags: MessageFlags.Ephemeral });
        } catch (err) {
          // ignora
        }
      }
      return;
    }

    const context = { radioManager, config, cooldown, client };

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === 'function') {
        try {
          await command.autocomplete(interaction, context);
        } catch (err) {
          logger.error('commands', `erro no autocomplete de "${interaction.commandName}": ${err.message}`);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, context);
    } catch (err) {
      logger.error('commands', `erro ao executar "${interaction.commandName}": ${err.message}`);
      const payload = { content: 'Ocorreu um erro ao executar este comando.', flags: MessageFlags.Ephemeral };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch (err2) {
        // ignora - interacao pode ter expirado
      }
    }
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('process', `unhandledRejection: ${reason instanceof Error ? reason.message : reason}`);
  });

  process.on('uncaughtException', (err) => {
    logger.error('process', `uncaughtException: ${err.message}`);
    // Nao encerra o processo - mantem o bot online 24/7 mesmo apos erros recuperaveis.
  });

  process.on('SIGINT', () => {
    logger.info('process', 'encerrando (SIGINT)...');
    try {
      radioManager?.voicePlayer.destroy();
      client.destroy();
    } finally {
      process.exit(0);
    }
  });

  await client.login(config.discordToken);

  return client;
}

module.exports = { startBot };
