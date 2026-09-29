'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const STATE_LABELS = {
  ONLINE: '🟢 Tocando',
  EMPTY: '🟡 Aguardando musicas',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra a musica e a estacao atual da radio'),

  async execute(interaction, { radioManager, config }) {
    const now = radioManager.getNowPlaying();
    const embed = new EmbedBuilder()
      .setTitle(`🎵 ${config.botName}`)
      .addFields(
        { name: 'Estacao', value: now.station || 'nenhuma', inline: true },
        { name: 'Tocando', value: now.track || 'nada no momento', inline: true },
        { name: 'Estado', value: STATE_LABELS[now.state] || now.state, inline: true },
      )
      .setColor(0x8a5cff);

    await interaction.reply({ embeds: [embed] });
  },
};
