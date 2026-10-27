<#
.SYNOPSIS
  Installs or removes the two Windows scheduled tasks of Emily Stories.

.DESCRIPTION
  EmilyStories-New   every day at 08:00        -> npm run story -- new --count 3
  EmilyStories-Make  every 2 hours, 09:00-23:00 -> npm run story -- make --approved
  Both run as the current user, from the project folder, and append their output to
  logs\schedule-YYYY-MM-DD.log. "Make" ignores a new start while the previous one is still rendering.

  Drafts are never made until you approve them: run `npm run story -- list`, read the story.md, then
  `npm run story -- approve <id>`.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1 -Install
  powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1 -Remove
#>
param(
  [switch]$Install,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$names = @('EmilyStories-New', 'EmilyStories-Make')

if ($Install -eq $Remove) {
  Write-Error 'Pass exactly one of -Install or -Remove.'
  exit 1
}

if ($Remove) {
  foreach ($n in $names) {
    if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $n -Confirm:$false
      Write-Host "Removed $n"
    } else {
      Write-Host "$n was not installed"
    }
  }
  exit 0
}

# What each task runs: go to the project, make sure logs\ exists, run the command, append everything to today's log.
function New-StoryAction([string]$storyArgs) {
  $cmd = "Set-Location -LiteralPath '$project'; " +
         "New-Item -ItemType Directory -Force -Path logs | Out-Null; " +
         "`$day = Get-Date -Format 'yyyy-MM-dd'; " +
         "npm run story -- $storyArgs *>> `"logs\schedule-`$day.log`""
  New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$cmd`""
}

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# 08:00 daily: three new drafts to review.
$newTrigger  = New-ScheduledTaskTrigger -Daily -At '08:00'
$newSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew

# Every 2 hours from 09:00 for 14 hours (last start 23:00): make whatever was approved.
$makeTrigger = New-ScheduledTaskTrigger -Daily -At '09:00'
$repeat = New-ScheduledTaskTrigger -Once -At '09:00' -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Hours 14)
$makeTrigger.Repetition = $repeat.Repetition
$makeSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName 'EmilyStories-New' -Action (New-StoryAction 'new --count 3') -Trigger $newTrigger -Settings $newSettings -Principal $principal -Force | Out-Null
Register-ScheduledTask -TaskName 'EmilyStories-Make' -Action (New-StoryAction 'make --approved') -Trigger $makeTrigger -Settings $makeSettings -Principal $principal -Force | Out-Null

Write-Host 'Installed. Check with: Get-ScheduledTask -TaskName EmilyStories-*'
