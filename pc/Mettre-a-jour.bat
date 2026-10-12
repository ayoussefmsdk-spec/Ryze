@echo off
rem ==========================================================================
rem  HDJ - mise a jour de l'application.
rem  A lancer depuis le NOUVEAU paquet HDJ decompresse (par exemple sur une
rem  cle USB) : remplace le dossier "app" du HDJ installe sur ce PC par celui
rem  de ce paquet, apres avoir garde l'ancien sous le nom app-ancien-AAAAMMJJ.
rem  Le dossier "donnees" (la base) n'est JAMAIS modifie, ni deplace.
rem  Aucun droit administrateur n'est necessaire.
rem ==========================================================================
setlocal
title HDJ - mise a jour
set "NOUVEAU=%~dp0"
if "%NOUVEAU:~-1%"=="\" set "NOUVEAU=%NOUVEAU:~0,-1%"
if not exist "%NOUVEAU%\app\index.html" goto paquetincomplet

echo.
echo  HDJ - mise a jour de l'application
echo  ==================================
echo  Nouvelle version : "%NOUVEAU%\app"
echo.

rem --- 1. dossier HDJ installe : note par Installer.bat, sinon demande ---
set "MEMO=%LocalAppData%\HDJ\chemin.txt"
set "CIBLE="
if exist "%MEMO%" set /p CIBLE=<"%MEMO%"
if not defined CIBLE goto demander
if not exist "%CIBLE%\app\index.html" goto demander
echo  Dossier HDJ installe sur ce PC (note par Installer.bat) :
echo    "%CIBLE%"
choice /c ON /n /m " Est-ce le bon dossier ? (O = oui, N = non) "
if errorlevel 2 goto demander
goto verifier

:demander
echo.
echo  Indiquez le dossier HDJ installe sur ce PC : celui qui contient HDJ.bat,
echo  le dossier app et le dossier donnees (par exemple C:\HDJ).
echo  Astuce : faites glisser ce dossier dans cette fenetre, puis appuyez sur Entree.
echo  Laisser vide et appuyer sur Entree pour annuler.
set "CIBLE="
set /p "CIBLE= Dossier HDJ : "
if not defined CIBLE goto annule
set "CIBLE=%CIBLE:"=%"
if not defined CIBLE goto annule
if "%CIBLE:~-1%"=="\" set "CIBLE=%CIBLE:~0,-1%"
if exist "%CIBLE%\app\index.html" goto verifier
echo.
echo  Ce dossier ne contient pas d'application HDJ (pas de app\index.html) :
echo    "%CIBLE%"
goto demander

:verifier
if /i "%CIBLE%"=="%NOUVEAU%" goto memedossier
echo.
echo  Fermez HDJ (la fenetre de l'application) s'il est ouvert,
echo  puis appuyez sur une touche pour lancer la mise a jour.
pause >nul

rem --- 2. noms : copie de sauvegarde app-ancien-AAAAMMJJ (jamais ecrasee) ---
set "JOUR="
for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd" 2^>nul') do set "JOUR=%%D"
if not defined JOUR set "JOUR=precedent"
set "ANCIEN=app-ancien-%JOUR%"
set "N=1"
:nomlibre
if not exist "%CIBLE%\%ANCIEN%" goto nomok
set /a N+=1
set "ANCIEN=app-ancien-%JOUR%-%N%"
goto nomlibre
:nomok
set "ENCOURS=app-nouveau-en-cours"
if exist "%CIBLE%\%ENCOURS%" rd /s /q "%CIBLE%\%ENCOURS%"

rem --- 3. copie du nouveau dossier app a cote de l'ancien (rien n'est encore remplace) ---
echo.
echo  1/3  Copie de la nouvelle application...
robocopy "%NOUVEAU%\app" "%CIBLE%\%ENCOURS%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto echeccopie
if not exist "%CIBLE%\%ENCOURS%\index.html" goto echeccopie

rem --- 4. ancien app -> app-ancien-AAAAMMJJ, puis nouveau -> app ---
echo  2/3  Copie de sauvegarde de l'ancienne application : %ANCIEN%
ren "%CIBLE%\app" "%ANCIEN%"
if exist "%CIBLE%\app" goto echecrenommage
if not exist "%CIBLE%\%ANCIEN%\index.html" goto echecrenommage
echo  3/3  Mise en place de la nouvelle application...
ren "%CIBLE%\%ENCOURS%" "app"
if not exist "%CIBLE%\app\index.html" goto retablir

rem --- emplacement note pour la prochaine fois ---
if not exist "%LocalAppData%\HDJ" mkdir "%LocalAppData%\HDJ"
setlocal EnableDelayedExpansion
> "%MEMO%" echo(!CIBLE!
endlocal

echo.
echo  Mise a jour terminee :
echo    - nouvelle application : "%CIBLE%\app"
echo    - ancienne application : "%CIBLE%\%ANCIEN%"
echo      (copie de sauvegarde ; a supprimer dans quelques jours si tout va bien)
echo    - donnees              : "%CIBLE%\donnees" (non modifiees)
echo.
echo  Relancez HDJ depuis l'icone du Bureau et verifiez vos patients.
echo  Pour revenir a la version precedente : HDJ ferme, supprimer le dossier app,
echo  puis renommer %ANCIEN% en app.
goto fin

:retablir
ren "%CIBLE%\%ANCIEN%" "app"
if exist "%CIBLE%\%ENCOURS%" rd /s /q "%CIBLE%\%ENCOURS%"
echo.
echo  ECHEC : la nouvelle application n'a pas pu etre mise en place.
echo  L'ancienne application a ete remise en place ; les donnees n'ont pas ete touchees.
echo  Fermez HDJ et relancez Mettre-a-jour.bat.
goto fin

:echecrenommage
if exist "%CIBLE%\%ENCOURS%" rd /s /q "%CIBLE%\%ENCOURS%"
echo.
echo  ECHEC : l'ancien dossier app n'a pas pu etre renomme : HDJ est peut-etre
echo  encore ouvert. Rien n'a ete modifie. Fermez HDJ et relancez Mettre-a-jour.bat.
goto fin

:echeccopie
if exist "%CIBLE%\%ENCOURS%" rd /s /q "%CIBLE%\%ENCOURS%"
echo.
echo  ECHEC : la copie de la nouvelle application a echoue : disque plein ou
echo  cle retiree ? Rien n'a ete modifie dans "%CIBLE%".
goto fin

:memedossier
echo.
echo  Ce Mettre-a-jour.bat est celui du dossier installe lui-meme. Lancez celui
echo  du NOUVEAU paquet HDJ (decompresse sur la cle USB, par exemple).
goto fin

:paquetincomplet
echo.
echo  Paquet incomplet : le dossier app doit se trouver a cote de Mettre-a-jour.bat.
echo  Si vous etes dans le fichier zip, decompressez-le d'abord : clic droit,
echo  Extraire tout ; puis relancez Mettre-a-jour.bat depuis le dossier obtenu.
goto fin

:annule
echo.
echo  Mise a jour annulee : rien n'a ete modifie.

:fin
echo.
pause
endlocal
