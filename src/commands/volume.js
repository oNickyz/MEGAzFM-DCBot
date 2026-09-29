'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { MIN_VOLUME, MAX_VOLUME } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Define o volume da radio (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addNumberOption((opt) =>
      opt.setName('valor').setDescription(`Valor entre ${MIN_VOLUME} e ${MAX_VOLUME} (1.0 = normal)`).setRequired(true)
    ),

  async execute(interaction, { radioManager }) {
    const value = interaction.options.getNumber('valor');
    if (!Number.isFinite(value) || value < MIN_VOLUME || value > MAX_VOLUME) {
      await interaction.reply({
        content: `Valor invalido. Use um numero entre ${MIN_VOLUME} e ${MAX_VOLUME}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    radioManager.setVolume(value);
    await interaction.reply(`🔊 Volume ajustado para ${value}.`);
  },
};
