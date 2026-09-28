'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('station')
    .setDescription('Troca a estacao da radio (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome da estacao')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction, { radioManager }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const stations = radioManager.listStations();

    const filtered = stations
      .filter((name) => name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((name) => ({
        name: radioManager.stationManager.isStationAvailable(name) ? name : `${name} (vazia)`,
        value: name,
      }));

    await interaction.respond(filtered);
  },

  async execute(interaction, { radioManager }) {
    const stationName = interaction.options.getString('nome', true);

    if (!radioManager.stationManager.hasStation(stationName)) {
      await interaction.reply({ content: `❌ Estacao "${stationName}" nao existe.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const result = radioManager.switchStation(stationName);

    if (!result.ok) {
      await interaction.reply({ content: `❌ Estacao "${stationName}" esta vazia ou indisponivel.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: `✅ Estacao alterada para **${stationName}**.`, flags: MessageFlags.Ephemeral });
  },
};
