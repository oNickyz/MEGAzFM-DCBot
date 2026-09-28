'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Ativa ou desativa a reproducao aleatoria (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName('ativado')
        .setDescription('true para aleatorio, false para sequencial')
        .setRequired(true)),

  async execute(interaction, { radioManager }) {
    const enabled = interaction.options.getBoolean('ativado', true);

    radioManager.setShuffle(enabled);

    await interaction.reply({
      content: enabled
        ? '🔀 Reproducao aleatoria ativada.'
        : '➡️ Reproducao aleatoria desativada (ordem sequencial).',
      flags: MessageFlags.Ephemeral,
    });
  },
};
