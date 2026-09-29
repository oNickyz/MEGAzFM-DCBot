'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estacoes')
    .setDescription('Lista as estacoes disponiveis'),

  async execute(interaction, { radioManager, config }) {
    const summary = radioManager.getStationsSummary();

    const lines = summary.map((s) => {
      if (s.isLive) {
        return s.available
          ? `🔴 **${s.name}** — AO VIVO (stream)`
          : `⚠️ **${s.name}** — stream sem URL valida`;
      }
      return s.available
        ? `🎶 **${s.name}** — ${s.trackCount} musicas`
        : `⚠️ **${s.name}** — sem musicas`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`📻 ${config.botName} — Estacoes`)
      .setDescription(lines.length > 0 ? lines.join('\n') : 'Nenhuma estacao encontrada.')
      .setColor(0x8a5cff);

    await interaction.reply({ embeds: [embed] });
  },
};
