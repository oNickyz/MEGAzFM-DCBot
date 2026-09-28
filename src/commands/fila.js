'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fila')
    .setDescription('Mostra uma previsao das proximas musicas da estacao atual'),
  // Publico: qualquer membro pode usar.

  async execute(interaction, { radioManager }) {
    if (!radioManager.currentStation) {
      await interaction.reply({ content: 'ℹ️ Nao ha nenhuma estacao tocando no momento.', flags: MessageFlags.Ephemeral });
      return;
    }

    const upcoming = radioManager.previewQueue(3);

    if (upcoming.length === 0) {
      await interaction.reply({ content: '⚠️ Nao ha musicas suficientes nesta estacao para mostrar uma previsao.', flags: MessageFlags.Ephemeral });
      return;
    }

    // A radio escolhe a proxima faixa apenas quando a atual termina, entao
    // isso e uma previsao baseada na mesma logica de selecao, nao uma fila real.
    const list = upcoming.map((name, i) => `${i + 1}. ${name}`).join('\n');

    await interaction.reply({
      content: `🔮 Provaveis proximas musicas (previsao, nao garantida):\n${list}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
