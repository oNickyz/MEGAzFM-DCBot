'use strict';

const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { STREAM_MARKER_FILE } = require('../radio/stationManager');

const VALID_NAME = /^[a-z0-9_-]+$/i;
const YOUTUBE_PATTERN = /(?:youtube\.com|youtu\.be)/i;

/**
 * Comando publico/Core: adiciona uma estacao de stream generico
 * (Icecast/Shoutcast HTTP direto). URLs do YouTube sao rejeitadas aqui de
 * proposito - suporte a YouTube e um recurso exclusivo do MEGAzFM Private
 * (ver documentacao do projeto sobre a separacao Core/Private).
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstream')
    .setDescription('Adiciona ou atualiza uma estacao de radio online (Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('nome').setDescription('Nome da estacao (letras, numeros, - e _)').setRequired(true))
    .addStringOption((opt) => opt.setName('url').setDescription('URL do stream (http/https, ex: Icecast/Shoutcast)').setRequired(true)),

  async execute(interaction, { radioManager, config }) {
    const name = interaction.options.getString('nome').trim();
    const url = interaction.options.getString('url').trim();

    if (!VALID_NAME.test(name)) {
      await interaction.reply({ content: 'Nome invalido. Use apenas letras, numeros, "-" e "_".', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      await interaction.reply({ content: 'URL invalida. Deve comecar com http:// ou https://.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (YOUTUBE_PATTERN.test(url)) {
      await interaction.reply({
        content: 'Streams do YouTube nao sao suportados nesta versao (MEGAzFM Core). Use um link direto de stream (Icecast/Shoutcast).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const stationDir = path.join(config.stationsPath, name);
      fs.mkdirSync(stationDir, { recursive: true });
      fs.writeFileSync(path.join(stationDir, STREAM_MARKER_FILE), `${url}\n`);
      radioManager.reload();
      await interaction.reply(`✅ Estacao **${name}** adicionada/atualizada como transmissao ao vivo.`);
    } catch (err) {
      await interaction.reply({ content: `Falha ao salvar a estacao: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
