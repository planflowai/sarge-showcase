@echo off
echo Starting The Foundry on port 3101...
cd /d L:\ai_builder\ai_builderv2\apps\builder-standalone
npx next dev -p 3101 --webpack
