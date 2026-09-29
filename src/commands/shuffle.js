'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Ativa ou desativa a reproducao aleatoria (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((opt) => opt.setName('ativo').setDescription('true para ativar, false para desativar').setRequired(true)),

  async execute(interaction, { radioManager }) {
    const enabled = interaction.options.getBoolean('ativo');
    radioManager.setShuffle(enabled);
    await interaction.reply(`🔀 Modo aleatorio ${enabled ? 'ativado' : 'desativado'}.`);
  },
};
