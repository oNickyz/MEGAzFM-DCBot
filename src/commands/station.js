'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('station')
    .setDescription('Troca a estacao da radio (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName('nome').setDescription('Nome da estacao').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction, { radioManager }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = radioManager.getStationsSummary().map((s) => {
      const label = s.isLive ? `${s.name} (ao vivo)` : s.available ? s.name : `${s.name} (vazia)`;
      return { name: label, value: s.name };
    });
    const filtered = choices.filter((c) => c.value.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(filtered);
  },

  async execute(interaction, { radioManager }) {
    const stationName = interaction.options.getString('nome');
    const result = radioManager.switchStation(stationName);
    if (!result.ok) {
      await interaction.reply({ content: `Estacao "${stationName}" nao existe ou esta vazia.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(`📻 Estacao trocada para **${stationName}**.`);
  },
};
