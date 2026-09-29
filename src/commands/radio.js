'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Controle geral da radio (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager, config }) {
    const now = radioManager.getNowPlaying();
    const embed = new EmbedBuilder()
      .setTitle(`📻 ${config.botName} — Status`)
      .addFields(
        { name: 'Estacao', value: now.station || 'nenhuma', inline: true },
        { name: 'Estado', value: now.state, inline: true },
        { name: 'Tocando', value: now.track || 'nada', inline: true },
      )
      .setColor(0x8a5cff);
    await interaction.reply({ embeds: [embed] });
  },
};
