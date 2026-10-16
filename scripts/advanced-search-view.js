// Applied conditions live in workspace state. Editing and tag selection are session drafts.
class AdvancedSearchModal extends Modal {
  constructor(view){super(view.app);this.view=view;this.plugin=view.plugin;this.state=AdvancedSearch.normalize(view.filters.advanced);this.closed=false;}
  onOpen(){
    this.modalEl.addClass('ldb-advanced-modal');this.titleEl.setText(tr('高级搜索'));
    const mode=this.contentEl.createDiv('ldb-advanced-mode');mode.createSpan({text:tr('匹配方式')});
    this.match=this.select(mode,tr('匹配方式'),[['all',tr('全部满足（交集）')],['any',tr('任一满足（并集）')]],this.state.match,()=>{this.state.match=this.match.value;});
    this.rowsEl=this.contentEl.createDiv('ldb-advanced-rows');
    if(!this.state.conditions.length)this.state.conditions.push(this.blank());
    this.renderRows();
    this.addEl=ldbButton(this.contentEl,tr('添加条件'),()=>{if(this.state.conditions.length<30){this.state.conditions.push(this.blank());this.renderRows();this.rowsEl.lastElementChild?.querySelector('input')?.focus();}},'ldb-advanced-add');this.addEl.disabled=this.state.conditions.length>=30;
    this.errorEl=this.contentEl.createDiv({cls:'ldb-error',attr:{role:'alert'}});this.errorEl.hidden=true;
    const footer=this.contentEl.createDiv('ldb-advanced-footer');
    ldbButton(footer,tr('清除条件'),()=>{this.state.conditions=[];this.renderRows();this.errorEl.hidden=true;},'ldb-advanced-reset');
    ldbButton(footer,tr('取消'),()=>this.close());
    ldbButton(footer,tr('应用'),()=>this.apply(),'mod-cta');
    this.contentEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229&&e.target.tagName==='INPUT'){e.preventDefault();this.apply();}});
  }
  blank(){return {field:'title',op:'contains',value:'',end:'',tags:[]};}
  select(parent,label,options,value,onChange){const el=parent.createEl('select',{attr:{'aria-label':label}});for(const [v,text]of options)el.createEl('option',{value:v,text});el.value=value;el.addEventListener('change',onChange);return el;}
  renderRows(focusCondition=null,focusSelector=null){
    const scroll=this.rowsEl.scrollTop;this.rowsEl.empty();this.rowInputs=[];
    for(const c of this.state.conditions){
      const row=this.rowsEl.createDiv('ldb-advanced-row');
      const field=this.select(row,tr('搜索字段'),Object.entries(AdvancedSearch.FIELDS).map(([v,t])=>[v,tr(t)]),c.field,()=>{Object.assign(c,this.blank(),{field:field.value,op:AdvancedSearch.operators(field.value)[0]});this.renderRows(c,'field');});
      const op=this.select(row,tr('匹配条件'),AdvancedSearch.operators(c.field).map(v=>[v,tr(AdvancedSearch.OPS[v])]),c.op,()=>{c.op=op.value;this.renderRows(c,'operator');});
      const values=row.createDiv('ldb-advanced-value');let focus;
      if(!AdvancedSearch.unary(c.op)){
        if(c.field==='tags'){
          const pick=ldbButton(values,c.tags.length?c.tags.map(TagTree.label).join(' · '):tr('选择标签…'),()=>this.chooseTags(c),'ldb-advanced-tags');pick.title=c.tags.map(TagTree.label).join(', ');pick.setAttribute('aria-haspopup','dialog');focus=pick;
        }else{
          const input=values.createEl('input',{type:'text',attr:{'aria-label':tr(c.field==='published'?'开始时间':'搜索内容'),placeholder:c.field==='published'?'2026 / 2026.5':tr('搜索内容')}});input.value=c.value;input.addEventListener('input',()=>{c.value=input.value;input.removeAttribute('aria-invalid');});focus=input;
          if(c.op==='between'){values.createSpan({text:'—',attr:{'aria-hidden':'true'}});const end=values.createEl('input',{type:'text',attr:{'aria-label':tr('结束时间'),placeholder:'2026 / 2026.10'}});end.value=c.end;end.addEventListener('input',()=>{c.end=end.value;input.removeAttribute('aria-invalid');});}
        }
      }
      const remove=ldbButton(row,'',()=>{this.state.conditions.splice(this.state.conditions.indexOf(c),1);this.renderRows();this.addEl?.focus();},'ldb-advanced-remove clickable-icon');setIcon(remove,'x');remove.title=tr('移除条件');remove.setAttribute('aria-label',tr('移除条件'));this.rowInputs.push(focus||field);
      if(focusCondition===c)(focusSelector==='field'?field:focusSelector==='operator'?op:focus)?.focus({preventScroll:true});
    }
    if(!this.state.conditions.length)this.rowsEl.createDiv({cls:'ldb-advanced-empty',text:tr('没有高级搜索条件')});
    if(this.addEl)this.addEl.disabled=this.state.conditions.length>=30;
    this.rowsEl.scrollTop=scroll;
  }
  chooseTags(condition){
    if(this.closed)return;this.tagPicker?.close(true);
    const facade={app:this.app,plugin:this.plugin,detailRow:{tags:condition.tags.join(' ')},detailTitle:()=>tr('选择标签'),dirty:()=>false,lockFilters(){},reload(){},saveMapTag(tag,checked){const tags=Engine.normalizeTagFilter(this.detailRow.tags.split(/\s+/));this.detailRow.tags=(checked?Engine.normalizeTagFilter([...tags,tag]):tags.filter(t=>TagTree.fold(t)!==TagTree.fold(tag))).join(' ');return true;}};
    const draft={selectionOnly:true,read:()=>TagTree.read(this.plugin.app.vault),isHuman:()=>false};
    this.tagPicker=new SearchTagMapModal(facade,draft,tags=>{if(!this.closed){condition.tags=tags;this.renderRows();}},()=>{this.tagPicker=null;if(!this.closed)this.rowInputs[this.state.conditions.indexOf(condition)]?.focus({preventScroll:true});});this.tagPicker.open();
  }
  apply(){
    const next=AdvancedSearch.normalize(this.state),index=next.conditions.findIndex(c=>AdvancedSearch.problem(c));
    if(index>=0){this.errorEl.setText(tr(AdvancedSearch.problem(next.conditions[index])));this.errorEl.hidden=false;this.rowInputs[index]?.setAttribute('aria-invalid','true');this.rowInputs[index]?.focus();return;}
    if(this.view.applyAdvancedSearch(next))this.close();
  }
  onClose(){
    if(this.closed)return;this.closed=true;this.tagPicker?.close(true);this.tagPicker=null;
    const view=this.view;if(view.advancedSearchModal===this)view.advancedSearchModal=null;if(this.plugin.advancedSearchModal===this)this.plugin.advancedSearchModal=null;
    this.contentEl.empty();this.state=this.rowInputs=this.rowsEl=this.match=this.errorEl=this.addEl=null;
    if(!view.closed&&!this.plugin.stopped)view.advancedEl?.focus({preventScroll:true});this.view=this.plugin=null;
  }
}

class SearchTagMapModal extends TagMapModal {
  constructor(view,draft,apply,done){super(view,draft);this.applySelection=apply;this.finished=done;}
  onOpen(){
    super.onOpen();this.titleEl.setText(tr('选择标签'));
    const footer=this.contentEl.createDiv('ldb-advanced-footer');ldbButton(footer,tr('取消'),()=>this.close());ldbButton(footer,tr('应用'),()=>{this.applySelection(Engine.normalizeTagFilter(this.view.detailRow.tags.split(/\s+/)));this.close();},'mod-cta');
  }
  onClose(){if(this.closed)return;const done=this.finished;super.onClose();this.applySelection=this.finished=null;done?.();}
}
