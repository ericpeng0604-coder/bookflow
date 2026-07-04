param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ScriptPath,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$ErrorActionPreference = "Stop"

function Resolve-NodeExecutable {
  $pathNode = Get-Command node -ErrorAction SilentlyContinue
  if ($pathNode) {
    return $pathNode.Source
  }

  $bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path -LiteralPath $bundledNode) {
    return $bundledNode
  }

  throw "Node.js was not found on PATH, and the Codex bundled Node runtime was not found."
}

$node = Resolve-NodeExecutable
& $node $ScriptPath @ScriptArgs
exit $LASTEXITCODE
