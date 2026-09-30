# MEGAzFM Core - (Open Source Version)

[![MIT License](https://img.shields.io/github/license/oNickyz/MEGAzFM-DCBot)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-CommonJS-f7df1e?logo=javascript&logoColor=black)](package.json)

Bot Discord leve e estável para rodar uma rádio 24/7 em um canal de voz, tocando
arquivos MP3 locais e/ou estações de stream online (Icecast/Shoutcast).

Este é o pacote **Open Source** do projeto MEGAzFM. Ele contém apenas os
recursos públicos: reprodução de MP3, sistema de estações, fila/histórico,
volume, shuffle, reconexão de voz, status do canal de voz e créditos/licenças
das faixas locais.

> Uma instância privada ("MEGAzFM Private/Official") pode existir separadamente,
> reutilizando este pacote como dependência e adicionando recursos extras
> (por exemplo, suporte a lives do YouTube) que **não fazem parte** deste
> repositório público. Ver a seção "Open Source" abaixo.

## ✨ Features

- Reprodução de arquivos MP3 locais e de streams HTTP(S) diretos, como Icecast/Shoutcast. Streams do YouTube não são suportados no Core.
- Estações configuradas por pastas, com seleção da estação inicial e troca durante a execução.
- Reprodução automática ao conectar ao canal de voz, com modo shuffle e opção para evitar repetição imediata.
- Consulta da faixa atual, prévia das próximas músicas e histórico recente.
- Controles administrativos para pular faixas, ajustar volume, alternar shuffle, recarregar estações e reconectar à voz.
- Reconexão automática configurável e comando manual `/reconnect`.
- Exibição dos créditos/licença da faixa local no `/nowplaying`, quando informados em `playlist.json`.
- Tentativa de definir o Voice Channel Status como “Powered by MEGAzFM” (permissão específica opcional).
- Estado de espera quando não há conteúdo disponível; `/reload` reescaneia as estações após adicionar arquivos.
- Organizador gráfico opcional para MP3: copia e ordena faixas e gera `playlist.json`, `CREDITS.txt` e `ORGANIZER_REPORT.txt`.

O Core não possui comandos `/play` ou `/pause`: a reprodução começa pela estação configurada quando o bot inicia.

## Licença

Este projeto é distribuído sob a **MIT License**. Consulte [`LICENSE`](LICENSE)
para ver os termos completos. O arquivo jurídico é a referência em caso de
dúvida.

## Instalação

### Requisitos

- Node.js 18 ou superior; Node.js 20 LTS é recomendado.
- npm, incluído com o Node.js.
- Uma aplicação/bot no Discord e um servidor com um canal de voz.
- Python 3 com Tkinter apenas se for usar o organizador gráfico de músicas.

### Baixar e instalar dependências

```bash
git clone https://github.com/oNickyz/MEGAzFM-DCBot.git
cd MEGAzFM-DCBot
npm install
```

### Criar e configurar o bot no Discord

1. Crie uma aplicação em [Discord Developer Portal](https://discord.com/developers/applications) e adicione um bot.
2. Copie o token do bot e o Application ID. O token deve ficar somente no seu `.env`; nunca o publique.
3. Convide o bot ao servidor com os escopos `bot` e `applications.commands`. Conceda `Connect` e `Speak` no canal de voz. `Set Voice Channel Status` é opcional. Os comandos administrativos exigem que quem os execute tenha a permissão Administrator no servidor.
4. Ative o Modo Desenvolvedor no Discord para copiar o ID do canal de voz e, se desejar, o ID do servidor.

### Configurar ambiente e iniciar

Crie o arquivo `.env` a partir do exemplo (não substitua nem compartilhe o token real):

```powershell
Copy-Item .env.example .env
```

No macOS/Linux, use `cp .env.example .env`. Edite o `.env` local e preencha `DISCORD_TOKEN`, `CLIENT_ID` (Application ID) e `VOICE_CHANNEL_ID`. `GUILD_ID` é opcional: preenchido, registra os comandos naquele servidor; vazio, registra globalmente, o que pode levar até cerca de uma hora para propagar. Os outros parâmetros têm valores padrão documentados no `.env.example`.

O bot registra os comandos automaticamente ao iniciar. Execute:

```bash
npm start
```

Se precisar registrar os comandos manualmente, use `npm run deploy`.

O projeto usa `ffmpeg-static` e tenta utilizar o binário incluído. Se ele não puder ser executado no ambiente, instale FFmpeg no sistema e configure `FFMPEG_PATH` com o caminho para esse executável. No Discloud, o `discloud.config` já declara FFmpeg como pacote APT.

## Configuração (`.env`)

Veja `.env.example` para a lista completa e comentada de variáveis. As
principais:

- `BOT_NAME`: nome exibido pelo bot. Único lugar que precisa ser mudado.
- `DISCORD_TOKEN`, `CLIENT_ID` e `VOICE_CHANNEL_ID`: obrigatórios. `GUILD_ID` é opcional.
- `TEXT_CHANNEL_ID`: opcional, canal de texto tradicional para avisos (NÃO é
  o "chat" associado automaticamente a um canal de voz - a API do Discord
  não garante isso de forma simples, por isso usamos um canal de texto
  configurado explicitamente).
- `DEFAULT_STATION`, `STATIONS_PATH`, `SHUFFLE_ENABLED`, `AVOID_IMMEDIATE_REPEAT`,
  `VOLUME`, `AUTO_RECONNECT`, `FFMPEG_PATH`: comportamento da rádio.
- `PUBLIC_STATION_SWITCH_ENABLED` e as variáveis de cooldown: controlam se
  usuários comuns podem usar `/estacao` para trocar de estação.

## Estrutura de estações

Cada subpasta dentro de `stations/` é uma estação:

- **Estação local**: contém arquivos `.mp3` (qualquer nome). Músicas não-mp3
  são ignoradas. Uma pasta vazia fica marcada como "indisponível", mas não
  derruba o bot.
- **Estação de stream**: contém um arquivo chamado `stream.url` com a URL
  HTTP(S) do stream (ex: Icecast/Shoutcast) na primeira linha.

Uma estação local pode incluir `playlist.json` com metadados de cada faixa.
O campo `file` deve corresponder ao nome do MP3 dentro da pasta, e o campo
`license` é exibido no rodapé do `/nowplaying`. Sem metadados ou sem licença
informada, o comando mostra "Licença: não informada". `CREDITS.txt` é um
registro para consulta e não é interpretado pelo bot.

Nenhum arquivo MP3 real deve ser commitado no repositório (ver `.gitignore`).

## Organizador de músicas

Opcional. Requer Python 3 e Tkinter (em algumas distribuições Linux, Tkinter é instalado como pacote separado). Na raiz do repositório, execute:

```powershell
py tools/organize_music.py
```

Se `py` não estiver disponível, use `python tools/organize_music.py`.

Selecione a pasta de origem e informe o nome da estação, um artista de reserva
e os dados comuns de fonte/licença. O script procura MP3s recursivamente,
ordena os nomes naturalmente e copia os arquivos para `stations/<nome>` sem
alterar os originais. Aceita nomes no formato `Artista - Faixa`, remove
prefixos numéricos e extensões `.mp3` duplicadas, e cria nomes numerados.

São gerados `playlist.json`, `CREDITS.txt` e `ORGANIZER_REPORT.txt`. Uma pasta
de destino já existente e não vazia nunca é sobrescrita. A licença preenchida
no diálogo se aplica a todas as faixas daquela execução; se as licenças forem
diferentes, ajuste o campo `license` de cada faixa no JSON e mantenha os
créditos correspondentes. O organizador não verifica licenças: mantenha
"Não verificada" até confirmar os termos. Depois de adicionar ou alterar
arquivos/metadados, use `/reload` para reescanear as estações.

## Comandos

| Comando | Acesso | Descrição |
| --- | --- | --- |
| `/nowplaying` | Todos | Mostra estação, faixa, estado e licença informada para a faixa. |
| `/estacoes` | Todos | Lista as estações e sua disponibilidade. |
| `/fila` | Todos | Mostra uma previsão das próximas três faixas; não é uma fila garantida. |
| `/historico` | Todos | Mostra até as cinco últimas faixas reproduzidas. |
| `/estacao nome:<nome>` | Todos, se habilitado | Troca de estação com cooldown. Requer `PUBLIC_STATION_SWITCH_ENABLED=true`; administradores também podem usar o comando. |
| `/station nome:<nome>` | Administradores | Troca de estação sem o cooldown público. |
| `/skip` | Administradores | Pula a faixa atual. |
| `/reload` | Administradores | Recarrega a biblioteca de estações sem reiniciar o bot. |
| `/radio` | Administradores | Mostra o estado, a estação e a faixa atual. |
| `/volume valor:<número>` | Administradores | Ajusta o volume para um valor entre `0` e `2` (`1` é o volume normal). |
| `/shuffle ativo:<true\|false>` | Administradores | Ativa ou desativa a reprodução aleatória. |
| `/reconnect` | Administradores | Força uma tentativa de reconexão ao canal de voz. |
| `/addstream nome:<nome> url:<URL>` | Administradores | Cria ou atualiza uma estação de stream HTTP(S) direto. O nome aceita letras, números, `-` e `_`; URLs do YouTube são rejeitadas. |

Os comandos administrativos têm como permissão padrão Administrator do Discord. A troca pública por `/estacao` é desativada por padrão.

## Comportamento sem músicas

Se nenhuma estação tiver músicas/stream válido, o bot **continua online e
conectado** ao canal de voz, entra em estado de espera e loga:

```
[radio] nenhuma música disponível no momento
[radio] aguardando /reload ou novas músicas
```

Assim que arquivos forem adicionados, rode `/reload` para retomar a
reprodução automaticamente. O bot nunca encerra o processo por falta de
conteúdo.

## Diagnóstico: "logs normais, mas sem som"

Se o bot parece conectado mas nenhum áudio sai no canal, o problema
geralmente está na etapa UDP da conexão de voz do Discord (separada do
"gateway" que aparece como conectado). O bot tenta detectar isso e loga
avisos claros. Causas comuns: firewall/antivirus bloqueando UDP, VPN, NAT
restritivo, ou instabilidade regional nos servidores de voz do Discord
(tente mudar a "Região" do canal de voz manualmente como teste).

## Status do canal de voz

Ao conectar ao canal configurado em `VOICE_CHANNEL_ID`, o bot tenta definir
o status do canal como **Powered by MEGAzFM**. Para isso, conceda ao bot a
permissão `Set Voice Channel Status`, além de `Connect` e `Speak`. Se a
permissão de status estiver ausente ou a API recusar a alteração, a rádio
continua funcionando e o motivo é registrado no log.

## Deploy na Discloud

Este projeto inclui um `discloud.config` pronto. FFmpeg é incluso via
`ffmpeg-static`, então normalmente não é necessário instalar nada extra no
host.

## Open Source

O código-fonte deste pacote (**MEGAzFM Core**) é público e está hospedado
neste repositório GitHub. Qualquer pessoa pode:

- estudar o código;
- fazer fork do projeto;
- modificar e adaptar o código sob os termos da MIT License;
- hospedar sua própria instância da rádio.

O **MEGAzFM Core** é a versão Open Source publicada neste repositório e
distribuída sob a MIT License. A instância **MEGAzFM Private/Official** é
separada, pode ter recursos adicionais, experimentais ou integrações que não
fazem parte do Core e não são distribuídos aqui. A documentação deste
repositório descreve somente o Core.

Fork, modificação e redistribuição são permitidos pelos termos da MIT License
(ver [`LICENSE`](LICENSE)).

Consulte [`CONTRIBUTING.md`](CONTRIBUTING.md) para enviar contribuições ou
relatar problemas.

## Fork e auto-hospedagem

Sinta-se livre para fazer fork e hospedar sua própria rádio. Pontos de
atenção:
- Não commite arquivos `.mp3` reais nem tokens/segredos.
- Reveja `.env.example` e preencha um `.env` próprio (nunca versionado).
- O hook `_resolveStreamSource()` em `src/radio/player.js` pode ser
  estendido (por composição/subclasse) caso queira adicionar suporte a
  outras fontes de áudio, sem precisar modificar o restante do código.
