Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
vbsPath = fso.BuildPath(scriptDir, "start-hidden.vbs")

Set shortcut = WshShell.CreateShortcut("C:\Users\Pichau\Medico na Pratica.lnk")
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & vbsPath & """"
shortcut.WorkingDirectory = scriptDir
shortcut.WindowStyle = 0
shortcut.Description = "Abre o app Medico na Pratica"
shortcut.Save

WScript.Echo "Atalho criado! Arraste de C:\Users\Pichau para a Area de Trabalho."
