Option Explicit

If WScript.Arguments.Count <> 4 And WScript.Arguments.Count <> 5 Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: expected kind, direction, input, output, and optional ownership arguments."
    WScript.Quit 2
End If

Dim kind
Dim direction
Dim inputPath
Dim outputPath
Dim ownershipPath
kind = LCase(WScript.Arguments(0))
direction = LCase(WScript.Arguments(1))
inputPath = WScript.Arguments(2)
outputPath = WScript.Arguments(3)
ownershipPath = ""
If WScript.Arguments.Count = 5 Then ownershipPath = WScript.Arguments(4)

If kind <> "doc" And kind <> "ppt" Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: kind must be doc or ppt."
    WScript.Quit 2
End If
If direction <> "import" And direction <> "export" And direction <> "cleanup" Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: direction must be import, export, or cleanup."
    WScript.Quit 2
End If

Dim fileSystem
Dim safeCleanupFailure
safeCleanupFailure = ""
On Error Resume Next
Set fileSystem = CreateObject("Scripting.FileSystemObject")
If Err.Number <> 0 Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: could not access the local file system: " & Err.Description
    WScript.Quit 2
End If
Err.Clear

If direction = "cleanup" Then
    RunSafeOfficeCleanup kind, inputPath, outputPath, ownershipPath, safeCleanupFailure
    If safeCleanupFailure <> "" Then
        WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: " & safeCleanupFailure
        WScript.Quit 1
    End If
    WScript.Quit 0
End If

If Not fileSystem.FileExists(inputPath) Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: the conversion source does not exist."
    WScript.Quit 2
End If

Dim failureMessage
Dim cleanupFailureMessage
Dim word
Dim document
Dim powerPoint
Dim presentation
Dim processName
Dim processFailureMessage
Dim applicationAlreadyRunning
Dim applicationDisplayName
Dim ownershipFailureMessage
Dim appStartedByOrbit
Dim appDisplayAlerts
Dim appAutomationSecurity
Dim appSettingsCaptured
Dim remainingDocuments
Dim remainingPresentations
failureMessage = ""
cleanupFailureMessage = ""
ownershipFailureMessage = ""
Set word = Nothing
Set document = Nothing
Set powerPoint = Nothing
Set presentation = Nothing
appStartedByOrbit = False
appSettingsCaptured = False

On Error Resume Next

If kind = "doc" Then
    processName = "WINWORD.EXE"
    applicationDisplayName = "Word"
Else
    processName = "POWERPNT.EXE"
    applicationDisplayName = "PowerPoint"
End If
applicationAlreadyRunning = IsOfficeProcessRunning(processName, processFailureMessage)
If processFailureMessage <> "" Then
    failureMessage = processFailureMessage
ElseIf applicationAlreadyRunning Then
    failureMessage = "Microsoft " & applicationDisplayName & " is already running; close it before conversion to protect open documents."
End If

If kind = "doc" Then
    If failureMessage = "" Then
        Set word = CreateObject("Word.Application")
        RecordFailure failureMessage
        If failureMessage = "" Then
            appStartedByOrbit = True
            If ownershipPath <> "" Then
                WriteOwnedProcessMarker processName, ownershipPath, ownershipFailureMessage
                If ownershipFailureMessage <> "" Then
                    failureMessage = ownershipFailureMessage
                    appStartedByOrbit = False
                End If
            End If
        End If
        If failureMessage = "" Then
            processFailureMessage = ""
            If Not VerifyNoOpenOfficeFiles(word, applicationDisplayName, processFailureMessage) Then failureMessage = processFailureMessage
        End If
        If failureMessage = "" Then
            appDisplayAlerts = word.DisplayAlerts
            RecordFailure failureMessage
            If failureMessage = "" Then
                appAutomationSecurity = word.AutomationSecurity
                RecordFailure failureMessage
            End If
            If failureMessage = "" Then appSettingsCaptured = True
        End If
    End If

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
    If failureMessage = "" Then
        Set powerPoint = CreateObject("PowerPoint.Application")
        RecordFailure failureMessage
        If failureMessage = "" Then
            appStartedByOrbit = True
            If ownershipPath <> "" Then
                WriteOwnedProcessMarker processName, ownershipPath, ownershipFailureMessage
                If ownershipFailureMessage <> "" Then
                    failureMessage = ownershipFailureMessage
                    appStartedByOrbit = False
                End If
            End If
        End If
        If failureMessage = "" Then
            processFailureMessage = ""
            If Not VerifyNoOpenOfficeFiles(powerPoint, applicationDisplayName, processFailureMessage) Then failureMessage = processFailureMessage
        End If
        If failureMessage = "" Then
            appDisplayAlerts = powerPoint.DisplayAlerts
            RecordFailure failureMessage
            If failureMessage = "" Then
                appAutomationSecurity = powerPoint.AutomationSecurity
                RecordFailure failureMessage
            End If
            If failureMessage = "" Then appSettingsCaptured = True
        End If
    End If

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
    RecordCleanupFailure cleanupFailureMessage, "Word could not close the temporary document without saving"
    Set document = Nothing
End If
If Not (word Is Nothing) Then
    If appSettingsCaptured Then
        Err.Clear
        word.DisplayAlerts = appDisplayAlerts
        RecordCleanupFailure cleanupFailureMessage, "Word could not restore its alert setting"
        Err.Clear
        word.AutomationSecurity = appAutomationSecurity
        RecordCleanupFailure cleanupFailureMessage, "Word could not restore its macro security setting"
    End If
    If appStartedByOrbit Then
        remainingDocuments = -1
        Err.Clear
        remainingDocuments = word.Documents.Count
        If Err.Number <> 0 Then
            RecordCleanupFailure cleanupFailureMessage, "Orbit could not verify that its Word instance has no remaining documents"
        ElseIf remainingDocuments = 0 Then
            Err.Clear
            word.Quit False
            RecordCleanupFailure cleanupFailureMessage, "Word could not exit the instance started by Orbit"
        Else
            If cleanupFailureMessage = "" Then cleanupFailureMessage = "Orbit left Word running because documents remained open"
        End If
    End If
    RevokeOwnedProcessMarker ownershipPath, cleanupFailureMessage
    Set word = Nothing
End If

If Not (presentation Is Nothing) Then
    Err.Clear
    presentation.Saved = True
    RecordCleanupFailure cleanupFailureMessage, "PowerPoint could not mark the temporary presentation as saved"
    Err.Clear
    presentation.Close
    RecordCleanupFailure cleanupFailureMessage, "PowerPoint could not close the temporary presentation without saving"
    Set presentation = Nothing
End If
If Not (powerPoint Is Nothing) Then
    If appSettingsCaptured Then
        Err.Clear
        powerPoint.DisplayAlerts = appDisplayAlerts
        RecordCleanupFailure cleanupFailureMessage, "PowerPoint could not restore its alert setting"
        Err.Clear
        powerPoint.AutomationSecurity = appAutomationSecurity
        RecordCleanupFailure cleanupFailureMessage, "PowerPoint could not restore its macro security setting"
    End If
    If appStartedByOrbit Then
        remainingPresentations = -1
        Err.Clear
        remainingPresentations = powerPoint.Presentations.Count
        If Err.Number <> 0 Then
            RecordCleanupFailure cleanupFailureMessage, "Orbit could not verify that its PowerPoint instance has no remaining presentations"
        ElseIf remainingPresentations = 0 Then
            Err.Clear
            powerPoint.Quit
            RecordCleanupFailure cleanupFailureMessage, "PowerPoint could not exit the instance started by Orbit"
        Else
            If cleanupFailureMessage = "" Then cleanupFailureMessage = "Orbit left PowerPoint running because presentations remained open"
        End If
    End If
    RevokeOwnedProcessMarker ownershipPath, cleanupFailureMessage
    Set powerPoint = Nothing
End If

On Error GoTo 0

If cleanupFailureMessage <> "" Then
    If failureMessage = "" Then
        failureMessage = cleanupFailureMessage
    Else
        failureMessage = failureMessage & " Cleanup: " & cleanupFailureMessage
    End If
End If

If failureMessage <> "" Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: " & failureMessage
    WScript.Quit 1
End If
If Not fileSystem.FileExists(outputPath) Then
    WScript.StdErr.WriteLine "Orbit Windows Office conversion failed: Microsoft Office did not create the conversion output."
    WScript.Quit 1
End If

Sub RunSafeOfficeCleanup(cleanupKind, cleanupInputPath, cleanupOutputPath, cleanupOwnershipPath, ByRef failure)
    Dim target
    Dim application
    Dim cleanupProcessName
    Dim applicationProgId
    Dim remaining
    failure = ""
    Set target = Nothing
    Set application = Nothing
    If cleanupKind = "doc" Then
        cleanupProcessName = "WINWORD.EXE"
        applicationProgId = "Word.Application"
    Else
        cleanupProcessName = "POWERPNT.EXE"
        applicationProgId = "PowerPoint.Application"
    End If

    If Not MarkerIsOnlyOfficeProcess(cleanupProcessName, cleanupOwnershipPath) Then
        If cleanupOwnershipPath <> "" Then
            If fileSystem.FileExists(cleanupOwnershipPath) Then failure = "Orbit could not verify exclusive ownership of the Office instance for safe cleanup"
        End If
        RevokeOwnedProcessMarker cleanupOwnershipPath, failure
        Exit Sub
    End If
    Set application = TryGetOfficeApplication(applicationProgId)
    If application Is Nothing Then
        failure = "Orbit could not connect to the existing " & cleanupKind & " instance for safe cleanup"
        RevokeOwnedProcessMarker cleanupOwnershipPath, failure
        Exit Sub
    End If
    Set target = FindOfficeFile(application, cleanupKind, cleanupInputPath, cleanupOutputPath)
    If target Is Nothing Then
        On Error Resume Next
        remaining = -1
        Err.Clear
        If cleanupKind = "doc" Then
            remaining = application.Documents.Count
        Else
            remaining = application.Presentations.Count
        End If
        If Err.Number <> 0 Then
            failure = "Orbit could not find the private " & cleanupKind & " document or verify the remaining documents; the Office instance was left running"
        ElseIf remaining = 0 And MarkerIsOnlyOfficeProcess(cleanupProcessName, cleanupOwnershipPath) Then
            Err.Clear
            If cleanupKind = "doc" Then
                application.Quit False
            Else
                application.Quit
            End If
            RecordCleanupFailure failure, "Office could not exit the instance started by Orbit"
        Else
            failure = "Orbit could not find the private " & cleanupKind & " document to close safely; the Office instance was left running"
        End If
        On Error GoTo 0
        RevokeOwnedProcessMarker cleanupOwnershipPath, failure
        Exit Sub
    End If

    On Error Resume Next
    Set application = target.Application
    If Err.Number <> 0 Then
        failure = "Orbit could not access the temporary " & cleanupKind & " application for safe cleanup: " & Err.Description
        Err.Clear
    End If
    If cleanupKind = "doc" Then
        Err.Clear
        target.Close False
        RecordCleanupFailure failure, "Word could not close the temporary document without saving"
    Else
        Err.Clear
        target.Saved = True
        RecordCleanupFailure failure, "PowerPoint could not mark the temporary presentation as saved"
        Err.Clear
        target.Close
        RecordCleanupFailure failure, "PowerPoint could not close the temporary presentation without saving"
    End If
    Set target = Nothing

    If Not (application Is Nothing) Then
        If MarkerIsOnlyOfficeProcess(cleanupProcessName, cleanupOwnershipPath) Then
            remaining = -1
            Err.Clear
            If cleanupKind = "doc" Then
                remaining = application.Documents.Count
            Else
                remaining = application.Presentations.Count
            End If
            If Err.Number <> 0 Then
                If failure = "" Then failure = "Orbit could not verify that the temporary " & cleanupKind & " instance has no remaining documents"
            ElseIf remaining = 0 Then
                Err.Clear
                If cleanupKind = "doc" Then
                    application.Quit False
                Else
                    application.Quit
                End If
                RecordCleanupFailure failure, "Office could not exit the instance started by Orbit"
            Else
                If failure = "" Then failure = "Orbit left the Office instance running because documents remained open"
            End If
        Else
            If failure = "" Then failure = "Orbit left the Office instance running because exclusive ownership could not be verified"
        End If
    End If
    RevokeOwnedProcessMarker cleanupOwnershipPath, failure
    Set application = Nothing
    On Error GoTo 0
End Sub

Function TryGetOfficeApplication(applicationProgId)
    Dim application
    Set application = Nothing
    On Error Resume Next
    Set application = GetObject(, applicationProgId)
    Err.Clear
    Set TryGetOfficeApplication = application
    Set application = Nothing
    On Error GoTo 0
End Function

Function FindOfficeFile(application, officeKind, inputPath, outputPath)
    Dim files
    Dim fileItem
    Dim fullName
    Set files = Nothing
    Set FindOfficeFile = Nothing
    On Error Resume Next
    If officeKind = "doc" Then
        Set files = application.Documents
    Else
        Set files = application.Presentations
    End If
    If Err.Number <> 0 Then
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    For Each fileItem In files
        fullName = ""
        Err.Clear
        fullName = fileItem.FullName
        If Err.Number = 0 Then
            If OfficePathsEqual(fullName, inputPath) Or OfficePathsEqual(fullName, outputPath) Then
                Set FindOfficeFile = fileItem
                Exit For
            End If
        End If
    Next
    Err.Clear
    Set fileItem = Nothing
    Set files = Nothing
    On Error GoTo 0
End Function

Function OfficePathsEqual(firstPath, secondPath)
    Dim firstAbsolutePath
    Dim secondAbsolutePath
    OfficePathsEqual = False
    If firstPath = "" Or secondPath = "" Then Exit Function
    On Error Resume Next
    firstAbsolutePath = fileSystem.GetAbsolutePathName(firstPath)
    secondAbsolutePath = fileSystem.GetAbsolutePathName(secondPath)
    If Err.Number = 0 Then OfficePathsEqual = (LCase(firstAbsolutePath) = LCase(secondAbsolutePath))
    Err.Clear
    On Error GoTo 0
End Function

Function MarkerIsOnlyOfficeProcess(expectedProcessName, markerPath)
    Dim reader
    Dim expectedProcessId
    Dim service
    Dim processes
    Dim process
    Dim processCount
    Dim matchingProcessFound
    MarkerIsOnlyOfficeProcess = False
    expectedProcessId = ""
    processCount = 0
    matchingProcessFound = False
    If markerPath = "" Then Exit Function

    On Error Resume Next
    If Not fileSystem.FileExists(markerPath) Then
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    Set reader = fileSystem.OpenTextFile(markerPath, 1, False, 0)
    If Err.Number <> 0 Then
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    expectedProcessId = Trim(reader.ReadLine)
    reader.Close
    If Err.Number <> 0 Or expectedProcessId = "" Then
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    Set service = GetObject("winmgmts:{impersonationLevel=impersonate}!\\.\root\cimv2")
    If Err.Number <> 0 Then
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    Set processes = service.ExecQuery("SELECT ProcessId, Name FROM Win32_Process WHERE Name = '" & expectedProcessName & "'")
    If Err.Number <> 0 Then
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    For Each process In processes
        If LCase(process.Name) = LCase(expectedProcessName) Then
            processCount = processCount + 1
            If CStr(process.ProcessId) = expectedProcessId Then matchingProcessFound = True
        End If
    Next
    Set process = Nothing
    Set processes = Nothing
    Set service = Nothing
    If processCount = 1 And matchingProcessFound Then MarkerIsOnlyOfficeProcess = True
    Err.Clear
    On Error GoTo 0
End Function

Sub RecordFailure(ByRef message)
    If message = "" And Err.Number <> 0 Then
        message = Err.Description
    End If
    Err.Clear
End Sub

Function VerifyNoOpenOfficeFiles(application, applicationDisplayName, ByRef failure)
    Dim remaining
    failure = ""
    VerifyNoOpenOfficeFiles = False
    On Error Resume Next
    remaining = -1
    Err.Clear
    If applicationDisplayName = "Word" Then
        remaining = application.Documents.Count
    Else
        remaining = application.Presentations.Count
    End If
    If Err.Number <> 0 Then
        failure = "Orbit could not verify that Microsoft " & applicationDisplayName & " has no open documents before conversion: " & Err.Description
    ElseIf remaining <> 0 Then
        failure = "Microsoft " & applicationDisplayName & " opened a document while Orbit was starting; conversion was cancelled to protect it."
    Else
        VerifyNoOpenOfficeFiles = True
    End If
    Err.Clear
    On Error GoTo 0
End Function

Function IsOfficeProcessRunning(processName, ByRef failure)
    Dim service
    Dim processes
    Dim process
    failure = ""
    IsOfficeProcessRunning = False
    On Error Resume Next
    Err.Clear
    Set service = GetObject("winmgmts:{impersonationLevel=impersonate}!\\.\root\cimv2")
    If Err.Number <> 0 Then
        failure = "Orbit could not safely determine whether " & processName & " is running: " & Err.Description
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    Set processes = service.ExecQuery("SELECT Name FROM Win32_Process WHERE Name = '" & processName & "'")
    If Err.Number <> 0 Then
        failure = "Orbit could not safely determine whether " & processName & " is running: " & Err.Description
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    For Each process In processes
        If LCase(process.Name) = LCase(processName) Then
            IsOfficeProcessRunning = True
            Exit For
        End If
    Next
    Set process = Nothing
    Set processes = Nothing
    Set service = Nothing
    Err.Clear
    On Error GoTo 0
End Function

Sub WriteOwnedProcessMarker(processName, markerPath, ByRef failure)
    Dim service
    Dim processes
    Dim process
    Dim writer
    Dim processCount
    Dim processId
    Dim attempt
    failure = ""
    processCount = 0
    processId = ""
    On Error Resume Next
    For attempt = 1 To 20
        processCount = 0
        processId = ""
        Err.Clear
        Set service = GetObject("winmgmts:{impersonationLevel=impersonate}!\\.\root\cimv2")
        If Err.Number <> 0 Then
            failure = "Orbit could not establish ownership of the new " & processName & " instance: " & Err.Description
            Err.Clear
            On Error GoTo 0
            Exit Sub
        End If
        Set processes = service.ExecQuery("SELECT ProcessId, Name FROM Win32_Process WHERE Name = '" & processName & "'")
        If Err.Number <> 0 Then
            failure = "Orbit could not establish ownership of the new " & processName & " instance: " & Err.Description
            Err.Clear
            On Error GoTo 0
            Exit Sub
        End If
        For Each process In processes
            If LCase(process.Name) = LCase(processName) Then
                processCount = processCount + 1
                processId = CStr(process.ProcessId)
            End If
        Next
        Set process = Nothing
        Set processes = Nothing
        Set service = Nothing
        If processCount = 1 Then Exit For
        If processCount > 1 Then Exit For
        WScript.Sleep 100
    Next
    If processCount <> 1 Then
        failure = "Orbit could not establish exclusive ownership of the new " & processName & " instance."
        On Error GoTo 0
        Exit Sub
    End If
    Set writer = fileSystem.OpenTextFile(markerPath, 2, True, 0)
    If Err.Number <> 0 Then
        failure = "Orbit could not write the private Office ownership record: " & Err.Description
        Err.Clear
        On Error GoTo 0
        Exit Sub
    End If
    writer.WriteLine processId
    If Err.Number <> 0 Then
        failure = "Orbit could not write the private Office ownership record: " & Err.Description
        Err.Clear
    End If
    writer.Close
    If Err.Number <> 0 And failure = "" Then
        failure = "Orbit could not close the private Office ownership record: " & Err.Description
    End If
    Err.Clear
    Set writer = Nothing
    Set process = Nothing
    Set processes = Nothing
    Set service = Nothing
    On Error GoTo 0
End Sub

Sub RevokeOwnedProcessMarker(markerPath, ByRef failure)
    On Error Resume Next
    If markerPath <> "" Then
        If fileSystem.FileExists(markerPath) Then
            Err.Clear
            fileSystem.DeleteFile markerPath, True
            If Err.Number <> 0 And failure = "" Then
                failure = "Orbit could not revoke the private Office ownership record: " & Err.Description
            End If
        End If
    End If
    Err.Clear
    On Error GoTo 0
End Sub

Sub RecordCleanupFailure(ByRef message, operation)
    If message = "" And Err.Number <> 0 Then
        message = operation & ": " & Err.Description
    End If
    Err.Clear
End Sub
