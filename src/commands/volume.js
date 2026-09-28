'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { MIN_VOLUME, MAX_VOLUME } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Define o volume da radio (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addNumberOption((option) =>
      option
        .setName('valor')
        .setDescription(`Volume entre ${MIN_VOLUME} e ${MAX_VOLUME} (1.0 = normal)`)
        .setRequired(true)
        .setMinValue(MIN_VOLUME)
        .setMaxValue(MAX_VOLUME)),

  async execute(interaction, { radioManager }) {
    const value = interaction.options.getNumber('valor', true);

    // O Discord ja restringe pelo setMinValue/setMaxValue, mas validamos de novo
    // no backend para nunca confiar apenas na interface (evita volumes absurdos
    // mesmo que alguem force o parametro por fora do client oficial).
    if (!Number.isFinite(value) || value < MIN_VOLUME || value > MAX_VOLUME) {
      await interaction.reply({
        content: `❌ Valor invalido. Use um numero entre ${MIN_VOLUME} e ${MAX_VOLUME}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!radioManager.currentStation) {
      await interaction.reply({ content: 'ℹ️ Nao ha radio tocando no momento, mas o volume sera aplicado assim que iniciar.', flags: MessageFlags.Ephemeral });
      radioManager.setVolume(value);
      return;
    }

    radioManager.setVolume(value);

    await interaction.reply({
      content: `🔊 Volume alterado para **${value.toFixed(2)}**. A musica atual reiniciou para aplicar o novo volume.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
