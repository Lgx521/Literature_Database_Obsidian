// Lightweight URL intake. Native paste works on mobile without clipboard permissions.
class WebResourceModal extends Modal {
  constructor(plugin,nav){super(plugin.app);this.plugin=plugin;this.nav={...nav};}
  open(){
    if(this.plugin.webResourceModal){this.plugin.webResourceModal.input.focus();return;}
    this.plugin.webResourceModal=this;super.open();
  }
  onOpen(){
    this.modalEl.addClass('ldb-dialog');this.titleEl.setText(tr('添加网页'));
    const form=this.contentEl.createEl('form',{cls:'ldb-editor'});
    const label=form.createEl('label',{cls:'ldb-field'});label.createSpan({text:tr('网址（每行一个）')});
    this.input=label.createEl('textarea',{attr:{rows:'4',placeholder:'https://…','aria-label':tr('网址（每行一个）'),autocapitalize:'off',spellcheck:'false'}});
    const title=form.createEl('label',{cls:'ldb-field'});title.createSpan({text:tr('标题（可选，单个网址）')});
    this.titleInput=title.createEl('input',{type:'text',attr:{'aria-label':tr('标题（可选，单个网址）')}});
    this.error=form.createDiv({cls:'ldb-form-error',attr:{role:'alert'}});
    const actions=form.createDiv('ldb-actions');
    this.save=actions.createEl('button',{text:tr('添加'),cls:'mod-cta',attr:{type:'submit'}});
    this.cancel=actions.createEl('button',{text:tr('取消'),attr:{type:'button'}});this.cancel.addEventListener('click',()=>this.close());
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(this.busy)return;
      const links=WebResources.links(this.input.value),lines=this.input.value.split(/\r?\n/).filter(l=>l.trim()&&!l.trim().startsWith('#'));
      if(!links.length||lines.some(line=>!WebResources.links(line).length)){this.error.setText(tr('请输入完整的 HTTP 或 HTTPS 网址'));return;}
      if(links.length===1&&this.titleInput.value.trim())links[0].title=this.titleInput.value.trim();
      this.busy=true;this.save.disabled=this.cancel.disabled=true;this.input.disabled=this.titleInput.disabled=true;
      try{await this.plugin.importWebLinks(links,this.nav);this.close();}
      catch(error){this.error.setText(error.message);}
      finally{this.busy=false;this.save.disabled=this.cancel.disabled=false;this.input.disabled=this.titleInput.disabled=false;}
    });
    this.input.focus();
  }
  onClose(){if(this.plugin.webResourceModal===this)this.plugin.webResourceModal=null;this.contentEl.empty();}
}
