Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d L:\ai_builder\ai_builderv2 && (pm2 resurrect || pm2 start ecosystem.config.cjs) && pm2 save", 0, False
