# Formato do roteiro (JSON)

`stories/<slug>/bible.json`
```json
{"title":"...","narrator":"pt-BR-AntonioNeural","narratorId":"<ElevenLabs voice_id>",
 "characters":{"id":{"name":"Nome","skin":"#hex","hair":"#hex","hairStyle":"long|short|bun|bald|curly",
   "top":"#hex","top2":"#hex","pants":"#hex","outfit":"tee|jacket|dress|uniform|coat|turnout","hat":"helmet","badge":"8","mustache":false,
   "old":false,"glasses":false,"beard":false,"lashes":false,"lips":"#hex","build":1.0,
   "voiceId":"<ElevenLabs voice_id>","voice":"pt-BR-FranciscaNeural"}}}
```
- `voiceId` deve EXISTIR na conta/biblioteca ElevenLabs (liste: GET https://api.elevenlabs.io/v1/voices).
- `lashes:true` = visual feminino (cilios + labios cheios).
- Estilo flat (referencia): `outfit:"turnout"` + `hat:"helmet"` + `badge:"8"` = bombeiro (faixas refletivas, radio, capacete com numero). Cores sugeridas turnout: top e pants `#c9964f`.
- Nome do personagem (`tag` no cast) aparece e some sozinho apos ~3 s; ajuste com `tagFrames` (frames).

`stories/<slug>/ep<N>.json`
```json
{"story":"slug","ep":1,"title":"...","nextTitle":"Titulo [destacado] da parte 2","ambient":"dark",
 "choice":{"prompt":"Qual caminho?","a":"Ir com a mae","b":"Ir com o pai"},   // SO no ep 4 (substitui nextTitle)
 "scenes":[{ "bg":"carro","title":"A [ESTRADA] SEM FIM","cam":"drift","trans":"blur","amb":"car",
   "fx":["fog","dust","flicker"],"note":"SEXTA\n13 · [1998]","plate":"142",
   "cast":[{"id":"marina","pos":"left|center|right","mood":"neutral|angry|sad|scared|happy",
            "pose":"stand|lying|bust","prop":"axe","tag":"MARINA · 30"}],
   "beats":[{"who":"narr|<id>","t":"Texto com [destaque] ate 14 palavras.","anim":"slide",
             "kinetic":"TOC TOC","sfx":"knock"}]}]}
```
- `[colchetes]` = palavra em cor de destaque (legenda, titulo, bilhete).
- bg: `carro` (usar pose "bust" nos 2 personagens) `estrada` `posto` `loja` `porta` `sala` `corredor`; outro id = cenario generico colorido.
- cam: drift(padrao) none zoom_in zoom_out pan_l pan_r shake
- trans (entrada da cena): blur(padrao) fade whip dip flash. Primeira cena usa fade.
- fx: fog fog2 dust flicker. amb: car wind store dark.
- anim da legenda: slide(padrao) pop type shake glitch wave. Use shake/glitch em falas assustadoras.
- sfx (por fala): knock buzz boom impact heartbeat glitch stinger static creak ding whoosh swish swell. Objeto: {"name":"creak","at":0.5,"vol":0.6}
- Cenas novas de cenario: adicionar em src/lib/Scenery.tsx (switch em `Scenery`) com camadas `back`/`front`.
- Personagens ficam em pos left/center/right (x=270/540/810). 2 personagens por cena e o ideal.
