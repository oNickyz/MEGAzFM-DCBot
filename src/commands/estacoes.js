'use strict';

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estacoes')
    .setDescription('Lista as estacoes disponiveis e quantas musicas cada uma tem'),
  // Publico: qualquer membro pode usar.

  async execute(interaction, { radioManager }) {
    const summary = radioManager.getStationsSummary();

    if (summary.length === 0) {
      await interaction.reply({ content: '📻 Nenhuma estacao encontrada no momento.', flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = summary.map(({ name, trackCount }) => {
      const emoji = trackCount > 0 ? '🎶' : '⚠️';
      const label = trackCount === 1 ? '1 musica' : `${trackCount} musicas`;
      return `${emoji} **${name}** — ${trackCount === 0 ? 'sem musicas' : label}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('📻 MEGAzFM — Estacoes')
      .setColor(0x8e7cff)
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
