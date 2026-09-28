'use strict';

/**
 * Converte o nome de um arquivo de musica em um titulo legivel.
 * Exemplo: "001 - Snowfall.mp3" -> "Snowfall"
 *          "017_Late Night.mp3" -> "Late Night"
 *          "SongName.mp3"       -> "SongName"
 */
function cleanTrackName(fileName) {
  if (!fileName) return 'Desconhecida';

  let name = fileName;
  // Remove uma ou mais extensoes ".mp3" repetidas no final (ex: arquivos
  // salvos como "nome.mp3.mp3" por engano continuam ficando limpos).
  while (/\.mp3$/i.test(name)) {
    name = name.replace(/\.mp3$/i, '');
  }

  // Remove prefixos numericos comuns: "001 - ", "017_", "3.", "12) "
  name = name.replace(/^\s*\d+\s*[-_.)]\s*/, '');

  name = name.trim();

  return name.length > 0 ? name : fileName;
}

module.exports = { cleanTrackName };
