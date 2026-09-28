'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Recarrega as estacoes e musicas do disco (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager }) {
    const stats = radioManager.reload();

    let content = `✅ Biblioteca recarregada.\n${stats.stationCount} estacoes encontradas.\n${stats.trackCount} musicas encontradas.`;
    if (stats.trackCount === 0) {
      content += '\n\n⚠️ Nenhuma musica encontrada em nenhuma estacao. A radio ficara aguardando ate que arquivos .mp3 sejam adicionados.';
    }

    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  },
};
