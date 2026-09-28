# MEGAzFM — Radio Bot para Discord

Bot de Discord extremamente leve para funcionar como uma **radio 24/7** em um canal de voz,
tocando arquivos `.mp3` locais em loop, sem YouTube, sem yt-dlp, sem servicos externos.

Prioridade do projeto: **estabilidade > simplicidade > baixo consumo > funcionalidades extras.**

---

## Stack

- Node.js 18+
- discord.js v14
- @discordjs/voice
- FFmpeg (via `prism-media`, usando o binario de FFmpeg do sistema)

Nenhum banco de dados, cache pesado, Chromium/Puppeteer ou servico de musica externo e utilizado.

---

## 1. Pre-requisitos

- Node.js 18 ou superior instalado.
- Uma aplicacao Discord criada em https://discord.com/developers/applications com um Bot Token.
- **Nada de FFmpeg para instalar!** O bot ja empacota seu proprio binario de FFmpeg via
  `ffmpeg-static`, entao funciona direto em qualquer host (incluindo a Discloud), mesmo
  que o FFmpeg do sistema nao esteja instalado. Se por algum motivo voce preferir usar
  um FFmpeg especifico do seu sistema, defina `FFMPEG_PATH` no `.env` apontando para o
  binario — isso e totalmente opcional.

> **Sobre o encoder de audio (Opus):** este projeto usa `opusscript` por padrao —
> uma implementacao em JavaScript puro que **nao precisa compilar nada**, entao
> `npm install` funciona direto em qualquer maquina (Windows, Mac, Linux, Discloud),
> sem precisar de Python nem de ferramentas de compilacao C++ instaladas. Se voce
> quiser um pouco mais de performance de CPU e ja tem um ambiente com toolchain de
> compilacao (Python + Visual Studio Build Tools no Windows, ou build-essential no
> Linux), pode trocar por `@discordjs/opus` no `package.json` — e um binding nativo
> mais rapido, mas exige compilacao durante o `npm install`.

---

## 2. Instalacao local

```bash
npm install
cp .env.example .env
```

Edite o `.env` preenchendo pelo menos:

```env
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor        # recomendado em desenvolvimento (registro instantaneo de comandos)
VOICE_CHANNEL_ID=id_do_canal_de_voz
```

O `.env.example` documenta cada variavel com comentarios. Nenhuma variavel nova foi
adicionada alem das que ja existiam — as funcionalidades novas (volume, shuffle,
reconexao manual) usam os comandos slash diretamente e nao precisam de configuracao extra.

**Nunca commite o `.env`** — ele fica de fora do Git via `.gitignore`. Use sempre o
`.env.example` como referencia de quais variaveis existem e mantenha nele apenas
valores de exemplo, nunca tokens reais.

---

## 3. Estrutura das estacoes e adicionando musicas

Cada subpasta dentro de `stations/` e uma estacao independente, descoberta automaticamente:

```text
stations/
├── lofi/
│   ├── 001 - Snowfall.mp3
│   ├── 002 - Late Night.mp3
│   └── 003 - Rainy Window.mp3
└── chill/
    └── ...
```

O numero no inicio do nome do arquivo (`001 - `) e usado apenas para organizar os arquivos
no disco; ele e removido automaticamente ao exibir o nome da musica no Discord.

Regras:

- Arquivos que nao sejam `.mp3` sao ignorados automaticamente.
- Uma pasta sem nenhum `.mp3` e tratada como uma estacao vazia (nao fatal).
- Um arquivo `.mp3` corrompido nao interrompe a radio: o erro e registrado no console
  e a proxima faixa e tocada normalmente.

**Nao inclua musicas reais no repositorio Git.** O `.gitignore` ja ignora `stations/**/*.mp3`
para evitar que arquivos protegidos por direitos autorais sejam commitados por engano —
mantenha as pastas versionadas apenas com o `.gitkeep`, e envie os `.mp3` reais direto
para o servidor onde o bot vai rodar (upload manual, SCP, FTP, etc).

---

## 4. O que acontece quando nao ha nenhuma musica

Se o bot iniciar (ou um `/reload` for executado) e nenhuma estacao tiver arquivos `.mp3`:

- O bot **continua online** e **conectado ao canal de voz** normalmente.
- O processo **nao encerra** — nenhuma excecao derruba o bot por falta de musicas.
- Ele entra em um estado de espera, sem nenhum loop ou polling consumindo CPU:

```text
[radio] nenhuma musica disponivel no momento
[radio] aguardando /reload ou novas musicas
```

- Assim que voce adicionar arquivos `.mp3` e rodar `/reload`, a radio comeca a tocar
  sozinha automaticamente, sem precisar reiniciar o bot.

---

## 5. Comandos slash: registro automatico

**Voce nao precisa fazer nada** — o bot registra todos os comandos slash sozinho, toda
vez que inicia (`npm start`), usando o proprio ID da aplicacao (`client.user.id`), o que
evita erros de `CLIENT_ID` digitado errado no `.env`. Isso resolve o problema mais comum
de "os comandos nao aparecem no Discord": esquecer de rodar um passo de deploy separado.

- Se `GUILD_ID` estiver preenchido no `.env`, os comandos aparecem **instantaneamente**
  naquele servidor.
- Se `GUILD_ID` estiver vazio, os comandos sao registrados globalmente, o que **pode
  levar ate ~1 hora** para propagar em todos os servidores — para testar rapido durante
  o desenvolvimento, preencha `GUILD_ID` com o ID do seu servidor de testes.

Se voce preferir registrar manualmente (por exemplo, sem precisar reiniciar o bot todo),
ainda existe o comando:

```bash
npm run deploy
```

### Os comandos ainda nao apareceram? Checklist

1. **O bot esta rodando de verdade?** Confira os logs — deve aparecer
   `[deploy] N comandos registrados no servidor ...` (ou `globalmente`) logo apos
   `[discord] conectado como ...`. Se aparecer `[deploy] falha ao registrar comandos
   automaticamente: ...`, leia a mensagem de erro — geralmente e token invalido ou
   falta de permissao.
2. **O bot foi convidado com o escopo `applications.commands`?** No Discord Developer
   Portal, gere o link de convite em *OAuth2 → URL Generator* marcando **tanto** `bot`
   **quanto** `applications.commands`. Se o bot ja estava no servidor sem esse escopo,
   gere um novo link e convide de novo (nao precisa remover o bot antes).
3. **`GUILD_ID` esta correto e o bot esta nesse servidor?** Se estiver vazio, lembre-se
   que o registro global pode levar ate 1 hora.
4. **Recarregue o cliente do Discord** (Ctrl+R no app desktop/web, ou feche e abra o app
   mobile) — o cliente as vezes mantem a lista de comandos em cache por um tempo.
5. Se nada disso resolver, rode `npm run deploy` manualmente e leia a mensagem de erro
   com atencao — ela mostra exatamente o motivo retornado pela API do Discord.

---

## 6. Executando localmente

```bash
npm start
```

Ao iniciar, o bot automaticamente:

1. conecta ao Discord;
2. valida a configuracao do `.env`;
3. descobre as estacoes na pasta `stations/`;
4. valida a estacao padrao (`DEFAULT_STATION`) — se estiver vazia ou nao existir, cai
   para a primeira estacao disponivel; se nenhuma estiver disponivel, entra no estado
   de espera descrito acima;
5. entra no canal de voz configurado (`VOICE_CHANNEL_ID`);
6. comeca a tocar automaticamente, sem precisar de nenhum comando.

Se o bot cair e for reiniciado, ele volta sozinho para o canal e retoma a radio.

---

## 7. Comandos disponiveis

### Publicos (qualquer membro do servidor)

| Comando       | Descricao                                                          |
|---------------|---------------------------------------------------------------------|
| `/nowplaying` | Mostra a estacao e a musica tocando agora                          |
| `/estacoes`   | Lista as estacoes disponiveis e quantas musicas cada uma tem        |
| `/fila`       | Mostra uma previsao das proximas musicas (nao e uma fila garantida — veja nota abaixo) |
| `/historico`  | Mostra as ultimas musicas tocadas                                   |
| `/estacao`    | Troca a estacao — **desativado por padrao**, veja a secao 9         |

> **Sobre `/fila`:** a arquitetura da radio escolhe a proxima musica apenas quando a
> atual termina (evita manter varias faixas pre-carregadas em memoria). Por isso o
> `/fila` mostra uma **previsao** calculada com a mesma logica de selecao usada de
> verdade (incluindo o anti-repeticao do shuffle), mas sem reservar nem consumir essas
> escolhas — a musica que realmente toca em seguida e sempre decidida na hora.

### Administracao (requer permissao `Administrador` do Discord, validada no backend)

| Comando       | Descricao                                                    |
|---------------|-----------------------------------------------------------------|
| `/skip`       | Pula a musica atual                                             |
| `/station`    | Troca a estacao (com autocomplete das estacoes existentes)      |
| `/reload`     | Recarrega estacoes/musicas do disco sem reiniciar o bot          |
| `/radio`      | Mostra o estado geral da radio (canal, estacao, musica, estado) |
| `/volume`     | Define o volume (entre `0` e `2`, validado no backend)          |
| `/shuffle`    | Ativa/desativa a reproducao aleatoria                           |
| `/reconnect`  | Forca uma reconexao ao canal de voz (protegido contra reconexoes simultaneas) |

Todas as permissoes administrativas sao validadas no backend com
`PermissionFlagsBits.Administrator` — nunca apenas pelo cargo exibido no Discord, e
nunca confiando apenas na interface (um usuario nao consegue forcar acesso administrativo
manipulando os parametros do comando).

> **Sobre `/volume`:** o valor nao e persistido entre reinicializacoes (a arquitetura
> atual nao tem nenhum sistema de persistencia, e adicionar um so para isso contrariaria
> a prioridade de simplicidade do projeto). A cada reinicio, o volume volta para o valor
> definido em `VOLUME` no `.env`. Como a musica atual e reproduzida via streaming direto
> do FFmpeg (sem rastreamento de posicao de playback), aplicar um novo volume reinicia a
> faixa atual do comeco — as proximas faixas tocam normalmente do inicio, como sempre.

---

## 8. Adicionando novas estacoes

1. Crie uma nova pasta dentro de `stations/`, por exemplo `stations/synthwave/`.
2. Coloque os arquivos `.mp3` dentro dela.
3. Rode `/reload` no Discord (ou reinicie o bot).

O bot descobre a estacao automaticamente, sem precisar alterar nenhum codigo. Isso vale
tanto para pastas novas quanto para pastas removidas ou com musicas adicionadas/removidas.

---

## 9. Ativando a troca publica de estacao

Por padrao, apenas Administradores podem trocar de estacao. Para liberar `/estacao`
para todos os membros:

```env
PUBLIC_STATION_SWITCH_ENABLED=true
```

Ajuste os cooldowns conforme desejar:

```env
PUBLIC_STATION_USER_COOLDOWN_MS=300000     # 5 minutos por usuario
PUBLIC_STATION_GLOBAL_COOLDOWN_MS=60000    # 1 minuto entre trocas de qualquer membro
```

Como todos no canal ouvem a mesma transmissao, os dois cooldowns valem juntos: depois
que alguem troca a estacao, mais ninguem (nem o mesmo usuario) pode trocar de novo antes
do cooldown global passar, e quem trocou fica preso ao cooldown pessoal por mais tempo.

Administradores nao sofrem esses cooldowns (apenas um cooldown minimo anti-spam,
`ADMIN_STATION_COOLDOWN_MS`, so para evitar cliques acidentais repetidos).

Para anunciar trocas publicas no canal de texto configurado:

```env
ANNOUNCE_PUBLIC_STATION_CHANGE=true
TEXT_CHANNEL_ID=id_do_canal_de_texto
```

---

## 10. Sobre o canal de texto (`TEXT_CHANNEL_ID`)

`TEXT_CHANNEL_ID` e um **canal de texto tradicional do Discord**, configurado separadamente
do `VOICE_CHANNEL_ID` — o bot nao assume que um canal de voz automaticamente tem um chat
associado utilizavel da mesma forma que um canal de texto comum. Se voce quiser receber
avisos da radio, crie/escolha um canal de texto normal e coloque o ID dele em
`TEXT_CHANNEL_ID`.

Esse canal e usado apenas para mensagens pontuais e raras (radio iniciada, troca publica
de estacao se `ANNOUNCE_PUBLIC_STATION_CHANGE=true`) — nunca para logs por musica, o que
gerariam spam. Se o canal nao existir mais ou o bot nao tiver permissao para enviar
mensagens nele, o erro e apenas registrado no console (`[radio] nao foi possivel enviar
mensagem no canal de texto: ...`) e a radio continua tocando normalmente; o bot nao fica
tentando reenviar a mensagem repetidamente.

---

## 11. Deploy na Discloud

1. Preencha o `.env` com os valores de producao (nao suba o `.env` para o Git).
2. Ajuste `discloud.config` se necessario (nome, RAM etc.).
3. Compacte o projeto (sem `node_modules/` e sem `.env`) e faca upload na Discloud, ou
   use o CLI (secao abaixo).
4. Os comandos slash se registram sozinhos no primeiro `ready` do bot — nao e preciso
   nenhum passo extra (veja a secao 5).

### Como subir as musicas (`.mp3`) para a Discloud

A Discloud nao tem uma pasta "separada" de dados: **o zip que voce envia e o proprio
conteudo do bot**, entao os arquivos `.mp3` devem ir dentro da pasta `stations/` desse
mesmo zip. Se o seu log mostrou algo como `N musicas na estacao lofi` com `N` maior que
zero, o upload das musicas **ja funcionou** — o `.gitignore` deste projeto (que ignora
`stations/**/*.mp3`) so afeta o que vai para um repositorio Git/GitHub, **nao** afeta o
zip que voce compacta manualmente e envia para a Discloud.

Duas formas de enviar:

- **Painel (mais simples):** compacte a pasta inteira do projeto (incluindo
  `stations/*/*.mp3`, mas sem `node_modules/` e sem `.env`) em um `.zip` e envie pelo
  botao "Upload" no painel da Discloud.
- **CLI (melhor para atualizar so as musicas depois):** instale a CLI oficial
  (`npm i -g discloud-cli`, depois `discloud login`) e use:

  ```bash
  discloud commit <id-da-sua-app> stations/**
  ```

  Isso envia soh os arquivos dentro de `stations/` para dentro da aplicacao ja hospedada,
  sem precisar reenviar `node_modules/` nem recompactar o projeto inteiro toda vez que
  adicionar uma musica nova. Depois disso, rode `/reload` no Discord para a radio
  reconhecer as novas faixas. Veja a documentacao completa em https://docs.discloud.com

### "FFmpeg/avconv not found!" na Discloud

Isso acontecia porque a Discloud nao tem o FFmpeg instalado no sistema por padrao. **Ja
esta corrigido neste projeto**: o bot agora empacota seu proprio FFmpeg via
`ffmpeg-static` (uma dependencia do `npm install`), entao nao depende de nada instalado
no host. So garanta que rodou `npm install` (localmente, antes de zipar e enviar, ou
deixe a Discloud instalar as dependencias do `package.json` automaticamente durante o
deploy) para que a pasta `node_modules` contenha o `ffmpeg-static`. Se ainda assim
aparecer esse erro, confira nos logs se apareceu a linha
`[player] usando ffmpeg em: ...` — se em vez disso aparecer
`[player] ffmpeg-static indisponivel, tentando usar "ffmpeg"/"avconv" do PATH do
sistema`, o pacote nao baixou o binario corretamente (raro, mas pode acontecer em
plataformas incomuns); nesse caso defina `FFMPEG_PATH` no `.env` apontando para um
binario de FFmpeg que voce mesmo hospede junto do projeto.

### "Nos logs esta tudo normal, mas nao sai som nenhum no Discord"

A partir desta versao, o bot faz verificacoes extras justamente para esse cenario deixar
de ser silencioso — inclusive a causa mais dificil de detectar: a conexao "conectar" ao
canal usa WebSocket/TCP (por isso comandos e logs funcionam normalmente), mas o **audio
em si viaja por UDP**, numa etapa separada que pode travar sem gerar nenhum erro visivel.
Agora o bot espera explicitamente essa etapa (`Ready`) antes de considerar a conexao boa:

```text
[voice] conexao de voz pronta (Ready) — audio deve fluir normalmente
[voice] conectado ao canal
```

Se em vez disso aparecer:

```text
[voice] a conexao de voz NAO atingiu o estado "Ready" em 15s — ...
```

isso confirma que o problema e a etapa de UDP travando — normalmente trafego UDP
bloqueado/instavel na rede do host (menos comum na Discloud, que anuncia suporte
dedicado a bots de musica, mas pode acontecer por instabilidade pontual). Tente
`/reconnect` primeiro; se persistir, entre em contato com o suporte da Discloud
informando exatamente essa mensagem.

Tambem confira, na ordem:

1. **`[player] ffmpeg testado com sucesso: ...`** deve aparecer no startup. Se em vez
   disso aparecer `NAO executou`, veja a secao de FFmpeg acima.
2. **Permissao do canal de voz.** O bot precisa das permissoes **Conectar** e **Falar**
   no canal configurado em `VOICE_CHANNEL_ID`. Se estiverem faltando, o bot avisa sozinho:
   `[voice] o bot NAO tem permissao de Conectar e/ou Falar neste canal de voz ...`
3. **O bot esta com "Silenciar no servidor" (Server Mute) ativado?** Clique com o botao
   direito no bot na lista de membros do canal de voz e confira se ha um icone de
   microfone cortado. Isso bloqueia o audio sem gerar nenhum erro no console.
4. **Volume do bot no seu proprio cliente Discord.** Clique com o botao direito no bot
   na lista do canal e confira o controle de volume individual dele — pode estar em 0%
   so no seu cliente, sem afetar mais ninguem.
5. **Existe mais de uma instancia do bot rodando ao mesmo tempo?** Dois processos
   conectando com o mesmo token no mesmo canal fazem a sessao de voz "brigar" — um fica
   mudo enquanto o outro assume. Confirme que so ha um processo ativo (pare o app, espere
   alguns segundos, inicie de novo).
6. **Arquivo de musica vazio ou corrompido.** Se o ffmpeg nao gerar nenhum audio real
   para uma faixa especifica nos primeiros segundos, o bot avisa:
   ```text
   [player] nenhum byte de audio foi gerado para "arquivo.mp3" apos 3s — o arquivo pode estar vazio ou corrompido
   ```
7. **Um erro real do FFmpeg durante a musica.** O bot captura a saida de erro do proprio
   FFmpeg quando o processo encerra de forma inesperada durante uma faixa:
   ```text
   [player] processo ffmpeg encerrou com codigo N ao tocar "arquivo.mp3": <motivo>
   ```

---

## 12. Comportamento em producao

- O bot **nunca sai do canal** por estar sozinho — ele continua tocando como uma radio real.
- Se a conexao de voz cair, ele aguarda alguns segundos e reconecta automaticamente,
  sem criar conexoes duplicadas nem acumular listeners de eventos a cada tentativa.
- Se um arquivo `.mp3` estiver corrompido, o erro e registrado no console e a radio
  segue automaticamente para a proxima faixa, sem travar.
- Se a estacao atual ficar sem musicas (ou nenhuma estacao tiver musicas), isso e
  reportado no log e o bot entra no estado de espera descrito na secao 4 — nunca derruba
  o processo.
- Qualquer excecao inesperada (leitura de arquivo, FFmpeg, conexao de voz, comando slash)
  e capturada e registrada no console; o processo continua rodando.
- Os logs no console sao curtos e **nunca exibem token, secrets ou credenciais**.

---

## 13. Seguranca e checklist para deixar o projeto publico/open source

Antes de publicar o repositorio no GitHub:

- [ ] Confirme que `.env` esta no `.gitignore` (ja esta) e que ele nunca foi commitado
      antes (se ja foi, revogue o token no Discord Developer Portal e gere um novo).
- [ ] Confirme que `.env.example` contem apenas placeholders vazios, nunca valores reais.
- [ ] Confirme que nenhum arquivo `.mp3` real esta versionado (o `.gitignore` ja ignora
      `stations/**/*.mp3`, mas vale conferir com `git status` antes do primeiro commit).
- [ ] Revise o historico do Git (`git log`) caso o projeto ja tenha sido versionado antes
      desta auditoria, para garantir que nenhum token ficou em um commit antigo.
- [ ] Os logs do bot nunca imprimem o `DISCORD_TOKEN` nem qualquer outro secret — isso
      foi conferido em todos os arquivos deste projeto.

---

## Para quem for fazer fork e hospedar sua propria radio

1. Faça o fork/clone, rode `npm install` e configure seu proprio `.env` (nunca reutilize
   um token de outro bot).
2. Crie a estrutura `stations/<nome-da-estacao>/*.mp3` com suas proprias musicas — elas
   nunca sao versionadas no Git, entao cada instancia do bot mantem sua propria biblioteca
   local.
3. Ajuste `DEFAULT_STATION`, `VOICE_CHANNEL_ID` e `TEXT_CHANNEL_ID` para o seu servidor.
4. Rode `npm run deploy` para registrar os comandos slash na sua aplicacao Discord.
5. Se for hospedar 24/7, a Discloud (secao 11) e o caminho mais simples, mas qualquer
   VPS com Node.js 18+ e FFmpeg instalados funciona da mesma forma — nao ha nenhuma
   dependencia especifica de plataforma.

---

## Estrutura do projeto

```text
lofi-bot/
├── src/
│   ├── index.js              # ponto de entrada
│   ├── config.js             # leitura/validacao do .env
│   ├── deploy-commands.js    # registro manual dos slash commands (opcional)
│   ├── registerCommands.js   # logica compartilhada de registro (usada no startup e no deploy manual)
│   ├── radio/
│   │   ├── manager.js        # orquestra estacoes + playlist + player
│   │   ├── stationManager.js # descoberta das estacoes no disco
│   │   ├── playlist.js       # selecao aleatoria com historico curto + preview de fila
│   │   ├── player.js         # conexao de voz + FFmpeg + reconexao
│   │   └── cooldowns.js      # cooldowns da troca publica
│   ├── commands/
│   │   ├── nowplaying.js     # publico
│   │   ├── estacoes.js       # publico
│   │   ├── fila.js           # publico
│   │   ├── historico.js      # publico
│   │   ├── estacao.js        # publico (condicional) / admin
│   │   ├── skip.js           # admin
│   │   ├── station.js        # admin
│   │   ├── reload.js         # admin
│   │   ├── radio.js          # admin
│   │   ├── volume.js         # admin
│   │   ├── shuffle.js        # admin
│   │   └── reconnect.js      # admin
│   └── utils/
│       ├── logger.js
│       └── trackName.js
│
├── stations/
│   └── lofi/                 # coloque os .mp3 aqui (nao versionados)
│
├── .env.example
├── .gitignore
├── package.json
├── discloud.config
└── README.md
```
