'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fila')
    .setDescription('Mostra uma previsao das proximas musicas'),

  async execute(interaction, { radioManager, config }) {
    const now = radioManager.getNowPlaying();
    if (now.isLive) {
      await interaction.reply('🔴 Esta estacao e uma transmissao ao vivo — nao existe fila de faixas.');
      return;
    }

    const upcoming = radioManager.previewQueue(3);
    const embed = new EmbedBuilder()
      .setTitle(`⏭️ ${config.botName} — Proximas (previsao)`)
      .setDescription(
        upcoming.length > 0
          ? upcoming.map((t, i) => `${i + 1}. ${t}`).join('\n')
          : 'Nao ha musicas suficientes para prever a fila.'
      )
      .setFooter({ text: 'Esta e apenas uma previsao com base no modo aleatorio atual, nao uma fila garantida.' })
      .setColor(0x8a5cff);

    await interaction.reply({ embeds: [embed] });
  },
};
