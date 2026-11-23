@echo off
cd /d "%~dp0"
title Support IT - Helpdesk & Stock

echo ===============================================
echo   Demarrage de la plateforme IT Helpdesk...
echo   (NE FERME PAS cette fenetre pendant l'utilisation)
echo ===============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou introuvable dans le PATH.
    echo Telecharge et installe Node.js (version LTS^) sur : https://nodejs.org/
    echo Puis relance ce fichier.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installation des dependances (premiere execution, ~1 min)...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERREUR] L'installation des dependances a echoue.
        pause
        exit /b 1
    )
    echo.
)

if not exist "frontend\build\index.html" (
    echo Compilation de l'interface web...
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo [ERREUR] La compilation du frontend a echoue.
        pause
        exit /b 1
    )
    echo.
)

echo Demarrage du serveur sur http://localhost:3000 ...
echo Ouvre ton navigateur sur : http://localhost:3000
echo Appuie sur Ctrl+C ou ferme cette fenetre pour arreter.
echo.

node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Le serveur s'est arrete avec une erreur.
    pause
    exit /b 1
)
