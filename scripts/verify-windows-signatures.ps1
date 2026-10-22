param(
  [Parameter(Mandatory)][string]$Directory,
  [Parameter(Mandatory)][string]$Publisher
)
$ErrorActionPreference = 'Stop'
$app = Join-Path $Directory 'win-unpacked/QueueCumber.exe'
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) { throw 'Packaged application executable is missing' }
$installers = @(Get-ChildItem -LiteralPath $Directory -Filter '*-setup.exe' -File)
if ($installers.Count -ne 1) { throw 'Expected exactly one Windows installer' }
foreach ($file in @($app, $installers[0].FullName)) {
  $signature = Get-AuthenticodeSignature -LiteralPath $file
  if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate -or -not $signature.TimeStamperCertificate) {
    throw "Missing, invalid or untimestamped signature: $([IO.Path]::GetFileName($file))"
  }
  $name = $signature.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  if ($name -cne $Publisher) { throw 'Signed publisher does not match the configured publisher' }
}
Write-Output 'Application and installer signatures are valid and timestamped.'
