@echo off
rem ==========================================================================
rem  HDJ - Hopital de jour, biotherapies (CHU Ibn Rochd, Casablanca)
rem  Ouvre l'application dans sa propre fenetre : moteur de Microsoft Edge ou
rem  de Google Chrome en mode application (--app), sans barre d'adresse et
rem  sans Internet. Le profil du navigateur, donc toute la base, est dans le
rem  dossier "donnees" a cote de ce fichier : ne jamais le supprimer.
rem  Aucun droit administrateur n'est necessaire.
rem ==========================================================================
setlocal
set "RACINE=%~dp0"
set "APP=%RACINE%app\index.html"
set "PROFIL=%RACINE%donnees"

if not exist "%APP%" (
  set "HDJ_MSG=Fichier introuvable : app\index.html. Le dossier app doit se trouver a cote de HDJ.bat. Si vous etes dans le fichier zip, decompressez-le d'abord (clic droit, Extraire tout), puis copiez le dossier HDJ complet sur le disque du PC."
  call :message
  exit /b 1
)
if not exist "%PROFIL%" mkdir "%PROFIL%"
if not exist "%PROFIL%" (
  set "HDJ_MSG=Impossible de creer le dossier donnees a cote de HDJ.bat. Copiez le dossier HDJ sur le disque du PC, par exemple dans C:\HDJ, puis relancez Installer.bat depuis la copie."
  call :message
  exit /b 1
)

rem --- navigateurs presents (Edge est fourni avec Windows 10 et 11) ---
set "EDGE="
for %%P in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%LocalAppData%\Microsoft\Edge\Application\msedge.exe") do if not defined EDGE if exist "%%~P" set "EDGE=%%~P"
set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if not defined CHROME if exist "%%~P" set "CHROME=%%~P"

rem --- les donnees sont liees au navigateur : on reprend celui deja utilise
rem     avec ce dossier "donnees" (note dans navigateur.txt), sinon Edge, sinon Chrome ---
set "AVANT="
if exist "%PROFIL%\navigateur.txt" set /p AVANT=<"%PROFIL%\navigateur.txt"
set "NOM="
if /i "%AVANT%"=="edge" if defined EDGE set "NOM=edge"
if /i "%AVANT%"=="chrome" if defined CHROME set "NOM=chrome"
if not defined NOM if defined EDGE set "NOM=edge"
if not defined NOM if defined CHROME set "NOM=chrome"
if not defined NOM (
  set "HDJ_MSG=Ni Microsoft Edge ni Google Chrome n'ont ete trouves sur ce PC. Installez l'un des deux (Edge est normalement fourni avec Windows), puis relancez HDJ."
  call :message
  exit /b 1
)
if defined AVANT if /i not "%AVANT%"=="%NOM%" (
  set "HDJ_MSG=Attention : HDJ etait utilise jusqu'ici avec un autre navigateur (%AVANT%), introuvable sur ce PC. HDJ va s'ouvrir avec %NOM%. Si la base apparait vide, reinstallez %AVANT%, ou importez la derniere sauvegarde (Parametres, Importer un fichier)."
  call :message
)
if "%NOM%"=="edge" (set "NAV=%EDGE%") else set "NAV=%CHROME%"
> "%PROFIL%\navigateur.txt" echo %NOM%

start "" "%NAV%" --app="file:///%APP:\=/%" --user-data-dir="%PROFIL%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --window-size=1280,860
endlocal
exit /b 0

:message
rem Affiche HDJ_MSG dans cette fenetre et dans une boite de dialogue (visible meme
rem quand la fenetre est reduite, comme avec l'icone du Bureau) ; sinon : pause.
setlocal EnableDelayedExpansion
echo.
echo(!HDJ_MSG!
echo.
endlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "$null = (New-Object -ComObject WScript.Shell).Popup($env:HDJ_MSG, 0, 'HDJ', 48)" 2>nul
if errorlevel 1 pause
exit /b 0
