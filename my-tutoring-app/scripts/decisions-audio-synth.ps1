# Synthesizes the learner clips for decisions-audio-bench.mjs from jobs.json (Windows SAPI, adult voices).
param([string]$dir)
Add-Type -AssemblyName System.Speech
$jobs = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'jobs.json') | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($j in $jobs) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($j.voice); $s.Rate = -2
  $s.SetOutputToWaveFile((Join-Path $dir $j.file), $fmt)
  if ($j.ups) { $s.SpeakSsml("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><phoneme alphabet='x-microsoft-ups' ph='$($j.ups)'>x</phoneme></speak>") }
  else { $s.Speak($j.text) }
  $s.Dispose()
}
