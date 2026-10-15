// No writes on a fresh install until the user chooses Create library.
const LDB_SOURCE_NAMES=['library.md','collections.md','reviews.md','submissions.md'];
function ldbHasSourceFiles(vault){
  return [...LDB_SOURCE_NAMES,...Object.keys(StorageMigration.RENAMES)].some(name=>vault.getAbstractFileByPath(name));
}
async function ldbInitializeVault(vault){
  if(ldbHasSourceFiles(vault))throw new Error(tr('已有源文件，未覆盖。请等待同步完成，或在空库中初始化。'));
  const {TFolder}=require('obsidian');
  const folders=['papers','temp','reviews','submissions'];
  for(const name of folders){const file=vault.getAbstractFileByPath(name);if(file&&!(file instanceof TFolder))throw new Error(tr`文件夹名称已被文件占用：${name}`);}
  // Vault.create refuses a collision, including a file arriving after the preflight.
  for(const name of folders)if(!vault.getAbstractFileByPath(name))await vault.createFolder(name);
  for(const name of LDB_SOURCE_NAMES)await vault.create(name,LDB_TEMPLATES[name]);
  // Never replace a vault's own agent instructions.
  if(!vault.getAbstractFileByPath('AGENTS.md'))await vault.create('AGENTS.md',LDB_TEMPLATES['AGENTS.md']);
}
class LibrarySetupModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;}
  onOpen(){this.modalEl?.addClass('ldb-dialog');
    this.titleEl.setText(tr('创建文献库'));
    this.contentEl.createEl('p',{text:tr('在当前仓库创建四个 Markdown 源表和 papers、temp、reviews、submissions 文件夹。已有文件不会被覆盖。建议使用独立仓库。')});
    this.contentEl.createEl('p',{text:tr('同时添加 AGENTS.md（如果尚不存在），供手动整理使用。')});
    const error=this.contentEl.createDiv('ldb-form-error'),actions=this.contentEl.createDiv('ldb-actions');
    const create=ldbButton(actions,tr('创建文献库'),async()=>{
      create.disabled=true;
      try{
        this.plugin.migrating=true;await ldbInitializeVault(this.app.vault);
        this.plugin.setupNeeded=false;this.plugin.ready=true;
        this.plugin.migrating=false;await this.plugin.refresh();
        this.close();await this.plugin.openLibrary();
      }catch(e){error.setText(e.message);create.disabled=false;}
      finally{this.plugin.migrating=false;}
    },'mod-cta');
    ldbButton(actions,tr('取消'),()=>this.close());
  }
  onClose(){this.contentEl.empty();}
}
function ldbSettingsTab(plugin){
  const {PluginSettingTab,Setting}=require('obsidian');
  return new (class extends PluginSettingTab {
    display(){
      this.containerEl.empty();
      for(const [key,title,description] of [
        ['openOnStartup','启动时打开文献库','启用后，在 Obsidian 启动时显示文献库和左侧分类。'],
        ['redirectSourceFiles','用文献库打开源表','启用后，打开四个源表时切换到插件界面。关闭后可直接编辑 Markdown。']
      ])new Setting(this.containerEl).setName(tr(title)).setDesc(tr(description)).addToggle(toggle=>toggle.setValue(!!plugin.settings[key]).onChange(async value=>{
        const previous=plugin.settings;
        try{const next={...previous,[key]:value};await plugin.saveData(next);plugin.settings=next;}
        catch(e){toggle.setValue(!!previous[key]);new Notice(e.message,8000);}
      }));
      new Setting(this.containerEl).setName(tr('文献库')).addButton(button=>button.setButtonText(tr('打开文献管理器')).onClick(()=>plugin.openLibrary()));
      new Setting(this.containerEl).setName(tr('字段设置')).setDesc(tr('修改字段名称与选项，新增或隐藏详情字段。')).addButton(button=>button.setButtonText(tr('自定义字段')).onClick(()=>new FieldSettingsModal(plugin).open()));
      let openBeta;
      new Setting(this.containerEl).setName('DeepSeek Beta').setDesc(tr('关闭后隐藏相关入口并停止整理，保留密钥配置和本次预览。')).addButton(button=>{openBeta=button;button.setButtonText(tr('打开体验功能')).setDisabled(!ldbDeepSeekAvailable(plugin)).onClick(()=>ldbOpenDeepSeek(plugin));}).addToggle(toggle=>toggle.setValue(ldbDeepSeekAvailable(plugin)).onChange(async value=>{
        toggle.setDisabled(true);
        try{await plugin.setDeepSeekBetaEnabled(value);}
        catch(e){new Notice(e.message,8000);}
        finally{toggle.setValue(ldbDeepSeekAvailable(plugin));toggle.setDisabled(false);openBeta.setDisabled(!ldbDeepSeekAvailable(plugin));}
      }));
    }
  })(plugin.app,plugin);
}
