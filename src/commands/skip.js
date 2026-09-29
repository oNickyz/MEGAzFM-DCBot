'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pula a musica atual (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager }) {
    const result = radioManager.skip();
    if (!result.ok) {
      await interaction.reply({ content: 'Aguarde um instante antes de pular novamente.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply('⏭️ Pulando para a proxima musica...');
  },
};
