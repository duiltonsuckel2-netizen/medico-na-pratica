Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & Replace(WScript.ScriptFullName, "start-hidden.vbs", "start.bat") & """", 0, False
