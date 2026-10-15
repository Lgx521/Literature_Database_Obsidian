// Definitions are settings; paper values stay in the canonical Markdown row.
class FieldSettingsModal extends Modal {
 constructor(plugin){super(plugin.app);this.plugin=plugin;this.initial=JSON.stringify(plugin.settings.libraryFields||[]);this.existingIds=new Set((plugin.settings.libraryFields||[]).map(f=>f.id));this.fields=CustomFields.definitions(plugin.settings.libraryFields).map(({label,...f})=>({...f,options:f.options.map(o=>({...o}))}));this.busy=false;}
 onOpen(){
  this.modalEl.addClass('ldb-field-settings','ldb-dialog');this.titleEl.setText(tr('字段设置'));
  this.contentEl.createEl('p',{text:tr('自定义详情字段的含义与选项。隐藏只影响显示，保留已有数据。')});this.list=this.contentEl.createDiv('ldb-field-settings-list');this.render();
  const add=ldbButton(this.contentEl,tr('新增字段'),()=>{if(this.busy)return;this.fields.push({id:'custom-'+crypto.randomUUID(),name:tr('新字段')+' '+(this.fields.length-3),type:'select',hidden:false,options:[]});this.render(this.fields.at(-1).id);});
  this.error=this.contentEl.createDiv({cls:'ldb-form-error',attr:{role:'alert'}});const actions=this.contentEl.createDiv('ldb-actions');this.saveButton=ldbButton(actions,tr('保存'),()=>this.save(),'mod-cta');ldbButton(actions,tr('取消'),()=>this.close());
 }
 render(openId){
  this.list.empty();for(const field of this.fields){const base=CustomFields.DEFAULTS.find(f=>f.id===field.id),box=this.list.createEl('details',{cls:'ldb-field-definition'});box.open=field.id===openId;const summary=box.createEl('summary',{text:field.name||tr(base?.name||'新字段')});
   const row=box.createDiv('ldb-field-definition-row'),label=row.createEl('input',{type:'text',attr:{'aria-label':tr('字段名称'),placeholder:tr(base?.name||'字段名称'),maxlength:'80'}});label.value=field.name||tr(base?.name||'');label.addEventListener('input',()=>{field.name=base&&label.value===tr(base.name)?'':label.value;summary.setText(label.value||tr('新字段'));});
   const show=row.createEl('label'),visible=show.createEl('input',{type:'checkbox'});visible.checked=!field.hidden;show.appendText(tr('显示'));visible.addEventListener('change',()=>field.hidden=!visible.checked);
   if(!base){const type=box.createEl('select',{attr:{'aria-label':tr('字段类型')}});for(const [value,name] of [['select','单选'],['text','文本']])type.createEl('option',{value,text:tr(name)});type.value=field.type;type.disabled=this.existingIds.has(field.id);type.addEventListener('change',()=>{field.type=type.value;this.render(field.id);});}
   if(field.type==='select'){
    const options=box.createDiv('ldb-field-options');for(const option of field.options){const optionRow=options.createDiv('ldb-field-definition-row'),input=optionRow.createEl('input',{type:'text',attr:{'aria-label':tr('选项名称'),maxlength:'80'}});input.value=option.label||(CustomFields.ID.test(option.value)?'':tr(option.value));input.addEventListener('input',()=>option.label=base?.values?.includes(option.value)&&input.value===tr(option.value)?'':input.value);
     const visible=optionRow.createEl('label'),check=visible.createEl('input',{type:'checkbox'});check.checked=!option.hidden;visible.appendText(tr('显示'));check.addEventListener('change',()=>option.hidden=!check.checked);
    }
    if(field.id!=='organizing')ldbButton(box,tr('新增选项'),()=>{field.options.push({value:'custom-'+crypto.randomUUID(),label:'',hidden:false});this.render(field.id);const inputs=this.list.querySelectorAll('details[open] .ldb-field-options input[type=text]');inputs[inputs.length-1]?.focus();});
   }
  }
 }
 async save(){
  if(this.busy)return;this.busy=true;this.saveButton.disabled=true;this.error.setText('');
  try{
   const p=this.plugin,fields=CustomFields.validate(this.fields);if(p.hasPendingEdit()||p.importing||p.recordBusy)throw Error(tr('请先保存或取消编辑，并等待当前操作结束'));
   const current=await p.loadData()||{};if(JSON.stringify(current.libraryFields||[])!==this.initial)throw Error(tr('字段设置已在其他设备修改，请重新打开'));
   const next={...current,libraryFields:fields};await p.saveData(next);p.settings={...p.settings,...next};
   for(const leaf of p.app.workspace.getLeavesOfType(LIBRARY_VIEW)){const view=leaf.view;if(view instanceof LiteratureBrowser){view.fieldSettingsKey=null;await view.reload();}}
   p.renderNavigation();new Notice(tr('已保存'));this.busy=false;this.close();
  }catch(e){this.error.setText(e.message);}finally{this.busy=false;this.saveButton.disabled=false;}
 }
 close(){if(!this.busy)super.close();}
 onClose(){this.contentEl.empty();}
}
