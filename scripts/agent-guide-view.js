class AgentMcpModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;this.service=plugin.agentMcp;this.busy=false;}
  open(){if(this.plugin.agentGuide&&this.plugin.agentGuide!==this){this.plugin.agentGuide.modalEl.focus();return;}this.plugin.agentGuide=this;super.open();}
  onOpen(){this.modalEl.addClass('ldb-agent-modal');this.titleEl.setText('Agent MCP');this.render();}
  button(parent,label,action,cls=''){return ldbButton(parent,tr(label),async()=>{if(this.busy)return;this.busy=true;try{await action();if(this.contentEl.isConnected)this.render();}catch(e){new Notice(e.message,10000);}finally{this.busy=false;}},cls);}
  render(){
    const el=this.contentEl,s=this.service;el.empty();
    el.createEl('p',{text:tr('连接一次，之后直接告诉 Agent 你想整理什么。')});
    if(Platform.isMobile)el.createEl('p',{text:tr('手机和平板通过同步查看结果。MCP 服务在电脑上运行；本页不会启动 Agent。')});
    else{
      const steps=el.createEl('ol',{cls:'ldb-agent-steps'});
      for(const text of ['在电脑上开启 MCP，并保持此 Obsidian 文献库打开。','在支持 Streamable HTTP 的 Agent 中添加下方地址和 Bearer 密钥。配置格式以该客户端为准。','让 Agent 整理收件箱、补全空缺 TL;DR，或检查标签与重复文献。无需复制长指令。'])steps.createEl('li',{text:tr(text)});
      const row=el.createDiv('ldb-agent-controls');row.createSpan({text:tr(s.running?'已开启，仅本机可连接':'尚未开启')});
      this.button(row,s.running?'关闭 MCP':'开启 MCP',()=>s.running?s.stop():s.start(),s.running?'':'mod-cta');
      if(s.running){
        const connection=el.createDiv('ldb-agent-connection'),address=connection.createEl('input',{type:'text',attr:{readonly:'','aria-label':tr('MCP 地址')}});address.value=s.running.url;
        const actions=connection.createDiv('ldb-agent-controls');
        this.button(actions,'复制地址',()=>navigator.clipboard.writeText(s.running.url));
        this.button(actions,'复制密钥',()=>navigator.clipboard.writeText(s.running.token));
        this.button(actions,'复制 JSON 配置',()=>navigator.clipboard.writeText(JSON.stringify({mcpServers:{'literature-database':{url:s.running.url,headers:{Authorization:'Bearer '+s.running.token}}}},null,2)));
        el.createEl('p',{text:tr('密钥仅保存在这台设备，不随 iCloud 同步。分享配置前请移除密钥；关闭 MCP 会断开连接。'),cls:'ldb-agent-hint'});
      }
    }
    el.createEl('h3',{text:tr('可以让 Agent 做什么')});const examples=el.createEl('ul');
    for(const message of ['把 Zotero 导出的文献迁移到指定分类，保留 PDF、批注和导出的引用。','整理收件箱；给已归档但信息不完整的文献补篇名、TL;DR 和标签。','检查标签，提出分支重命名方案；在此查看影响后应用。','检查疑似重复、失效 PDF 和缺失元信息；为写作导出篇名或已有引用。'])examples.createEl('li',{text:tr(message)});
    const migration=el.createEl('details');migration.createEl('summary',{text:tr('从 Zotero 迁移')});
    migration.createEl('p',{text:tr('在 Zotero 中导出选中文献或文库，格式选 BibTeX，并勾选 Export Files。选择整个导出目录，再告诉 Agent 目标分类。原始文件不删除；无法对应的引用留空并报告。')});
    migration.createEl('p',{text:tr('保留 PDF 内嵌批注及同名批注文件。Zotero 独立笔记、未写入 PDF 的批注和原分组暂不迁移。'),cls:'ldb-agent-hint'});
    if(!Platform.isMobile&&Platform.isMacOS){
      const row=migration.createDiv('ldb-agent-controls');this.button(row,'选择导出目录',()=>s.chooseExport());
      if(s.grant){row.createSpan({text:tr`已授权 ${s.grant.files.length} 篇 PDF`});this.button(row,'撤销目录授权',()=>{s.grant=null;});migration.open=true;
        if(s.grant.warnings.length)migration.createEl('p',{text:tr`有 ${s.grant.warnings.length} 项导出对应问题，Agent 扫描时会逐项报告。`});}
    }else migration.createEl('p',{text:tr('导出目录迁移目前在 Mac 上使用；其他设备可先导入 PDF。')});
    if(s.proposals.length){
      const area=el.createDiv('ldb-agent-proposals');area.createEl('h3',{text:tr('待确认的标签方案')});
      for(const proposal of s.proposals){const item=area.createDiv('ldb-agent-proposal');item.createEl('strong',{text:TagTree.label(proposal.change.from)+' → '+TagTree.label(proposal.change.to)});item.createEl('p',{text:tr`涉及 ${proposal.change.affected.length} 篇文献；子标签一并改名，保留原来源颜色。`});
        const details=item.createEl('details');details.createEl('summary',{text:tr('查看变更')});for(const [a,b]of Object.entries(proposal.change.mapping))details.createDiv({text:TagTree.label(a)+' → '+TagTree.label(b)});
        const row=item.createDiv('ldb-agent-controls');this.button(row,'应用',()=>s.applyProposal(proposal.id),'mod-cta');this.button(row,'忽略',()=>{s.proposals=s.proposals.filter(p=>p.id!==proposal.id);});
      }
    }
    el.createEl('p',{text:tr('人工完成的文献、个人 Notes、书签、阅读状态与优先级不由 Agent 改动。引用只读取真实导出或由插件确定性识别，禁止 Agent 编造。审稿与投稿不向 MCP 开放。'),cls:'ldb-agent-hint'});
  }
  onClose(){if(this.plugin.agentGuide===this)this.plugin.agentGuide=null;this.contentEl.empty();}
}
