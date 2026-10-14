// Native membership selection; metadata and PDFs remain in the master library.
function ldbChildMenu(plugin,rows,target,position,doc){
  if(plugin.hasPendingEdit()){new Notice(tr('请先保存或取消右侧编辑'));return;}
  const group=plugin.snapshot.collections?.find(g=>g.scope===target.scope&&g.name===target.name);if(!group)return;
  const expected={target,placements:Collections.placementState(plugin.snapshot.collections,rows.map(r=>r.path),target)},menu=new Menu().setUseNativeMenu(!Platform?.isMobile);
  menu.addItem(item=>item.setTitle(group.name).setIsLabel(true));
  for(const subgroup of [...(group.subgroups||[]),'']){
    const checked=expected.placements.every(m=>m&&(m.subgroup||'')===subgroup);
    menu.addItem(item=>item.setTitle(subgroup||tr('未分组')).setChecked(checked).onClick(async()=>{
      try{await plugin.changeMembership(rows,{...target,subgroup},null,false,expected);}catch(e){new Notice(e.message,8000);}
    }));
  }
  menu.showAtPosition(position,doc);return menu;
}
function ldbOpenCollectionMenu(plugin,rows,position,doc){
  if(plugin.hasPendingEdit()){new Notice(tr('请先保存或取消右侧编辑'));return;}
  plugin.membershipMenu?.close();
  const picker=new CollectionMembershipMenu(plugin,rows,position,doc);plugin.membershipMenu=picker;
  // A native context-menu click must finish before its replacement menu opens.
  picker.timer=setTimeout(()=>picker.show(),0);
}
class CollectionMembershipMenu {
  constructor(plugin,rows,position,doc){Object.assign(this,{plugin,rows:[...rows],position,doc,closed:false,busy:false});}
  close(){this.closed=true;clearTimeout(this.timer);this.menu?.hide();if(this.plugin.membershipMenu===this)this.plugin.membershipMenu=null;}
  show(){
    if(this.closed||this.plugin.stopped||this.doc?.hidden)return;
    if(this.plugin.hasPendingEdit()){this.close();return;}
    const menu=new Menu().setUseNativeMenu(!Platform?.isMobile);this.menu=menu;
    const groups=this.plugin.snapshot.collections||[];let sections=0;
    for(const [scope,title] of [['library',tr('分类')],['projects',tr('写作项目')]]){
      const list=groups.filter(g=>g.scope===scope);if(!list.length)continue;
      if(sections++)menu.addSeparator();
      menu.addItem(item=>item.setTitle(title).setIsLabel(true));
      for(const group of list){
        const members=this.rows.map(row=>{const m=group.members.find(m=>m.path===row.path);return m?m.notes:null;});
        const count=members.filter(m=>m!==null).length,checked=count===this.rows.length;
        const target={scope,name:group.name},expected={target,members,placements:Collections.placementState(groups,this.rows.map(r=>r.path),{scope,name:group.name})};
        menu.addItem(item=>item.setTitle(group.name+(count&&!checked?tr('（部分）'):'')).setChecked(checked).onClick(async()=>{
          if(this.busy||this.closed)return;
          this.busy=true;menu.hide();
          try{
            if(checked){
              const decision=await ldbPlanPaperRemoval(this.plugin,this.rows,target,'remove');
              if(decision.action==='trash'){
                await this.plugin.deleteRecords('library',this.rows,decision.memberships);this.close();new Notice(tr('已移至回收站'));
              }else if(decision.action==='remove')await this.plugin.changeMembership(this.rows,null,target,false,{...expected,allMemberships:decision.memberships});
            }else await this.plugin.changeMembership(this.rows,target,null,false,expected);
          }catch(e){new Notice(e.message,8000);this.close();}
          finally{this.busy=false;}
          // Reopen in place with the saved checkmarks, allowing another click to toggle back.
          this.show();
        }));
      }
    }
    if(!sections)menu.addItem(item=>item.setTitle(tr('请先在左侧新建分类或项目')).setDisabled(true));
    menu.showAtPosition(this.position,this.doc);
  }
}
// A choice of deletion scope is distinct from irreversible purge confirmation.
async function ldbPlanPaperRemoval(plugin,rows,from,intent){
  if(plugin.hasPendingEdit())throw new Error(tr('请先保存或取消编辑，并等待当前操作结束'));
  const groups=plugin.snapshot?.collections;
  const plan=groups?Collections.removalPlan(groups,rows.map(r=>r.path),from):null;
  if(intent==='remove'&&!plan?.sourceValid)throw new Error(tr('来源集合已改变，请刷新后重试'));
  const needsChoice=intent==='remove'?!plan.canRemove:plan?.shared;
  let action=intent;
  if(needsChoice)action=await new Promise(resolve=>{
    const modal=new PaperRemovalModal(plugin,rows,from,plan,intent,resolve);plugin.removalModal=modal;modal.open();
  });
  return {action:plugin.stopped?null:action,from,memberships:plan?.memberships||null};
}
class PaperRemovalModal extends Modal {
  constructor(plugin,rows,from,plan,intent,resolve){super(plugin.app);Object.assign(this,{plugin,rows:[...rows],from,plan,intent,resolve,action:null});}
  onOpen(){
    const last=this.intent==='remove';this.titleEl.setText(tr(last?'仅有一个归属':'选择删除范围'));
    this.contentEl.createEl('p',{text:tr(last?'所选文献中有文献仅属于这一个集合。是否将所选文献移至回收站？':'所选文献存在多个归属。请选择仅从当前集合移除，或将整篇文献移至回收站。')});
    const names=this.contentEl.createDiv('ldb-trash-confirm-list');
    for(const row of this.rows)names.createDiv({text:row.title?.trim()||row.filename||row.path});
    if(!last&&!this.plan.canRemove)this.contentEl.createEl('p',{text:tr(this.from?'所选文献中有文献仅属于当前集合，不能仅移除归属。':'当前视图没有可移除的集合；整篇回收会影响所有分类和写作项目。')});
    if(this.from)this.contentEl.createEl('p',{text:tr('当前集合：')+this.from.name});
    this.contentEl.createEl('p',{text:tr('整篇移至回收站后可恢复，所有归属和项目备注会一并恢复。')});
    const actions=this.contentEl.createDiv('ldb-actions');
    ldbButton(actions,tr('取消'),()=>this.close());
    if(!last&&this.plan.canRemove)ldbButton(actions,tr('仅从当前集合移除'),()=>this.choose('remove'));
    ldbButton(actions,tr('整篇移至回收站'),()=>this.choose('trash'),'mod-warning');
  }
  choose(action){this.action=action;this.close();}
  onClose(){if(this.plugin.removalModal===this)this.plugin.removalModal=null;this.contentEl.empty();this.resolve(this.action);}
}
function ldbOpenMoveMenu(plugin,rows,from,position,doc){
  if(plugin.hasPendingEdit()){new Notice(tr('请先保存或取消右侧编辑'));return;}
  plugin.membershipMenu?.close();
  const picker=new CollectionMoveMenu(plugin,rows,from,position,doc);plugin.membershipMenu=picker;
  picker.timer=setTimeout(()=>picker.show(),0);
}
class CollectionMoveMenu {
  constructor(plugin,rows,from,position,doc){Object.assign(this,{plugin,rows:[...rows],from,position,doc,closed:false});}
  close(){this.closed=true;clearTimeout(this.timer);this.menu?.hide();if(this.plugin.membershipMenu===this)this.plugin.membershipMenu=null;}
  show(){
    if(this.closed||this.plugin.stopped||this.doc?.hidden||this.plugin.hasPendingEdit())return;
    const menu=new Menu().setUseNativeMenu(!Platform?.isMobile);this.menu=menu;
    const groups=(this.plugin.snapshot.collections||[]).filter(g=>g.scope===this.from.scope);
    const source=groups.find(g=>g.name===this.from.name);
    if(!source){this.close();new Notice(tr('来源集合已被修改，请重新打开菜单'));return;}
    const expected={target:this.from,members:this.rows.map(row=>source.members.find(m=>m.path===row.path)?.notes??null),placements:Collections.placementState(groups,this.rows.map(r=>r.path),this.from)};
    for(const group of groups){
      const current=group.name===this.from.name;
      menu.addItem(item=>item.setTitle(group.name).setChecked(current).setDisabled(current).onClick(async()=>{
        if(this.closed)return;this.close();
        try{await this.plugin.changeMembership(this.rows,{scope:group.scope,name:group.name},this.from,true,expected);new Notice(tr('已移至 ')+group.name);}
        catch(e){new Notice(e.message,8000);}
      }));
    }
    if(groups.length<2)menu.addItem(item=>item.setTitle(tr('请先在左侧新建目标集合')).setDisabled(true));
    menu.showAtPosition(this.position,this.doc);
  }
}
function ldbPaperVenueMenu(view,button){
  if(view.saving||view.editing||view.readError||view.venueDraft)return;
  const row=view.detailRow;if(!row)return;
  const path=row.path,selected=row.venues||[],menu=new Menu().setUseNativeMenu(!Platform?.isMobile);
  const options=Engine.venueOptions([...(view.plugin.snapshot?.library||view.rows),row]);
  for(const name of options){
    const checked=selected.some(v=>v.toLocaleLowerCase()===name.toLocaleLowerCase());
    menu.addItem(item=>item.setTitle(name).setChecked(checked).onClick(async()=>{
      if(view.closed||view.detailRow?.path!==path||view.venueDraft||JSON.stringify(view.detailRow.venues||[])!==JSON.stringify(selected)){new Notice(tr('文献已改变，请重新打开 Venue 菜单'));return;}
      await view.saveQuickField('venues',checked?selected.filter(v=>v.toLocaleLowerCase()!==name.toLocaleLowerCase()):[...selected,name]);
    }));
  }
  if(options.length)menu.addSeparator();
  menu.addItem(item=>item.setTitle(tr('新建 Venue…')).onClick(()=>{
    if(view.closed||view.detailRow?.path!==path||view.saving||view.editing||view.readError)return;
    view.venueInput.hidden=false;view.venueInput.focus();
  }));
  const rect=button.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom},view.contentEl.ownerDocument);
  return menu;
}
class ProjectNoteModal extends Modal {
  constructor(plugin,project,row,before){super(plugin.app);Object.assign(this,{plugin,project,row,before});}
  onOpen(){
    if(this.plugin.hasPendingEdit()){new Notice(tr('请先保存或取消右侧编辑'));this.close();return;}
    this.titleEl.setText(this.project+tr(' · 项目备注'));
    const area=this.contentEl.createEl('textarea',{cls:'ldb-citation-input',attr:{rows:'8','aria-label':tr('项目备注')}});area.value=this.before;
    const error=this.contentEl.createDiv('ldb-form-error');
    const save=ldbButton(this.contentEl,tr('保存'),async()=>{save.disabled=true;try{await this.plugin.recordAction(()=>this.plugin.mutate(COLLECTION_SOURCE,text=>Collections.setNote(text,this.project,this.row.path,area.value,this.before)));this.close();}catch(e){error.setText(e.message);save.disabled=false;}},'mod-cta');
  }
  onClose(){this.contentEl.empty();}
}
class CitationExportModal extends Modal {
  constructor(plugin,rows,name,selected=[]){super(plugin.app);Object.assign(this,{plugin,rows:[...rows],name,selected:[...selected]});}
  onOpen(){
    this.closed=false;this.refreshToken=0;
    this.titleEl.setText(this.name+tr(' · 导出'));
    const controls=this.contentEl.createDiv('ldb-actions');
    const format=controls.createEl('select',{attr:{'aria-label':tr('引用导出格式')}});
    for(const [value,text] of [['bibtex','BibTeX (.bib)'],['apa','APA 7'],['ieee','IEEE'],['titles',tr('标题列表')]])format.createEl('option',{value,text});
    const scope=controls.createEl('select',{attr:{'aria-label':tr('导出范围')}});scope.createEl('option',{value:'all',text:tr('当前列表 · ')+this.rows.length+tr(' 篇')});
    if(this.selected.length)scope.createEl('option',{value:'selected',text:tr('选中文献 · ')+this.selected.length+tr(' 篇')});
    const count=this.contentEl.createEl('p'),preview=this.contentEl.createEl('textarea',{cls:'ldb-citation-input',attr:{rows:'12',readonly:'','aria-label':tr('导出预览')}});
    const missing=this.contentEl.createEl('details'),summary=missing.createEl('summary');
    const missingText=missing.createEl('pre',{cls:'ldb-export-missing'}),error=this.contentEl.createDiv('ldb-form-error');
    const actions=this.contentEl.createDiv('ldb-actions');let result=null;
    const copy=ldbButton(actions,tr('复制'),async()=>{try{
      if(result.html&&typeof ClipboardItem!=='undefined')await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([result.text],{type:'text/plain'}),'text/html':new Blob([result.html],{type:'text/html'})})]);
      else await navigator.clipboard.writeText(result.text);new Notice(tr('已复制'));
    }catch(e){preview.focus();preview.select();new Notice(tr('请按 ⌘C 复制预览文字'));}});
    const save=ldbButton(actions,tr('保存文件'),async()=>{
      save.disabled=true;try{
        const path=await this.plugin.saveExport(this.name+'-'+format.value,result.extension,result.content);
        if(result.missing.length)await this.plugin.saveExport(this.name+'-missing-references','txt',result.report+'\n');
        new Notice(tr('已保存到 ')+path+(result.missing.length?tr('\n缺失条目清单也已保存'):''),10000);
      }catch(e){error.setText(e.message);}finally{save.disabled=!result?.ready;}
    },'mod-cta');
    const missingSave=ldbButton(actions,tr('保存缺失清单'),async()=>{try{const path=await this.plugin.saveExport(this.name+'-missing-references','txt',result.report+'\n');new Notice(tr('已保存到 ')+path,8000);}catch(e){error.setText(e.message);}});
    const refresh=async()=>{
      const token=++this.refreshToken,chosenFormat=format.value,chosenRows=scope.value==='selected'?this.selected:this.rows;
      copy.disabled=save.disabled=true;missing.hidden=missingSave.hidden=true;preview.value='';error.setText('');
      count.setText(tr('正在读取引用…'));
      try{
        const rows=await this.plugin.ensureCitationRows(chosenRows,(done,total)=>{if(!this.closed&&token===this.refreshToken)count.setText(tr('识别引用 ')+done+' / '+total);},{titleOnly:chosenFormat==='titles',cancelled:()=>this.closed||token!==this.refreshToken});
        if(this.closed||token!==this.refreshToken)return;
        result=getCitations().exportRows(rows.map(r=>Organization.temporaryTitle(r)?{...r,title:''}:r),chosenFormat,this.name+' · '+format.selectedOptions[0].textContent);
        count.setText(result.ready+tr(' 篇可导出')+(result.missing.length?'，'+result.missing.length+tr(' 篇未识别'):''));
        preview.value=result.text;copy.disabled=save.disabled=!result.ready;missing.hidden=missingSave.hidden=!result.missing.length;
        summary.setText(tr`查看缺失条目（${result.missing.length}）`);missingText.setText(result.report);error.setText('');
      }catch(e){if(this.closed||token!==this.refreshToken)return;result=null;preview.value='';copy.disabled=save.disabled=true;missing.hidden=missingSave.hidden=true;error.setText(e.message);}
    };
    format.addEventListener('change',refresh);scope.addEventListener('change',refresh);refresh();
  }
  onClose(){this.closed=true;this.refreshToken++;this.contentEl.empty();}
}

// Optional, explicit DDL reuse at creation; selecting a name never merges records.
function ldbSharedDeadlineChoice(plugin,scope,parent,nameInput){
  let selection=null;
  const button=ldbButton(parent,tr('独立 DDL ▾'),e=>{
    const menu=new Menu().setUseNativeMenu(!Platform?.isMobile);
    menu.addItem(item=>item.setTitle(tr('独立 DDL')).setChecked(!selection).onClick(()=>{selection=null;button.setText(tr('独立 DDL ▾'));}));
    const choices=plugin.deadlineChoices(scope);
    if(choices.length){menu.addSeparator();menu.addItem(item=>item.setTitle(scope==='projects'?tr('使用已有投稿 Venue 的 DDL'):tr('使用已有写作项目的 DDL')).setIsLabel(true));}
    for(const choice of choices)menu.addItem(item=>item.setTitle(choice.name+' · '+Engine.displayDeadline(choice.deadline)).setChecked(selection?.scope===choice.scope&&selection?.name===choice.name).onClick(()=>{
      selection={...choice};button.setText(tr('共享 DDL：')+choice.name+' ▾');
      if(!nameInput.value.trim())nameInput.value=choice.name;
    }));
    const rect=e.currentTarget.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom},parent.ownerDocument);
  },'ldb-ddl-choice');
  return ()=>selection;
}
