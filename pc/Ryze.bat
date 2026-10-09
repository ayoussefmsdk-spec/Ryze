@echo off
rem Ryze - lancement en mode application (fenetre sans barre d'adresse), profil et donnees dans ce dossier.
setlocal
set "RACINE=%~dp0"
set "APP=%RACINE%app\index.html"
set "PROFIL=%RACINE%donnees"
if not exist "%PROFIL%" mkdir "%PROFIL%"
set "NAV="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if not defined NAV if exist %%P set "NAV=%%~P"
)
if not defined NAV (
  echo Ni Google Chrome ni Microsoft Edge n'ont ete trouves sur ce PC.
  echo Installez l'un des deux, puis relancez Ryze.
  pause
  exit /b 1
)
start "" "%NAV%" --app="file:///%APP:\=/%" --user-data-dir="%PROFIL%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --window-size=1280,860
endlocal
