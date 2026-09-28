'use strict';

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events, MessageFlags } = require('discord.js');
const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');
const { RadioManager } = require('./radio/manager');
const { StationSwitchCooldown } = require('./radio/cooldowns');
const { registerCommands } = require('./registerCommands');

async function main() {
  logger.info('radio', 'iniciando...');

  if (!validateConfig(logger)) {
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.commands = new Collection();

  const commandsPath = path.join(__dirname, 'commands');
  for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  }

  const cooldown = new StationSwitchCooldown({
    userCooldownMs: config.publicUserCooldownMs,
    globalCooldownMs: config.publicGlobalCooldownMs,
    adminCooldownMs: config.adminCooldownMs,
  });

  let radioManager = null;

  client.once(Events.ClientReady, async () => {
    logger.info('discord', `conectado como ${client.user.tag}`);

    // Registra os slash commands automaticamente a cada inicializacao. Isso evita
    // o problema comum de "os comandos nao aparecem" por esquecer de rodar
    // "npm run deploy" manualmente apos o deploy (ex: na Discloud). E seguro
    // rodar isso toda vez: o Discord apenas substitui o conjunto de comandos
    // pelo mesmo conteudo, sem criar duplicatas. Usa client.user.id em vez do
    // CLIENT_ID do .env para o registro por servidor, evitando erros de digitacao.
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
      logger.error('deploy', 'rode "npm run deploy" manualmente, ou verifique se o bot foi convidado com o escopo "applications.commands"');
    }

    const guild = config.guildId
      ? await client.guilds.fetch(config.guildId)
      : client.guilds.cache.first();

    if (!guild) {
      logger.error('radio', 'nenhum servidor (guild) disponivel para o bot operar');
      return;
    }

    radioManager = new RadioManager({ config, guild });
    client.radioManager = radioManager;

    // 3. descobrir estacoes
    radioManager.scanLibrary();

    // 4/5. conectar ao canal de voz configurado
    try {
      await radioManager.connectVoice();
    } catch (err) {
      logger.error('voice', `falha ao conectar ao canal configurado: ${err.message}`);
      return;
    }

    // 6. iniciar reproducao com a estacao padrao
    radioManager.startStation(config.defaultStation);

    if (config.textChannelId) {
      try {
        const channel = await client.channels.fetch(config.textChannelId);
        if (channel?.isTextBased()) {
          await channel.send(`📻 Radio iniciada.\n🎵 Estacao: ${radioManager.currentStation || 'nenhuma'}`);
        }
      } catch (err) {
        logger.warn('radio', `nao foi possivel enviar mensagem no canal de texto: ${err.message}`);
      }
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!radioManager) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '⏳ A radio ainda esta iniciando, tente novamente em instantes.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

    const context = { radioManager, config, cooldown };

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction, context);
        } catch (err) {
          logger.error('commands', `erro no autocomplete de /${interaction.commandName}: ${err.message}`);
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
      logger.error('commands', `erro ao executar /${interaction.commandName}: ${err.message}`);
      const payload = { content: '❌ Ocorreu um erro ao executar este comando.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  process.on('unhandledRejection', (err) => {
    logger.error('process', `rejeicao nao tratada: ${err?.message || err}`);
  });

  // Ultima linha de defesa: por padrao o Node encerra o processo em uma
  // excecao sincrona nao tratada. Como a radio precisa ficar no ar 24/7,
  // registramos o erro e mantemos o bot rodando em vez de deixar cair.
  process.on('uncaughtException', (err) => {
    logger.error('process', `excecao nao tratada: ${err?.message || err}`);
  });

  process.on('SIGINT', () => {
    logger.info('radio', 'encerrando...');
    if (radioManager) radioManager.voicePlayer.destroy();
    client.destroy();
    process.exit(0);
  });

  await client.login(config.discordToken);
}

main().catch((err) => {
  logger.error('radio', `falha critica ao iniciar: ${err.message}`);
  process.exit(1);
});
