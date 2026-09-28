'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pula a musica atual da radio')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { radioManager }) {
    if (!radioManager.currentStation) {
      await interaction.reply({ content: 'ℹ️ Nao ha nenhuma estacao tocando no momento.', flags: MessageFlags.Ephemeral });
      return;
    }

    const started = radioManager.skip();

    if (!started) {
      await interaction.reply({ content: '⏳ Ja existe um skip em andamento, aguarde um instante.', flags: MessageFlags.Ephemeral });
      return;
    }

    const info = radioManager.getNowPlaying();
    if (!info.track) {
      await interaction.reply({ content: '⚠️ Musica pulada, mas nao ha mais faixas disponiveis nesta estacao.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: `⏭️ Musica pulada. Tocando agora: **${info.track}**`, flags: MessageFlags.Ephemeral });
  },
};
