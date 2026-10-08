@echo off
setlocal
chcp 65001 >nul

rem Установка плагина в глобальный каталог OpenCode:
rem   %USERPROFILE%\.config\opencode\plugins\models-disabler\
rem Это каталог глобальных плагинов OpenCode V2.
rem Если у тебя задан XDG_CONFIG_HOME, поправь CONFIG_DIR ниже.

set "SRC=%~dp0plugin"
set "CONFIG_DIR=%USERPROFILE%\.config\opencode"
set "DST=%CONFIG_DIR%\plugins\models-disabler"

if not exist "%SRC%\index.js" (
  echo [ERROR] Не найден "%SRC%\index.js". Запусти install.bat из корня репозитория.
  pause
  exit /b 1
)

if not exist "%DST%" mkdir "%DST%"

xcopy "%SRC%\index.js" "%DST%\" /Y >nul
xcopy "%SRC%\package.json" "%DST%\" /Y >nul

echo [OK] Плагин установлен в: %DST%
echo.
echo ВАЖНО: блоки "disabled": true у провайдеров "opencode" и "opencode-go"
echo в "%CONFIG_DIR%\opencode.json" теперь не нужны - плагин делает это сам
echo при каждом старте. Их можно удалить (необязательно).
echo.
echo После установки перезапусти сервис: opencode service restart
echo.

pause
