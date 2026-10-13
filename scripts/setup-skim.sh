#!/bin/zsh
set -eu
TASK_VAULT="${0:A:h:h}"
if [[ ! -d /Applications/Skim.app ]]; then
  print '请先安装 Skim，再运行本脚本。'
  exit 1
fi
# Change only the three preferences needed for ordinary-file annotation sync.
mkdir -p "$TASK_VAULT/.maintenance-backups"
TASK_BACKUP="$TASK_VAULT/.maintenance-backups/skim-preferences-$(date +%Y%m%d-%H%M%S)-$$.txt"
for TASK_KEY in SKAutoSaveSkimNotes SKReadMissingNotesFromSkimFileOption SKReadNonMissingNotesFromSkimFileOption; do
  print -n "$TASK_KEY = " >> "$TASK_BACKUP"
  defaults read net.sourceforge.skim-app.skim "$TASK_KEY" >> "$TASK_BACKUP" 2>/dev/null || print '(unset)' >> "$TASK_BACKUP"
done
defaults write net.sourceforge.skim-app.skim SKAutoSaveSkimNotes -bool true
defaults write net.sourceforge.skim-app.skim SKReadMissingNotesFromSkimFileOption -int 1
defaults write net.sourceforge.skim-app.skim SKReadNonMissingNotesFromSkimFileOption -int 1
print 'Skim 批注同步已配置。若 Skim 已打开，请保存当前工作并退出、重新打开，使配置生效。'
print '每次 ⌘S 保存 PDF 时会同时保存同名 .skim 文件；打开 PDF 时优先读取同名 .skim。'
print '另一台 Mac 也需运行一次本脚本。切换设备前保存并等待 PDF 与 .skim 都完成同步。'
print "原偏好备份：$TASK_BACKUP"
