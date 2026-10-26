@echo off
rem ==========================================================================
rem  HDJ - installation sur ce PC. A lancer une fois, depuis le dossier HDJ
rem  deja copie sur le disque (par exemple C:\HDJ) :
rem   - raccourci "HDJ" (icone hdj.ico) sur le Bureau et dans le menu Demarrer,
rem     cible HDJ.bat, dossier de travail = ce dossier ;
rem   - fichiers du paquet debloques (zip telecharge : avertissement Windows) ;
rem   - emplacement de ce dossier note dans LocalAppData\HDJ\chemin.txt
rem     (lu par Mettre-a-jour.bat).
rem  Aucun droit administrateur n'est necessaire. Relancer ce fichier apres
rem  avoir deplace le dossier HDJ suffit a refaire les raccourcis.
rem ==========================================================================
setlocal
title HDJ - installation
set "HDJ_RACINE=%~dp0"
if "%HDJ_RACINE:~-1%"=="\" set "HDJ_RACINE=%HDJ_RACINE:~0,-1%"
if not exist "%HDJ_RACINE%\HDJ.bat" goto incomplet
if not exist "%HDJ_RACINE%\hdj.ico" goto incomplet
if not exist "%HDJ_RACINE%\app\index.html" goto incomplet

rem --- le dossier doit etre sur le disque du PC : pas une cle USB, pas le reseau,
rem     pas OneDrive (la base, ecrite en continu, y serait synchronisee), pas
rem     Telechargements ni le dossier temporaire (zip ouvert sans extraction).
rem     PowerShell restreint ou en erreur : pas d'avertissement ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if ($env:HDJ_RACINE -like '*\OneDrive*') { exit 4 }; if ($env:HDJ_RACINE -like '\\*' -or $env:HDJ_RACINE -like '*\Downloads\*' -or $env:HDJ_RACINE -like '*\AppData\Local\Temp\*') { exit 3 }; if (([IO.DriveInfo]([IO.Path]::GetPathRoot($env:HDJ_RACINE))).DriveType -eq 'Fixed') { exit 0 } else { exit 3 } } catch { exit 0 }" 2>nul
if errorlevel 5 goto creer
if errorlevel 4 goto onedrive
if not errorlevel 3 goto creer
echo.
echo  ATTENTION : ce dossier HDJ n'est pas au bon endroit (Telechargements,
echo  cle USB, lecteur reseau ou CD) : la base y serait enregistree.
goto conseil
:onedrive
echo.
echo  ATTENTION : ce dossier HDJ est dans OneDrive (synchronise par Internet) :
echo  la base, ecrite en continu, y serait synchronisee, avec un risque de conflits.
:conseil
echo  Conseil : copiez d'abord le dossier HDJ dans C:\HDJ, puis lancez
echo  Installer.bat depuis cette copie.
echo.
choice /c ON /n /m " Installer quand meme ici ? (O = oui, N = non) "
if errorlevel 2 goto fin

:creer
echo.
echo  Creation de l'icone HDJ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$r = $env:HDJ_RACINE;" ^
  "try { Get-ChildItem -LiteralPath $r -File | Unblock-File; Get-ChildItem -LiteralPath (Join-Path $r 'app') -Recurse -File | Unblock-File } catch { };" ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {" ^
  "  $s = $w.CreateShortcut((Join-Path $d 'HDJ.lnk'));" ^
  "  $s.TargetPath = (Join-Path $r 'HDJ.bat');" ^
  "  $s.WorkingDirectory = $r;" ^
  "  $s.IconLocation = (Join-Path $r 'hdj.ico') + ',0';" ^
  "  $s.Description = 'HDJ - Hopital de jour, biotherapies';" ^
  "  $s.WindowStyle = 7;" ^
  "  $s.Save();" ^
  "}"
if errorlevel 1 goto echec

rem --- emplacement note pour Mettre-a-jour.bat ---
set "MEMO=%LocalAppData%\HDJ\chemin.txt"
if not exist "%LocalAppData%\HDJ" mkdir "%LocalAppData%\HDJ"
setlocal EnableDelayedExpansion
> "%MEMO%" echo(!HDJ_RACINE!
endlocal

echo.
echo  Installation terminee.
echo    - Icone "HDJ" creee sur le Bureau et dans le menu Demarrer.
echo    - Dossier HDJ : "%HDJ_RACINE%"
echo    - La base sera enregistree dans "%HDJ_RACINE%\donnees" : ne jamais le supprimer.
echo.
echo  Premiere ouverture : double-cliquez sur l'icone HDJ du Bureau. L'ecran de
echo  connexion s'affiche ; voir LISEZMOI.txt (etapes 4 et 5) pour la suite :
echo  codes d'acces, telephones, chef de service, sauvegarde automatique.
goto fin

:echec
echo.
echo  Le raccourci n'a pas pu etre cree. Vous pouvez lancer HDJ en double-cliquant
echo  sur HDJ.bat dans ce dossier, ou creer le raccourci a la main : clic droit
echo  sur HDJ.bat (Windows 11 : Afficher d'autres options), Envoyer vers,
echo  Bureau (creer un raccourci) ; puis clic droit sur le raccourci,
echo  Proprietes, Changer d'icone, Parcourir, choisir hdj.ico.
goto fin

:incomplet
echo.
echo  Dossier HDJ incomplet : HDJ.bat, hdj.ico et le dossier app doivent se
echo  trouver a cote de Installer.bat. Si vous etes dans le fichier zip,
echo  decompressez-le d'abord (clic droit, Extraire tout), copiez le dossier HDJ
echo  sur le disque du PC (par exemple C:\HDJ), puis relancez Installer.bat
echo  depuis ce dossier.

:fin
echo.
pause
endlocal
