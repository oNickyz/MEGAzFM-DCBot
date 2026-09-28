'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Mostra as ultimas musicas reproduzidas'),
  // Publico: qualquer membro pode usar.

  async execute(interaction, { radioManager }) {
    const history = radioManager.getRecentHistory(5);

    if (history.length === 0) {
      await interaction.reply({ content: 'ℹ️ Ainda nao ha historico de musicas nesta sessao.', flags: MessageFlags.Ephemeral });
      return;
    }

    const list = history.map((name, i) => `${i + 1}. ${name}`).join('\n');

    await interaction.reply({
      content: `🕘 Ultimas musicas tocadas:\n${list}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
