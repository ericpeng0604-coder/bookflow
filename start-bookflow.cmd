@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=C:\Users\ericp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_EXE%" (
  echo Node.js could not be found.
  echo Please install Node.js, then run: npm install
  echo After that, run: npm run dev
  pause
  exit /b 1
)

if not exist "node_modules\next\dist\bin\next" (
  echo Project packages are missing. Please ask Codex to install them.
  pause
  exit /b 1
)

echo Starting HUST BookFlow...
echo Keep this window open while using the website.
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$url='http://localhost:3000'; for($i=0;$i -lt 60;$i++){ try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if($response.StatusCode -eq 200){ Start-Process $url; exit } } catch {}; Start-Sleep -Seconds 1 }"
"%NODE_EXE%" "node_modules\next\dist\bin\next" dev -p 3000

endlocal
