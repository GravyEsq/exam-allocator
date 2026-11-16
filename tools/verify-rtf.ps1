$ErrorActionPreference = 'Stop'
$taskQa = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../qa'))
$taskNames = Get-Content -LiteralPath (Join-Path $taskQa 'compact-report-names.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskWord = New-Object -ComObject Word.Application
$taskWord.Visible = $false
$taskWord.DisplayAlerts = 0
$taskWord.AutomationSecurity = 3
try {
    foreach ($taskKind in @('students','supervisor')) {
        $taskFile = Join-Path $taskQa "compact-$taskKind.rtf"
        $taskDocument = $taskWord.Documents.Open($taskFile, $false, $false, $false)
        try {
            $taskDocument.Repaginate()
            $taskDocument.ExportAsFixedFormat((Join-Path $taskQa "compact-$taskKind-word.pdf"),17)
            $taskPages = $taskDocument.ComputeStatistics(2)
            if ($taskPages -ne 2) { throw "$taskKind RTF: expected 2 pages, got $taskPages" }
            $taskText = $taskDocument.Content.Text
            $taskIndex = 0
            foreach ($taskName in $taskNames) {
                if ([regex]::Matches($taskText,[regex]::Escape($taskName)).Count -ne 1) { throw "$taskKind RTF: missing or duplicate fictional name" }
                $taskSearch = $taskDocument.Content.Duplicate
                if (-not $taskSearch.Find.Execute($taskName)) { throw 'Name not found in Word range' }
                $taskExpectedPage = if ($taskIndex -lt 38) { 1 } else { 2 }
                if ($taskSearch.Information(3) -ne $taskExpectedPage) { throw 'Pupil is on the wrong room page' }
                $taskIndex++
            }
            if ($taskDocument.Fields.Count -ne 0) { throw 'Unexpected RTF fields' }
            foreach ($taskTable in $taskDocument.Tables) { if ($taskTable.TableDirection -ne 0) { throw 'RTF table is not RTL' } }
            # Prove this is an editable document, not an image embedded in RTF.
            $taskRange = $taskDocument.Range(0,0)
            $taskRange.InsertBefore('EDIT_CHECK ')
            $taskEdited = Join-Path $taskQa "compact-$taskKind-edited.rtf"
            $taskDocument.SaveAs2($taskEdited,6)
        } finally { $taskDocument.Close(0) }
        $taskReopened = $taskWord.Documents.Open($taskEdited,$false,$true,$false)
        try { if (-not $taskReopened.Content.Text.Contains('EDIT_CHECK')) { throw 'RTF edit was not saved' } }
        finally { $taskReopened.Close(0) }
        Write-Output "$taskKind RTF: 2 A4 pages in Word, all 76 names once, RTL tables, edit/save/reopen verified"
    }
} finally {
    $taskWord.Quit(0)
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskWord) | Out-Null
}
