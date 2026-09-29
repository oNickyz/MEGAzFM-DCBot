'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Mostra as ultimas musicas reproduzidas'),

  async execute(interaction, { radioManager, config }) {
    const now = radioManager.getNowPlaying();
    if (now.isLive) {
      await interaction.reply('🔴 Esta estacao e uma transmissao ao vivo — nao ha historico de faixas.');
      return;
    }

    const history = radioManager.getRecentHistory(5);
    const embed = new EmbedBuilder()
      .setTitle(`📜 ${config.botName} — Historico`)
      .setDescription(history.length > 0 ? history.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'Nenhuma musica tocada ainda.')
      .setColor(0x8a5cff);

    await interaction.reply({ embeds: [embed] });
  },
};
