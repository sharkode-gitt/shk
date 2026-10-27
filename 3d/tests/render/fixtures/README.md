Real tool output for the output-check tests, one set per case:

- `<case>.probe.json`: `ffprobe -show_streams -show_format -of json`
- `<case>.blackdetect.txt`: stderr of `ffmpeg -vf blackdetect=d=0.5:pix_th=0.10 -an -f null -`
- `<case>.loudness.txt`: stderr of `ffmpeg -vn -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -`

Cases: `good` (1080x1920, 30 s, -14 LUFS), `landscape` (1920x1080), `short` (15 s), `noaudio`,
`black` (0.8 s black at 12 s), `quiet` (-20 LUFS). Generated with ffmpeg 6.1 from `testsrc2` and a sine tone.
