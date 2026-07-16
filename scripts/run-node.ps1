param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $NodeArgument,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $NodeArguments
)

$ErrorActionPreference = "Stop"

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = $nodeCommand.Source

if (-not $nodePath) {
  $candidates = @(
    $env:CODEX_NODE_PATH,
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"),
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  $nodePath = $candidates | Select-Object -First 1
}

if (-not $nodePath) {
  throw "Node.js was not found on PATH or in the Codex bundled runtime. Set CODEX_NODE_PATH or install Node.js."
}

& $nodePath $NodeArgument @NodeArguments
exit $LASTEXITCODE
