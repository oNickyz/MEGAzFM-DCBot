'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

function formatRetryAfter(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}min`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estacao')
    .setDescription('Troca a estacao da radio (disponivel para todos quando habilitado)')
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome da estacao')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction, { radioManager }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const stations = radioManager.listAvailableStations();

    const filtered = stations
      .filter((name) => name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((name) => ({ name, value: name }));

    await interaction.respond(filtered);
  },

  async execute(interaction, { radioManager, config, cooldown }) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

    if (!config.publicStationSwitchEnabled && !isAdmin) {
      await interaction.reply({
        content: '🚫 A troca publica de estacao esta desativada no momento.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const stationName = interaction.options.getString('nome', true);

    if (!radioManager.stationManager.hasStation(stationName)) {
      await interaction.reply({ content: `❌ Estacao "${stationName}" nao existe.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const cooldownCheck = cooldown.check(interaction.user.id, isAdmin);
    if (!cooldownCheck.ok) {
      await interaction.reply({
        content: `⏳ Aguarde ${formatRetryAfter(cooldownCheck.retryAfterMs)} antes de trocar a estacao novamente.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = radioManager.switchStation(stationName);

    if (!result.ok) {
      await interaction.reply({ content: `❌ Estacao "${stationName}" esta vazia ou indisponivel.`, flags: MessageFlags.Ephemeral });
      return;
    }

    cooldown.register(interaction.user.id, isAdmin);

    await interaction.reply({ content: `✅ Estacao alterada para **${stationName}**.`, flags: MessageFlags.Ephemeral });

    if (config.announcePublicStationChange && config.textChannelId) {
      try {
        const channel = await interaction.client.channels.fetch(config.textChannelId);
        if (channel?.isTextBased()) {
          await channel.send(`📻 ${interaction.user} alterou a estacao da radio para **${stationName}**.`);
        }
      } catch (err) {
        // Falha ao anunciar nao deve afetar a radio, apenas log no console
        require('../utils/logger').warn('radio', `falha ao anunciar troca de estacao: ${err.message}`);
      }
    }
  },
};
