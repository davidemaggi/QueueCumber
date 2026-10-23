param(
  [Parameter(Mandatory)][string]$Directory,
  [Parameter(Mandatory)][string]$Publisher
)
$ErrorActionPreference = 'Stop'
$app = Join-Path $Directory 'win-unpacked/QueueCumber.exe'
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) { throw 'Packaged application executable is missing' }
$installers = @(Get-ChildItem -LiteralPath $Directory -Filter '*-setup.exe' -File)
if ($installers.Count -ne 1) { throw 'Expected exactly one Windows installer' }
$archives = @(Get-ChildItem -LiteralPath $Directory -Filter '*-signed.zip' -File)
if ($archives.Count -ne 1) { throw 'Expected exactly one signed Windows ZIP' }
foreach ($file in @($app, $installers[0].FullName)) {
  $signature = Get-AuthenticodeSignature -LiteralPath $file
  if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate -or -not $signature.TimeStamperCertificate) {
    throw "Missing, invalid or untimestamped signature: $([IO.Path]::GetFileName($file))"
  }
  $name = $signature.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  if ($name -cne $Publisher) { throw 'Signed publisher does not match the configured publisher' }
}
$extract = Join-Path ([IO.Path]::GetTempPath()) ('queuecumber-signature-' + [Guid]::NewGuid().ToString('N'))
try {
  Expand-Archive -LiteralPath $archives[0].FullName -DestinationPath $extract
  $archivedApp = Join-Path $extract 'QueueCumber.exe'
  if (-not (Test-Path -LiteralPath $archivedApp -PathType Leaf) -or
      (Get-FileHash -LiteralPath $archivedApp -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $app -Algorithm SHA256).Hash) {
    throw 'Signed ZIP does not contain the verified application executable'
  }
} finally {
  if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
}
Write-Output 'Application and installer signatures are valid and timestamped; ZIP carries the verified application.'
