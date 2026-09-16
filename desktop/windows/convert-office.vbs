Option Explicit

If WScript.Arguments.Count <> 4 Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: expected kind, direction, input, and output arguments."
    WScript.Quit 2
End If

Dim kind
Dim direction
Dim inputPath
Dim outputPath
kind = LCase(WScript.Arguments(0))
direction = LCase(WScript.Arguments(1))
inputPath = WScript.Arguments(2)
outputPath = WScript.Arguments(3)

If kind <> "doc" And kind <> "ppt" Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: kind must be doc or ppt."
    WScript.Quit 2
End If
If direction <> "import" And direction <> "export" Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: direction must be import or export."
    WScript.Quit 2
End If

Dim fileSystem
Set fileSystem = CreateObject("Scripting.FileSystemObject")
If Not fileSystem.FileExists(inputPath) Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: the conversion source does not exist."
    WScript.Quit 2
End If

Dim failureMessage
Dim word
Dim document
Dim powerPoint
Dim presentation
failureMessage = ""
Set word = Nothing
Set document = Nothing
Set powerPoint = Nothing
Set presentation = Nothing

On Error Resume Next

If kind = "doc" Then
    Set word = CreateObject("Word.Application")
    RecordFailure failureMessage

    If failureMessage = "" Then
        word.Visible = False
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        word.DisplayAlerts = 0
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        word.AutomationSecurity = 3
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        Set document = word.Documents.Open(inputPath, False, True, False)
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        If direction = "import" Then
            document.SaveAs2 outputPath, 16
        Else
            document.SaveAs2 outputPath, 0
        End If
        RecordFailure failureMessage
    End If
Else
    Set powerPoint = CreateObject("PowerPoint.Application")
    RecordFailure failureMessage

    If failureMessage = "" Then
        powerPoint.DisplayAlerts = 1
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        powerPoint.AutomationSecurity = 3
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        Set presentation = powerPoint.Presentations.Open(inputPath, True, False, False)
        RecordFailure failureMessage
    End If
    If failureMessage = "" Then
        If direction = "import" Then
            presentation.SaveAs outputPath, 24
        Else
            presentation.SaveAs outputPath, 1
        End If
        RecordFailure failureMessage
    End If
End If

If Not (document Is Nothing) Then
    Err.Clear
    document.Close False
    Err.Clear
    Set document = Nothing
End If
If Not (word Is Nothing) Then
    Err.Clear
    word.Quit False
    Err.Clear
    Set word = Nothing
End If

If Not (presentation Is Nothing) Then
    Err.Clear
    presentation.Close
    Err.Clear
    Set presentation = Nothing
End If
If Not (powerPoint Is Nothing) Then
    Err.Clear
    powerPoint.Quit
    Err.Clear
    Set powerPoint = Nothing
End If

On Error GoTo 0

If failureMessage <> "" Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: " & failureMessage
    WScript.Quit 1
End If
If Not fileSystem.FileExists(outputPath) Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: Microsoft Office did not create the conversion output."
    WScript.Quit 1
End If

Sub RecordFailure(ByRef message)
    If message = "" And Err.Number <> 0 Then
        message = Err.Description
    End If
    Err.Clear
End Sub
