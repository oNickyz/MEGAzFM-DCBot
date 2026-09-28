'use strict';

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { RadioState } = require('../radio/manager');

const STATE_LABELS = {
  [RadioState.ONLINE]: '🟢 Online',
  [RadioState.CONNECTING]: '🟡 Conectando',
  [RadioState.EMPTY]: '🟡 Aguardando musicas',
  [RadioState.OFFLINE]: '🔴 Offline',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra a musica e estacao atual da radio'),
  // Publico: qualquer membro pode usar.

  async execute(interaction, { radioManager }) {
    const info = radioManager.getNowPlaying();

    const embed = new EmbedBuilder()
      .setTitle('🎵 MEGAzFM')
      .setColor(0x8e7cff)
      .addFields(
        { name: 'Estacao', value: info.station || 'Nenhuma', inline: true },
        { name: 'Tocando', value: info.track || 'Nada no momento', inline: true },
        { name: 'Estado', value: STATE_LABELS[info.state] || info.state, inline: true },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
