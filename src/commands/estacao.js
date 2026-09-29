'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estacao')
    .setDescription('Troca a estacao da radio (se habilitado publicamente)')
    .addStringOption((opt) =>
      opt.setName('nome').setDescription('Nome da estacao').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction, { radioManager }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = radioManager.getStationsSummary().map((s) => {
      const label = s.isLive ? `${s.name} (ao vivo)` : s.available ? s.name : `${s.name} (vazia)`;
      return { name: label, value: s.name };
    });
    const filtered = choices.filter((c) => c.value.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(filtered);
  },

  async execute(interaction, { radioManager, config, cooldown }) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

    if (!config.publicStationSwitchEnabled && !isAdmin) {
      await interaction.reply({
        content: 'A troca publica de estacao esta desabilitada. Peca a um administrador para usar /station.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const check = cooldown.check(interaction.user.id, isAdmin);
    if (!check.ok) {
      const seconds = Math.ceil(check.retryAfterMs / 1000);
      await interaction.reply({
        content: `Aguarde ${seconds}s antes de trocar de estacao novamente (cooldown: ${check.scope}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const stationName = interaction.options.getString('nome');
    const result = radioManager.switchStation(stationName);

    if (!result.ok) {
      await interaction.reply({
        content: `Estacao "${stationName}" nao existe ou esta vazia.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    cooldown.register(interaction.user.id, isAdmin);
    await interaction.reply(`📻 Estacao trocada para **${stationName}**.`);
  },
};
