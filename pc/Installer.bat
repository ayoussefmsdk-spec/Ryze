@echo off
rem Cree le raccourci "Ryze" sur le Bureau (et dans le menu Demarrer) pointant vers Ryze.bat, avec l'icone.
setlocal
set "RACINE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dossier in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {" ^
  "  $s = $w.CreateShortcut((Join-Path $dossier 'Ryze.lnk'));" ^
  "  $s.TargetPath = '%RACINE%Ryze.bat';" ^
  "  $s.WorkingDirectory = '%RACINE%';" ^
  "  $s.IconLocation = '%RACINE%ryze.ico,0';" ^
  "  $s.Description = 'Ryze - Biotherapies, hopital de jour';" ^
  "  $s.WindowStyle = 7;" ^
  "  $s.Save();" ^
  "}"
if errorlevel 1 (
  echo Le raccourci n'a pas pu etre cree. Vous pouvez lancer Ryze en double-cliquant sur Ryze.bat.
) else (
  echo Raccourci "Ryze" cree sur le Bureau et dans le menu Demarrer.
)
echo.
echo Pour la premiere utilisation : lancez Ryze, puis Parametres ^> Importer un fichier pour charger votre base.
pause
endlocal
