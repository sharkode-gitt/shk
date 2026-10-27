# O que você precisa colocar (e o que eu faço por código)

Nada é obrigatório para a série funcionar: eu desenho a mochila e o presente por código, em blocos, no mesmo estilo dos cenários. Os itens abaixo só melhoram o resultado.

## 1. Objetos (recomendado)
| Objeto | Usado em | Onde aparece |
| --- | --- | --- |
| Mochila (backpack) | episódios 1, 2 e 3 | na mão do Lokii, depois na mão do Bacon |
| Presente (gift) | episódio 4 | na mão do Lokii |

Se quiser modelos seus, exporte do Studio igual aos personagens (`File -> Export Selection` em `.obj`) e coloque o `.obj`, o `.mtl` e as texturas em:

- `assets/props/backpack/`
- `assets/props/gift/`

Eu adapto o motor para carregar esses modelos quando chegarem. Se vierem da Toolbox do Roblox, confira a licença de cada item.

## 2. Vozes (preciso da sua decisão)
As vozes atuais são provisórias. Ouça e troque em `assets/voices.json`:
- **Emily** (narra todos os episódios): `exsUS4vynmxd379XN4yO` (a que você mandou).
- **Lokii**: hoje "Kallixis - Demon, Deep"; talvez seja assustadora demais para um personagem que é tímido e doce.
- **Bacon** e **Lexi**: provisórias.

## 3. Personalidade de cada personagem (rápido, 1 linha cada)
Edite `personality` em `assets/characters/<id>/character.json` para emily, lokii, bacon e lexi. Hoje estão como "friendly and curious".

## 4. Música (posso gerar, ou você manda)
| Clima | Episódios | Situação |
| --- | --- | --- |
| tense (misteriosa) | 1 | falta; posso gerar com a sua conta da ElevenLabs |
| funny (leve) | 2 e 3 | já existe uma faixa |
| sad (emocional) | 4 | falta; posso gerar |

Se preferir faixas suas: `.mp3` em `assets/music/<clima>/` e uma linha no `assets/LICENSES.md`.

## 5. Efeitos sonoros (opcional)
Já tenho 6 (whoosh, impacto, pop, brilho). Falta um suspiro/susto de desenho e um "ding" de notificação para o cartão de LIKE/SUBSCRIBE; posso pegar da biblioteca embutida ou você manda `.mp3`.

## 6. Rosto do Bacon (opcional)
O rosto desenhado por código ainda está desalinhado. Se tiver o PNG do rosto do Bacon (o decalque do Studio, quadrado), ponha em `assets/characters/bacon/face.png` e eu uso o original.

## O que eu faço por código (não precisa mandar nada)
Mochila e presente, cartões finais (LIKE, SUBSCRIBE, PART N e as opções A e B), cenário com mais textura e luz, caminhada melhor e o conserto do rosto do Bacon.
