'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reconnect')
    .setDescription('Forca a reconexao ao canal de voz (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager }) {
    await interaction.deferReply();
    const ready = await radioManager.reconnect();
    await interaction.editReply(ready ? '🔌 Reconectado com sucesso.' : '⚠️ Reconexao tentada, mas o estado Ready nao foi confirmado. Veja os logs.');
  },
};
