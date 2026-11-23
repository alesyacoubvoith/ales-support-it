@echo off
cd /d "%~dp0"
title Support IT - Helpdesk ^& Stock

echo ===============================================
echo   Demarrage de la plateforme IT Helpdesk...
echo   Ne fermez pas cette fenetre pendant l'usage.
echo ===============================================
echo.

where node >nul 2>&1
if errorlevel 1 goto no_node

if not exist "node_modules\express\package.json" goto do_install
if exist "node_modules\vite\package.json" goto check_build
if exist "frontend\node_modules\vite\package.json" goto check_build

:do_install
echo Installation des dependances en cours, veuillez patienter...
call npm install --legacy-peer-deps
if errorlevel 1 goto install_error
echo.

:check_build
if exist "frontend\build\index.html" goto start_server
echo Compilation de l'interface web en cours...
call npm run build
if errorlevel 1 goto build_error
echo.

:start_server
echo Demarrage du serveur sur http://localhost:3000 ...
echo Ouvre ton navigateur sur : http://localhost:3000
echo Appuie sur Ctrl+C ou ferme cette fenetre pour arreter.
echo.

node server.js
if errorlevel 1 goto server_error
echo.
echo Le serveur s'est arrete.
pause
exit /b 0

:no_node
echo [ERREUR] Node.js n'est pas installe ou introuvable dans le PATH.
echo Telecharge et installe Node.js LTS sur : https://nodejs.org/
echo Puis redemarre Windows et relance ce fichier.
echo.
pause
exit /b 1

:install_error
echo.
echo [ERREUR] L'installation des dependances a echoue.
echo Verifie ta connexion Internet et que Node.js LTS est bien installe.
echo.
pause
exit /b 1

:build_error
echo.
echo [ERREUR] La compilation du frontend a echoue.
echo.
pause
exit /b 1

:server_error
echo.
echo [ERREUR] Le serveur s'est arrete avec une erreur.
echo.
pause
exit /b 1
