'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reconnect')
    .setDescription('Forca a reconexao ao canal de voz (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager }) {
    const ok = radioManager.reconnect();

    if (!ok) {
      await interaction.reply({
        content: '⏳ Ja existe uma reconexao em andamento, aguarde um instante.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({ content: '🔄 Reconectado ao canal de voz.', flags: MessageFlags.Ephemeral });
  },
};
