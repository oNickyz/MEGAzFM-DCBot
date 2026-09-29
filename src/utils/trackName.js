'use strict';

/**
 * Limpa um nome de arquivo para exibicao:
 * - remove TODAS as extensoes .mp3 finais (cobre arquivos com extensao duplicada,
 *   ex: "Track.mp3.mp3")
 * - remove prefixo numerico de faixa (ex: "006 - ", "12_", "3.")
 * - usa o nome original como fallback se o resultado ficar vazio
 */
function cleanTrackName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'Faixa desconhecida';

  let name = fileName.trim();

  while (/\.mp3$/i.test(name)) {
    name = name.replace(/\.mp3$/i, '').trim();
  }

  const withoutPrefix = name.replace(/^\s*\d+\s*[-_.)]\s*/, '').trim();

  const finalName = withoutPrefix.length > 0 ? withoutPrefix : name;
  return finalName.length > 0 ? finalName : fileName;
}

module.exports = { cleanTrackName };
