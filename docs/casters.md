# transmitir do obs studio (e outras ferramentas whip)

guia para casters / streamers que querem usar o aevia.video como destino de transmissão ao vivo via obs studio (ou qualquer ferramenta compatível com whip — ffmpeg, gstreamer, larix broadcaster mobile, etc.) em vez do estúdio web embutido.

## o que você precisa

- conta no aevia.video com pelo menos uma transmissão criada
- obs studio versão **30 ou superior** (whip foi adicionado nessa versão)
- conexão de upload estável: 5 mbps recomendados para 1080p60, 3 mbps para 1080p30, 2.5 mbps para 720p60

## passo-a-passo

### 1. criar a transmissão e gerar o token

1. abra https://aevia.video/dashboard
2. crie uma nova transmissão (ou use uma existente)
3. na linha da transmissão, clique no ícone de **monitor** (`tv2`) à direita
4. o painel "configurar obs studio" abre com:
   - **server**: a url whip que o obs vai usar
   - **bearer token**: a credencial de autorização (válida por 30 minutos)
5. mantenha o painel aberto — você vai copiar os dois valores no obs

> o token é **scopeado** para essa transmissão específica e essa role (publisher). um token gerado aqui não pode ser usado para publicar em outra live, e não dá acesso a leitura, edição ou exclusão.

### 2. configurar o obs

1. abra o obs studio
2. vá em **configurações → transmissão**
3. ajuste:
   - **serviço**: `whip`
   - **servidor**: cole o valor de **server** do painel aevia
   - **token bearer**: cole o valor de **bearer token** do painel aevia
4. clique em ok

### 3. ajustar bitrate / encoder

vá em **configurações → saída → modo: avançado → streaming** e use uma das colunas abaixo conforme sua banda de upload e perfil:

| perfil | resolução | fps | bitrate (kbps) | keyframe interval | encoder sugerido |
|---|---|---|---|---|---|
| 1080p60 esports | 1920x1080 | 60 | 4500 | 2 s | nvenc h264 (gpu nvidia) / x264 medium (cpu) / videotoolbox (mac) |
| 1080p30 padrão | 1920x1080 | 30 | 3000 | 2 s | mesmo acima |
| 720p60 móvel | 1280x720 | 60 | 2500 | 2 s | mesmo acima |
| 720p30 fallback | 1280x720 | 30 | 1500 | 2 s | mesmo acima |

dicas:

- **keyframe interval = 2 segundos** é o que o cloudflare stream espera. valores diferentes podem causar buffering ou recusa do segmento.
- **bitrate constante (cbr)** é o padrão recomendado. variable bitrate (vbr) funciona mas o pico pode estourar a banda em redes 4g/cgnat.
- **profile h264 = high**, level = 4.1 (1080p60) ou 4.0 (1080p30 / 720p60).
- **pré-set x264**: `medium` em cpu razoável (i5+); `fast` em laptop/cpu fraca; nunca use `slower` ou abaixo a menos que tenha threadripper.

### 4. iniciar transmissão

1. selecione suas cenas / fontes no obs
2. clique em **iniciar transmissão**
3. abra `https://aevia.video/live/<id-da-sua-transmissão>` em outra janela para confirmar que o vídeo chegou

a primeira frame costuma aparecer em 1-2 segundos do clique em "iniciar transmissão". se demorar mais que 5 segundos, ver troubleshooting abaixo.

## rotação / segurança do token

- o token expira **automaticamente em 30 minutos** após ser gerado.
- se você precisar trocar de máquina ou suspeitar que o token vazou, clique em **gerar novo** no painel — um novo token é mintado.
- **importante:** atualmente, o token antigo continua valendo até a expiração de 30 minutos. revogação imediata está no roadmap (ver `OPPORTUNITY.md` §1.2). se você precisar invalidar imediatamente um token suspeito, contate suporte para forçar rotação no servidor.
- **não compartilhe o token** — quem tiver o token pode publicar na sua live durante a janela de 30 minutos.

## troubleshooting

| sintoma | causa provável | solução |
|---|---|---|
| obs mostra "401 unauthorized" | token expirou ou foi copiado errado | clique em "gerar novo" no painel e refaça os passos 2 |
| obs mostra "403 forbidden" | token foi gerado para outra transmissão | confirme que você está olhando o painel da live correta |
| obs mostra "404 not found" | a live foi apagada ou o uid mudou | crie uma nova transmissão |
| video não aparece em /live/&lt;id&gt; | encoder cpu sobrecarregado dropando frames | baixe a resolução / bitrate, ou troque para nvenc/videotoolbox |
| upload congela em redes 4g | uplink móvel saturado | baixe para 720p30 a 1500 kbps; o cliente web tem fallback turn que o obs não tem |
| "whip is not supported" no obs | versão obs &lt; 30 | atualize obs em https://obsproject.com |

## limitações conhecidas (versão atual)

- **revogação imediata de token** ainda não está disponível — apenas expiração por ttl de 30 minutos. mitigação: ttl curto + canal manual de suporte.
- **rate limit** ainda não aplicado por endereço de origem. uso abusivo de geração de token pode ser monitorado no dashboard sentry.
- **mobile broadcasting via whip nativo** (sem obs) está no roadmap como ferramenta separada.

## perguntas frequentes

**posso usar ffmpeg em vez do obs?**

sim. exemplo (ajuste seu device source `:0`):

```bash
ffmpeg -re -f avfoundation -i "0:0" \
  -c:v libx264 -preset veryfast -tune zerolatency -profile:v high \
  -b:v 4500k -maxrate 4500k -bufsize 9000k -g 120 -keyint_min 120 \
  -c:a aac -b:a 128k -ar 48000 \
  -f whip -authorization "Bearer <seu-token>" \
  "https://aevia.video/api/lives/<id>/whip"
```

**a transmissão é gravada automaticamente?**

sim. quando você encerra a transmissão (parar transmissão no obs), o cloudflare stream finaliza a gravação em ~30 segundos e o vod aparece na linha da transmissão no dashboard.

**posso transmitir de mobile?**

obs studio não tem versão mobile, mas apps compatíveis com whip funcionam — testamos **larix broadcaster** (ios + android, gratuito). configurações idênticas: server + bearer token. para android também há o **streamlabs mobile** com whip a partir da v3.0.
