# Adult synthetic audio bench only, not child-voice calibration.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$fixtureRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../artifacts/literacy-grade2-design/reading-repair-audio'))
[IO.Directory]::CreateDirectory($fixtureRoot) | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -2
$cases = @{
  accurate = 'Yesterday, Sam rode to the pond.'
  substitution = 'Yesterday, Sam ride to the pond.'
  synonym = 'The little duck swam away.'
  homophone = 'I red the red book.'
  incomplete = 'Yesterday Sam'
}
$generated = Get-Content -Raw -LiteralPath (Join-Path $fixtureRoot '../reading-repair-generation-1.json') | ConvertFrom-Json
$cases['generated-first'] = $generated.fullData.challenges[0].text
foreach ($case in $cases.GetEnumerator()) {
  $synth.SetOutputToWaveFile((Join-Path $fixtureRoot ($case.Key + '.wav')))
  if ($case.Key -eq 'generated-first') {
    $synth.SpeakSsml('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' + [Security.SecurityElement]::Escape($case.Value) + '<break time="2500ms"/></speak>')
  } else {
    $synth.Speak($case.Value)
  }
  $synth.SetOutputToNull()
}
$synth.Dispose()
Write-Output 'Wrote six adult synthetic WAV clips.'
