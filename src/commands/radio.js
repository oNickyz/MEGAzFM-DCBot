'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { RadioState } = require('../radio/manager');

const STATE_LABELS = {
  [RadioState.ONLINE]: '🟢 Online',
  [RadioState.CONNECTING]: '🟡 Conectando',
  [RadioState.EMPTY]: '🟡 Aguardando musicas',
  [RadioState.OFFLINE]: '🔴 Offline',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Mostra o estado geral da radio (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager, config }) {
    const info = radioManager.getNowPlaying();
    const trackCount = info.station
      ? radioManager.stationManager.getTracks(info.station).length
      : 0;

    const embed = new EmbedBuilder()
      .setTitle('📻 MEGAzFM')
      .setColor(0x8e7cff)
      .addFields(
        { name: 'Estado', value: STATE_LABELS[info.state] || info.state, inline: true },
        { name: 'Canal', value: `<#${config.voiceChannelId}>`, inline: true },
        { name: 'Estacao', value: info.station ? `${info.station} (${trackCount} musicas)` : 'Nenhuma', inline: true },
        { name: 'Musica', value: info.track || 'Nada no momento', inline: true },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
