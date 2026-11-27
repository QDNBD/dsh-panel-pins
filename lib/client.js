/**
 * dsh-panel-pins — browser half.
 *
 * CLASSIC SCRIPT: registers a lazy factory with the page module loader (id must
 * equal the package name). The factory returns the Cordis plugin.
 *
 * What it does:
 *
 *   1. A "Panels" launcher (inspired by @weibaohui/dsh-sidebar-tidy). One row
 *      in the sidebar opens a floating menu listing every panel; clicking an
 *      item opens that panel. The panel rows themselves are hidden by default,
 *      so the session-history region gets the space back. Footer entries are
 *      deliberately left alone — only the global panel rows are collected.
 *
 *   2. Pin/unpin menu rows. The host sidebar renders one panel row per sidebar
 *      plugin, and the More menu (PanelMoreMenu) already passes `entries` (with
 *      `pinned` flags) and `onPinnedChange` into the `sidebar.panellist.actions`
 *      slot — but the official entry-customization bundle renders that slot
 *      "without pin controls", so there is no way to fold a panel away. This
 *      plugin registers its own component into the same slot and renders
 *      pin/unpin rows: unpinning a panel removes it from the panel list (the
 *      host's own filter: `id === "plugins" || !unpinned.includes(id)`) and it
 *      stays reachable through the More menu. The host keeps pins in a
 *      memory-only snapshot store (lost on restart), so we persist the
 *      unpinned id list in localStorage and re-assert it whenever the panel
 *      list changes.
 *
 *   3. Scrollable panel list. The host's `.panelList` has no max-height and no
 *      overflow, so many plugin rows squeeze the session-history region. We
 *      inject a stylesheet that caps the list height and lets it scroll.
 *      Selectors use `[class$="_panelList"]` (css-modules hash agnostic).
 *
 *   4. Fold/unfold the panel rows from the More menu (persisted in
 *      localStorage). Visibility only (el.style.display) — no elements are
 *      inserted into React-owned markup, and the state is re-applied on a light
 *      interval in case React swaps the nav node.
 *
 *   5. All icons are inline SVG (Fluent-style stroke), and rows copy the host
 *      menu-item metrics (16px icon, 8px gap, 13px text, hover fill, focus
 *      ring) via the host's design tokens, so they blend with official rows.
 *      NOTE: do NOT require('@deepseek-ai/dsh-client-ui-primitives') here —
 *      the dynamic plugin loader does not map that module name for third-party
 *      packages, and a failed require kills the whole plugin (verified by
 *      bisection: 0.1.0/0.2.2 without it render, 0.2.0/0.2.1 with it vanish).
 *
 *   6. Plugin entry rows ("family rows"), following weibaohui/dsh-sidebar-tidy
 *      v0.1.0 (https://github.com/weibaohui/dsh-sidebar-tidy). Third-party
 *      plugins inject clickable rows between the new-session anchor and the
 *      panel list (direct buttons or button-wrapping containers). These rows
 *      are listed in the Panels launcher under their own group and can be
 *      folded away with a persisted toggle (independent of the panel-row
 *      toggle). Items click the ORIGINAL button, so each panel's own open
 *      logic (including mid-column takeover views) is untouched. CONSTRAINT
 *      from the user: bottom (footer) entries are NEVER collected — only
 *      panel rows and plugin entry rows go into the menu; the settings area
 *      stays in place.
 *
 *   7. Compact footer ("sidebar tidy", ported from @weibaohui/dsh-sidebar-tidy).
 *      One CSS block, gated on an `html.dpp-tidy` class so it can be toggled
 *      without rewriting the stylesheet: caps the footer plugin-action area
 *      (`_footArea`) at 15vh with internal scrolling (user-tuned down from
 *      25vh), shrinks inline pairing QR codes to 132px, tightens the brand
 *      row (60→44px) and new-session margin, and compacts the cost-meter
 *      footer (`.cm-foot` 26px, balance box capped). Toggleable from the
 *      More menu and the Panels launcher; state persisted in localStorage,
 *      ON by default.
 *      CONSTRAINT: the footer ENTRIES themselves are never folded into the
 *      Panels launcher menu — they stay in place at the bottom; only their
 *      container gets a height cap and a scrollbar.
 *
 *   8. Settings page section ("面板收纳" column in the host Settings nav,
 *      registered into the `settings.section` slot — same contract as the
 *      official ui-settings-* packages). Exposes every tunable as a live
 *      control: the three fold/compact toggles plus height sliders for the
 *      panel list and the capped footer. All values persist in localStorage
 *      and are applied through CSS custom properties on <html>
 *      (--dpp-panel-list-max, --dpp-foot-max), so sliders update the sidebar
 *      instantly without touching the stylesheet.
 *
 *   9. Settings transfer (v1.2.0): the whole plugin-owned localStorage dump
 *      can be exported/imported four ways — clipboard copy/paste and a real
 *      file (Blob download / <input type="file">). Clipboard and file share
 *      one dump builder and one replay chain (applyImportedDump); the dump
 *      carries a `__plugin` sentinel so foreign JSON is rejected. A
 *      window.__dppTransfer hook exposes the closures for jsdom regression.
 *
 *  10. Active-row exemption (v1.3.2): a user-hidden row that IS the currently
 *      active panel stays visible — "you are on this page, its entry must not
 *      vanish" (the dsh-panellist hidden-vs-active rule). The active panel id
 *      comes from the host layout service (`panelInfo.getSnapshot()
 *      .activePanelId`), read through a throw-tolerant accessor — the service
 *      is deliberately NOT declared in `inject`, because a missing declared
 *      service parks the whole fiber (dsh-panellist's documented reason) and
 *      this plugin must load everywhere. Contract (mirrors dsh-panellist's
 *      hidden-vs-suppressed split): whitelist wins over everything; collection
 *      ON (rows-hidden / family fold) suppresses unconditionally — collected
 *      rows have the launcher drawer as their entry point, so the active row
 *      must not pop back and break the collection contract; collection OFF +
 *      an individually-hidden row is exempted while it IS the active panel
 *      and re-hides on leaving. Display-layer only: the hidden store is
 *      untouched, so the exemption never leaks into badge counts, menu
 *      listing or Alt+N. A window.__dppActive hook exposes the readers for
 *      the jsdom regression.
 *
 *  11. Feedback (v1.3.3): click-triggered entry points only, zero automatic
 *      reporting — a pre-filled GitHub issue (title + environment body via
 *      URL params), the host questionnaire (the shell's
 *      __DSH_CONTACT_CONFIG__ contract — contactFormUrl/contactSource with
 *      prefill_/hide_ fields — same as dsh-panel-layout's entry, falling
 *      back to the shell form), and a manual "copy diagnostics" that puts
 *      the settings dump + environment facts on the clipboard (pasting is
 *      the user's decision; never auto-attached to URLs). Entries: a
 *      Settings feedback card and one palette command. A
 *      window.__dppFeedback hook exposes the closures for the jsdom
 *      regression.
 *
 *  12. Settings-page bridge (v1.4.0): third-party plugins that register ONLY
 *      into `settings.section` have no reachable surface outside the host's
 *      private settings dialog — this plugin bridges them into the Panels
 *      launcher. For every candidate section it registers a `main`-keyed
 *      panel (`dpp-bridge-<section id>`) declaring its OWN child slot, and
 *      re-registers the section's component into that slot with the entry's
 *      TOP-LEVEL `inject`/`store`/`locale` fields (they sit next to
 *      `options`, never inside it — reading from `options` silently yields
 *      undefined and the page renders "English and half-broken", the
 *      dsh-panel-control 0.9.3 incident). Ownership heuristics (dsh-panel-
 *      control precedent): a section is skipped when its id, its id minus a
 *      `-settings` suffix, or a panel id ending in `-<base>` matches a
 *      sidebar panel, or its label equals a panel label; built-ins
 *      (account/general/models/agent-presets/plugins), our own section, and
 *      sections declaring their own `children` are excluded (the child slot
 *      name is globally owned; re-declaring throws). Launcher overlay gains
 *      a "设置页" group; clicking calls layout.selectPanel(bridgeId) — the
 *      back bar lands on selectPanel(null). Sync is add/remove reconciliation
 *      only (never re-register a live row): 120ms debounce, a
 *      settings.section subscription (retried until the slot is declared —
 *      pre-declaration subscribe sees nothing), and boot rescans at
 *      [350, 900, 2000, 4200, 8000, 15000]ms. Every slots.register is
 *      try/caught and paired-rolled-back: a thrown registration inside
 *      loader.start() aborts the whole boot, so the bridge may never leak
 *      one. Toggle: dsh-panel-pins:bridge (default ON), Settings card.
 *      Dispose pairs both registrations and, if a bridged page was active,
 *      first selectPanel(null) — selecting a key that no longer exists
 *      would strand the user on an empty column.
 *
 *  13. Host scroll-contract detection (v1.4.4): the rc.3-era structural
 *      overrides (b79 flex layout on _scrollArea, b83 workspace-root
 *      unbounding, b81 nav wheel hijack) broke DSH 0.2.2-rc.5, which
 *      redesigned the sidebar into a wheel hand-off: the viewport
 *      (_scrollArea, a GRID bound to scroll-handoff + a scroll-state
 *      container) scrolls the navigation away first, then the workspace
 *      list seat ([data-sidebar-list-area]) takes over via
 *      @container scroll-state(scrollable: bottom). Forcing flex onto the
 *      viewport and hijacking nav wheels left the workspace region unable
 *      to scroll ("左侧工作区滑动不下去"). The overrides now apply only
 *      under html.dpp-rc3, set at runtime when a _scrollArea exists WITHOUT
 *      the rc.5 data attributes; rc.5 hosts keep just the panel-list cap,
 *      which coexists with the hand-off (the capped list chains into the
 *      viewport natively). window.__dppScrollContract exposes the detected
 *      contract for the jsdom regression.
 *
 *      v1.4.4 reality check: on rc.5 the hand-off viewport handler
 *      preventDefaults EVERY wheel event over the sidebar nav and drives
 *      only the viewport — so the capped panel list could never scroll
 *      ITSELF ("工作区可以滑动、列表滑动不了").
 *
 *      v1.4.5 (b91) chained driver fixed the list but stopPropagation'd
 *      AND hand-wrote viewport.scrollTop, desynchronizing the host's
 *      gesture state — the workspace seat never took the hand-off again
 *      ("工作区又不行了"). v1.4.6 (b92) stepped aside entirely (no cap,
 *      no driver) — functional, but the user wanted the capped list back.
 *      v1.4.7 (b93) restored it with a LITE driver, but its EXTRA_CSS
 *      rewrite duplicated the `html.dpp-rc3 [class$="_regionArea"] {`
 *      line; inside a declaration block that stray selector is a bad
 *      declaration whose remnant consumption swallows balanced blocks
 *      until the next top-level ";" — and this stylesheet has none, so
 *      EVERY rule after that point (scrollbar theming, tidy footer cap,
 *      icon-only rows, .dpp-launcher, the whole overlay) was silently
 *      dropped by the CSS parser.
 *
 *      v1.4.8 (b94): v1.4.4's stylesheet, UNTOUCHED, plus the LITE
 *      driver. A step the capped list can absorb gets preventDefault +
 *      list scroll (the host handler exits on defaultPrevented — no
 *      double drive); a step AT the list boundary passes through
 *      completely untouched, so the host hand-off runs its own gesture
 *      transition with full event visibility. No stopPropagation, no
 *      viewport writes — the exact two things that broke the workspace
 *      in v1.4.5. rc.3 keeps its hijack; legacy hosts stay native.
 *
 *      v1.5.0 (b95): three additions, all built on public host contracts.
 *        1. Ctrl+K moves to the HOST shortcut service (ctx.shortcuts) when
 *           it exists: the binding becomes rebindable in Settings ->
 *           Shortcuts, and the host's own resolver decides whether the key
 *           may fire (focus region, open modals) instead of our target
 *           sniffing. The legacy document listener stays as the fallback
 *           for hosts without the service (>=0.2.0-rc.1) and for hosts that
 *           already bind Ctrl+K.
 *        2. Search understands PINYIN: literal text, pinyin initials
 *           (msn -> 面板收纳) and full pinyin (mianban -> 面板), plus a fuzzy
 *           subsequence tier. Matches are ranked inside their group, so the
 *           best hit is the first row (and Alt+1).
 *        3. Panels registered in the root `main` keyed slot by third-party
 *           plugins become reachable: the host enumerates that slot with
 *           ctx.slots.entries('main') (see ui-layout's retainMainPanels),
 *           and we open a panel with layout.selectPanel(key) — the same
 *           call the settings bridge already makes. A plugin that ships a
 *           full page but no sidebar row was installed and unreachable.
 */
window.__ModuleLoader__.load({
  id: 'dsh-panel-pins',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // ---------------------------------------------------------------------
    // v1.5.0 (b95): pinyin-aware matching.
    //
    // Until now a row was found by a lowercased substring of its label, so a
    // Chinese label could only be found by typing Chinese characters — which
    // is exactly what a pinyin keyboard cannot produce. The table below maps
    // the 3755 common simplified hanzi (GB2312 level 1) to their pinyin, so
    // one query can match three ways:
    //
    //   literal text   "面板收纳"
    //   pinyin initials "msn"      -> 面板收纳
    //   full pinyin    "mianban"   -> 面板
    //
    // The table is a compact "<han><ascii-pinyin>" record stream, generated
    // at build time (scripts/gen-pinyin.mjs); the plugin itself stays
    // dependency-free and the table is parsed once, lazily, on first use.
    // ---------------------------------------------------------------------
    const PINYIN_TABLE = '啊a阿a埃ai挨ai哎ai唉ai哀ai皑ai癌ai蔼ai矮ai艾ai碍ai爱ai隘ai鞍an氨an安an俺an按an暗an岸an胺an案an肮ang昂ang盎ang凹ao敖ao熬ao翱ao袄ao傲ao奥ao懊ao澳ao芭ba捌ba扒ba叭ba吧ba笆ba八ba疤ba巴ba拔ba跋ba靶ba把ba耙pa坝ba霸ba罢ba爸ba白bai柏bai百bai摆bai佰bai败bai拜bai稗bai斑ban班ban搬ban扳ban般ban颁ban板ban版ban扮ban拌ban伴ban瓣ban半ban办ban绊ban邦bang帮bang梆bang榜bang膀bang绑bang棒bang磅bang蚌bang镑bang傍bang谤bang苞bao胞bao包bao褒bao剥bao薄bao雹bao保bao堡bao饱bao宝bao抱bao报bao暴bao豹bao鲍bao爆bao杯bei碑bei悲bei卑bei北bei辈bei背bei贝bei钡bei倍bei狈bei备bei惫bei焙bei被bei奔ben苯ben本ben笨ben崩beng绷beng甭beng泵beng蹦beng迸beng逼bi鼻bi比bi鄙bi笔bi彼bi碧bi蓖bi蔽bi毕bi毙bi毖bi币bi庇bi痹bi闭bi敝bi弊bi必bi辟pi壁bi臂bi避bi陛bi鞭bian边bian编bian贬bian扁bian便bian变bian卞bian辨bian辩bian辫bian遍bian标biao彪biao膘biao表biao鳖bie憋bie别bie瘪bie彬bin斌bin濒bin滨bin宾bin摈bin兵bing冰bing柄bing丙bing秉bing饼bing炳bing病bing并bing玻bo菠bo播bo拨bo钵bo波bo博bo勃bo搏bo铂bo箔bo伯bo帛bo舶bo脖bo膊bo渤bo泊bo驳bo捕bu卜bu哺bu补bu埠bu不bu布bu步bu簿bo部bu怖bu擦ca猜cai裁cai材cai才cai财cai睬cai踩cai采cai彩cai菜cai蔡cai餐can参can蚕can残can惭can惨can灿can苍cang舱cang仓cang沧cang藏cang操cao糙cao槽cao曹cao草cao厕ce策ce侧ce册ce测ce层ceng蹭ceng插cha叉cha茬cha茶cha查cha碴cha搽cha察cha岔cha差cha诧cha拆chai柴chai豺chai搀chan掺chan蝉chan馋chan谗chan缠chan铲chan产chan阐chan颤chan昌chang猖chang场chang尝chang常chang长chang偿chang肠chang厂chang敞chang畅chang唱chang倡chang超chao抄chao钞chao朝chao嘲chao潮chao巢chao吵chao炒chao车che扯che撤che掣che彻che澈che郴chen臣chen辰chen尘chen晨chen忱chen沉chen陈chen趁chen衬chen撑cheng称cheng城cheng橙cheng成cheng呈cheng乘cheng程cheng惩cheng澄cheng诚cheng承cheng逞cheng骋cheng秤cheng吃chi痴chi持chi匙chi池chi迟chi弛chi驰chi耻chi齿chi侈chi尺chi赤chi翅chi斥chi炽chi充chong冲chong虫chong崇chong宠chong抽chou酬chou畴chou踌chou稠chou愁chou筹chou仇chou绸chou瞅chou丑chou臭chou初chu出chu橱chu厨chu躇chu锄chu雏chu滁chu除chu楚chu础chu储chu矗chu搐chu触chu处chu揣chuai川chuan穿chuan椽chuan传chuan船chuan喘chuan串chuan疮chuang窗chuang幢zhuang床chuang闯chuang创chuang吹chui炊chui捶chui锤chui垂chui春chun椿chun醇chun唇chun淳chun纯chun蠢chun戳chuo绰chuo疵ci茨ci磁ci雌ci辞ci慈ci瓷ci词ci此ci刺ci赐ci次ci聪cong葱cong囱cong匆cong从cong丛cong凑cou粗cu醋cu簇cu促cu蹿cuan篡cuan窜cuan摧cui崔cui催cui脆cui瘁cui粹cui淬cui翠cui村cun存cun寸cun磋cuo撮cuo搓cuo措cuo挫cuo错cuo搭da达da答da瘩da打da大da呆dai歹dai傣dai戴dai带dai殆dai代dai贷dai袋dai待dai逮dai怠dai耽dan担dan丹dan单dan郸dan掸dan胆dan旦dan氮dan但dan惮dan淡dan诞dan弹tan蛋dan当dang挡dang党dang荡dang档dang刀dao捣dao蹈dao倒dao岛dao祷dao导dao到dao稻dao悼dao道dao盗dao德de得de的de蹬deng灯deng登deng等deng瞪deng凳deng邓deng堤di低di滴di迪di敌di笛di狄di涤di翟zhai嫡di抵di底di地di蒂di第di帝di弟di递di缔di颠dian掂dian滇dian碘dian点dian典dian靛dian垫dian电dian佃dian甸dian店dian惦dian奠dian淀dian殿dian碉diao叼diao雕diao凋diao刁diao掉diao吊diao钓diao调tiao跌die爹die碟die蝶die迭die谍die叠die丁ding盯ding叮ding钉ding顶ding鼎ding锭ding定ding订ding丢diu东dong冬dong董dong懂dong动dong栋dong侗dong恫dong冻dong洞dong兜dou抖dou斗dou陡dou豆dou逗dou痘dou都dou督du毒du犊du独du读du堵du睹du赌du杜du镀du肚du度du渡du妒du端duan短duan锻duan段duan断duan缎duan堆dui兑dui队dui对dui墩dun吨dun蹲dun敦dun顿dun囤tun钝dun盾dun遁dun掇duo哆duo多duo夺duo垛duo躲duo朵duo跺duo舵duo剁duo惰duo堕duo蛾e峨e鹅e俄e额e讹e娥e恶e厄e扼e遏e鄂e饿e恩en而er儿er耳er尔er饵er洱er二er贰er发fa罚fa筏fa伐fa乏fa阀fa法fa珐fa藩fan帆fan番fan翻fan樊fan矾fan钒fan繁fan凡fan烦fan反fan返fan范fan贩fan犯fan饭fan泛fan坊fang芳fang方fang肪fang房fang防fang妨fang仿fang访fang纺fang放fang菲fei非fei啡fei飞fei肥fei匪fei诽fei吠fei肺fei废fei沸fei费fei芬fen酚fen吩fen氛fen分fen纷fen坟fen焚fen汾fen粉fen奋fen份fen忿fen愤fen粪fen丰feng封feng枫feng蜂feng峰feng锋feng风feng疯feng烽feng逢feng冯feng缝feng讽feng奉feng凤feng佛fo否fou夫fu敷fu肤fu孵fu扶fu拂fu辐fu幅fu氟fu符fu伏fu俘fu服fu浮fu涪fu福fu袱fu弗fu甫fu抚fu辅fu俯fu釜fu斧fu脯pu腑fu府fu腐fu赴fu副fu覆fu赋fu复fu傅fu付fu阜fu父fu腹fu负fu富fu讣fu附fu妇fu缚fu咐fu噶ga嘎ga该gai改gai概gai钙gai盖gai溉gai干gan甘gan杆gan柑gan竿gan肝gan赶gan感gan秆gan敢gan赣gan冈gang刚gang钢gang缸gang肛gang纲gang岗gang港gang杠gang篙gao皋gao高gao膏gao羔gao糕gao搞gao镐hao稿gao告gao哥ge歌ge搁ge戈ge鸽ge胳ge疙ge割ge革ge葛ge格ge蛤ha阁ge隔ge铬ge个ge各ge给gei根gen跟gen耕geng更geng庚geng羹geng埂geng耿geng梗geng工gong攻gong功gong恭gong龚gong供gong躬gong公gong宫gong弓gong巩gong汞gong拱gong贡gong共gong钩gou勾gou沟gou苟gou狗gou垢gou构gou购gou够gou辜gu菇gu咕gu箍gu估gu沽gu孤gu姑gu鼓gu古gu蛊gu骨gu谷gu股gu故gu顾gu固gu雇gu刮gua瓜gua剐gua寡gua挂gua褂gua乖guai拐guai怪guai棺guan关guan官guan冠guan观guan管guan馆guan罐guan惯guan灌guan贯guan光guang广guang逛guang瑰gui规gui圭gui硅gui归gui龟gui闺gui轨gui鬼gui诡gui癸gui桂gui柜gui跪gui贵gui刽gui辊gun滚gun棍gun锅guo郭guo国guo果guo裹guo过guo哈ha骸hai孩hai海hai氦hai亥hai害hai骇hai酣han憨han邯han韩han含han涵han寒han函han喊han罕han翰han撼han捍han旱han憾han悍han焊han汗han汉han夯hang杭hang航hang壕hao嚎hao豪hao毫hao郝hao好hao耗hao号hao浩hao呵he喝he荷he菏he核he禾he和he何he合he盒he貉mo阂he河he涸he赫he褐he鹤he贺he嘿hei黑hei痕hen很hen狠hen恨hen哼heng亨heng横heng衡heng恒heng轰hong哄hong烘hong虹hong鸿hong洪hong宏hong弘hong红hong喉hou侯hou猴hou吼hou厚hou候hou后hou呼hu乎hu忽hu瑚hu壶hu葫hu胡hu蝴hu狐hu糊hu湖hu弧hu虎hu唬hu护hu互hu沪hu户hu花hua哗hua华hua猾hua滑hua画hua划hua化hua话hua槐huai徊huai怀huai淮huai坏huai欢huan环huan桓huan还hai缓huan换huan患huan唤huan痪huan豢huan焕huan涣huan宦huan幻huan荒huang慌huang黄huang磺huang蝗huang簧huang皇huang凰huang惶huang煌huang晃huang幌huang恍huang谎huang灰hui挥hui辉hui徽hui恢hui蛔hui回hui毁hui悔hui慧hui卉hui惠hui晦hui贿hui秽hui会hui烩hui汇hui讳hui诲hui绘hui荤hun昏hun婚hun魂hun浑hun混hun豁huo活huo伙huo火huo获huo或huo惑huo霍huo货huo祸huo击ji圾ji基ji机ji畸ji稽ji积ji箕ji肌ji饥ji迹ji激ji讥ji鸡ji姬ji绩ji缉ji吉ji极ji棘ji辑ji籍ji集ji及ji急ji疾ji汲ji即ji嫉ji级ji挤ji几ji脊ji己ji蓟ji技ji冀ji季ji伎ji祭ji剂ji悸ji济ji寄ji寂ji计ji记ji既ji忌ji际ji妓ji继ji纪ji嘉jia枷jia夹jia佳jia家jia加jia荚jia颊jia贾jia甲jia钾jia假jia稼jia价jia架jia驾jia嫁jia歼jian监jian坚jian尖jian笺jian间jian煎jian兼jian肩jian艰jian奸jian缄jian茧jian检jian柬jian碱jian硷jian拣jian捡jian简jian俭jian剪jian减jian荐jian槛kan鉴jian践jian贱jian见jian键jian箭jian件jian健jian舰jian剑jian饯jian渐jian溅jian涧jian建jian僵jiang姜jiang将jiang浆jiang江jiang疆jiang蒋jiang桨jiang奖jiang讲jiang匠jiang酱jiang降jiang蕉jiao椒jiao礁jiao焦jiao胶jiao交jiao郊jiao浇jiao骄jiao娇jiao嚼jiao搅jiao铰jiao矫jiao侥jiao脚jiao狡jiao角jiao饺jiao缴jiao绞jiao剿jiao教jiao酵jiao轿jiao较jiao叫jiao窖jiao揭jie接jie皆jie秸jie街jie阶jie截jie劫jie节jie桔ju杰jie捷jie睫jie竭jie洁jie结jie解jie姐jie戒jie藉jie芥jie界jie借jie介jie疥jie诫jie届jie巾jin筋jin斤jin金jin今jin津jin襟jin紧jin锦jin仅jin谨jin进jin靳jin晋jin禁jin近jin烬jin浸jin尽jin劲jin荆jing兢jing茎jing睛jing晶jing鲸jing京jing惊jing精jing粳jing经jing井jing警jing景jing颈jing静jing境jing敬jing镜jing径jing痉jing靖jing竟jing竞jing净jing炯jiong窘jiong揪jiu究jiu纠jiu玖jiu韭jiu久jiu灸jiu九jiu酒jiu厩jiu救jiu旧jiu臼jiu舅jiu咎jiu就jiu疚jiu鞠ju拘ju狙ju疽ju居ju驹ju菊ju局ju咀zui矩ju举ju沮ju聚ju拒ju据ju巨ju具ju距ju踞ju锯ju俱ju句ju惧ju炬ju剧ju捐juan鹃juan娟juan倦juan眷juan卷juan绢juan撅jue攫jue抉jue掘jue倔jue爵jue觉jue决jue诀jue绝jue均jun菌jun钧jun军jun君jun峻jun俊jun竣jun浚jun郡jun骏jun喀ka咖ka卡ka咯ge开kai揩kai楷kai凯kai慨kai刊kan堪kan勘kan坎kan砍kan看kan康kang慷kang糠kang扛kang抗kang亢kang炕kang考kao拷kao烤kao靠kao坷ke苛ke柯ke棵ke磕ke颗ke科ke壳ke咳hai可ke渴ke克ke刻ke客ke课ke肯ken啃ken垦ken恳ken坑keng吭keng空kong恐kong孔kong控kong抠kou口kou扣kou寇kou枯ku哭ku窟ku苦ku酷ku库ku裤ku夸kua垮kua挎kua跨kua胯kua块kuai筷kuai侩kuai快kuai宽kuan款kuan匡kuang筐kuang狂kuang框kuang矿kuang眶kuang旷kuang况kuang亏kui盔kui岿kui窥kui葵kui奎kui魁kui傀kui馈kui愧kui溃kui坤kun昆kun捆kun困kun括kuo扩kuo廓kuo阔kuo垃la拉la喇la蜡la腊la辣la啦la莱lai来lai赖lai蓝lan婪lan栏lan拦lan篮lan阑lan兰lan澜lan谰lan揽lan览lan懒lan缆lan烂lan滥lan琅lang榔lang狼lang廊lang郎lang朗lang浪lang捞lao劳lao牢lao老lao佬lao姥lao酪lao烙lao涝lao勒le乐le雷lei镭lei蕾lei磊lei累lei儡lei垒lei擂lei肋lei类lei泪lei棱leng楞leng冷leng厘li梨li犁li黎li篱li狸li离li漓li理li李li里li鲤li礼li莉li荔li吏li栗li丽li厉li励li砾li历li利li傈li例li俐li痢li立li粒li沥li隶li力li璃li哩li俩lia联lian莲lian连lian镰lian廉lian怜lian涟lian帘lian敛lian脸lian链lian恋lian炼lian练lian粮liang凉liang梁liang粱liang良liang两liang辆liang量liang晾liang亮liang谅liang撩liao聊liao僚liao疗liao燎liao寥liao辽liao潦liao了liao撂liao镣liao廖liao料liao列lie裂lie烈lie劣lie猎lie琳lin林lin磷lin霖lin临lin邻lin鳞lin淋lin凛lin赁lin吝lin拎lin玲ling菱ling零ling龄ling铃ling伶ling羚ling凌ling灵ling陵ling岭ling领ling另ling令ling溜liu琉liu榴liu硫liu馏liu留liu刘liu瘤liu流liu柳liu六liu龙long聋long咙long笼long窿long隆long垄long拢long陇long楼lou娄lou搂lou篓lou漏lou陋lou芦lu卢lu颅lu庐lu炉lu掳lu卤lu虏lu鲁lu麓lu碌lu露lu路lu赂lu鹿lu潞lu禄lu录lu陆lu戮lu驴lv吕lv铝lv侣lv旅lv履lv屡lv缕lv虑lv氯lv律lv率lv滤lv绿lv峦luan挛luan孪luan滦luan卵luan乱luan掠lve略lve抡lun轮lun伦lun仑lun沦lun纶lun论lun萝luo螺luo罗luo逻luo锣luo箩luo骡luo裸luo落luo洛luo骆luo络luo妈ma麻ma玛ma码ma蚂ma马ma骂ma嘛ma吗ma埋mai买mai麦mai卖mai迈mai脉mai瞒man馒man蛮man满man蔓man曼man慢man漫man谩man芒mang茫mang盲mang氓mang忙mang莽mang猫mao茅mao锚mao毛mao矛mao铆mao卯mao茂mao冒mao帽mao貌mao贸mao么me玫mei枚mei梅mei酶mei霉mei煤mei没mei眉mei媒mei镁mei每mei美mei昧mei寐mei妹mei媚mei门men闷men们men萌meng蒙meng檬meng盟meng锰meng猛meng梦meng孟meng眯mi醚mi靡mi糜mi迷mi谜mi弥mi米mi秘mi觅mi泌mi蜜mi密mi幂mi棉mian眠mian绵mian冕mian免mian勉mian娩mian缅mian面mian苗miao描miao瞄miao藐miao秒miao渺miao庙miao妙miao蔑mie灭mie民min抿min皿min敏min悯min闽min明ming螟ming鸣ming铭ming名ming命ming谬miu摸mo摹mo蘑mo模mo膜mo磨mo摩mo魔mo抹mo末mo莫mo墨mo默mo沫mo漠mo寞mo陌mo谋mou牟mu某mou拇mu牡mu亩mu姆mu母mu墓mu暮mu幕mu募mu慕mu木mu目mu睦mu牧mu穆mu拿na哪na呐na钠na那na娜na纳na氖nai乃nai奶nai耐nai奈nai南nan男nan难nan囊nang挠nao脑nao恼nao闹nao淖nao呢ne馁nei内nei嫩nen能neng妮ni霓ni倪ni泥ni尼ni拟ni你ni匿ni腻ni逆ni溺ni蔫nian拈nian年nian碾nian撵nian捻nian念nian娘niang酿niang鸟niao尿niao捏nie聂nie孽nie啮nie镊nie镍nie涅nie您nin柠ning狞ning凝ning宁ning拧ning泞ning牛niu扭niu钮niu纽niu脓nong浓nong农nong弄nong奴nu努nu怒nu女nv暖nuan虐nve疟nve挪nuo懦nuo糯nuo诺nuo哦o欧ou鸥ou殴ou藕ou呕ou偶ou沤ou啪pa趴pa爬pa帕pa怕pa琶pa拍pai排pai牌pai徘pai湃pai派pai攀pan潘pan盘pan磐pan盼pan畔pan判pan叛pan乓pang庞pang旁pang耪pang胖pang抛pao咆pao刨pao炮pao袍pao跑pao泡pao呸pei胚pei培pei裴pei赔pei陪pei配pei佩pei沛pei喷pen盆pen砰peng抨peng烹peng澎peng彭peng蓬peng棚peng硼peng篷peng膨peng朋peng鹏peng捧peng碰peng坯pi砒pi霹pi批pi披pi劈pi琵pi毗pi啤pi脾pi疲pi皮pi匹pi痞pi僻pi屁pi譬pi篇pian偏pian片pian骗pian飘piao漂piao瓢piao票piao撇pie瞥pie拼pin频pin贫pin品pin聘pin乒ping坪ping苹ping萍ping平ping凭ping瓶ping评ping屏ping坡po泼po颇po婆po破po魄po迫po粕po剖pou扑pu铺pu仆pu莆pu葡pu菩pu蒲pu埔pu朴pu圃pu普pu浦pu谱pu曝pu瀑pu期qi欺qi栖qi戚qi妻qi七qi凄qi漆qi柒qi沏qi其qi棋qi奇qi歧qi畦qi崎qi脐qi齐qi旗qi祈qi祁qi骑qi起qi岂qi乞qi企qi启qi契qi砌qi器qi气qi迄qi弃qi汽qi泣qi讫qi掐qia恰qia洽qia牵qian扦qian钎qian铅qian千qian迁qian签qian仟qian谦qian乾qian黔qian钱qian钳qian前qian潜qian遣qian浅qian谴qian堑qian嵌qian欠qian歉qian枪qiang呛qiang腔qiang羌qiang墙qiang蔷qiang强qiang抢qiang橇qiao锹qiao敲qiao悄qiao桥qiao瞧qiao乔qiao侨qiao巧qiao鞘qiao撬qiao翘qiao峭qiao俏qiao窍qiao切qie茄qie且qie怯qie窃qie钦qin侵qin亲qin秦qin琴qin勤qin芹qin擒qin禽qin寝qin沁qin青qing轻qing氢qing倾qing卿qing清qing擎qing晴qing氰qing情qing顷qing请qing庆qing琼qiong穷qiong秋qiu丘qiu邱qiu球qiu求qiu囚qiu酋qiu泅qiu趋qu区qu蛆qu曲qu躯qu屈qu驱qu渠qu取qu娶qu龋qu趣qu去qu圈quan颧quan权quan醛quan泉quan全quan痊quan拳quan犬quan券quan劝quan缺que炔que瘸que却que鹊que榷que确que雀que裙qun群qun然ran燃ran冉ran染ran瓤rang壤rang攘rang嚷rang让rang饶rao扰rao绕rao惹re热re壬ren仁ren人ren忍ren韧ren任ren认ren刃ren妊ren纫ren扔reng仍reng日ri戎rong茸rong蓉rong荣rong融rong熔rong溶rong容rong绒rong冗rong揉rou柔rou肉rou茹ru蠕ru儒ru孺ru如ru辱ru乳ru汝ru入ru褥ru软ruan阮ruan蕊rui瑞rui锐rui闰run润run若ruo弱ruo撒sa洒sa萨sa腮sai鳃sai塞sai赛sai三san叁san伞san散san桑sang嗓sang丧sang搔sao骚sao扫sao嫂sao瑟se色se涩se森sen僧seng莎sha砂sha杀sha刹cha沙sha纱sha傻sha啥sha煞sha筛shai晒shai珊shan苫shan杉shan山shan删shan煽shan衫shan闪shan陕shan擅shan赡shan膳shan善shan汕shan扇shan缮shan墒shang伤shang商shang赏shang晌shang上shang尚shang裳shang梢shao捎shao稍shao烧shao芍shao勺shao韶shao少shao哨shao邵shao绍shao奢she赊she蛇she舌she舍she赦she摄she射she慑she涉she社she设she砷shen申shen呻shen伸shen身shen深shen娠shen绅shen神shen沈shen审shen婶shen甚shen肾shen慎shen渗shen声sheng生sheng甥sheng牲sheng升sheng绳sheng省sheng盛sheng剩sheng胜sheng圣sheng师shi失shi狮shi施shi湿shi诗shi尸shi虱shi十shi石shi拾shi时shi什shen食shi蚀shi实shi识shi史shi矢shi使shi屎shi驶shi始shi式shi示shi士shi世shi柿shi事shi拭shi誓shi逝shi势shi是shi嗜shi噬shi适shi仕shi侍shi释shi饰shi氏shi市shi恃shi室shi视shi试shi收shou手shou首shou守shou寿shou授shou售shou受shou瘦shou兽shou蔬shu枢shu梳shu殊shu抒shu输shu叔shu舒shu淑shu疏shu书shu赎shu孰shu熟shu薯shu暑shu曙shu署shu蜀shu黍shu鼠shu属shu术shu述shu树shu束shu戍shu竖shu墅shu庶shu数shu漱shu恕shu刷shua耍shua摔shuai衰shuai甩shuai帅shuai栓shuan拴shuan霜shuang双shuang爽shuang谁shui水shui睡shui税shui吮shun瞬shun顺shun舜shun说shuo硕shuo朔shuo烁shuo斯si撕si嘶si思si私si司si丝si死si肆si寺si嗣si四si伺si似si饲si巳si松song耸song怂song颂song送song宋song讼song诵song搜sou艘sou擞sou嗽sou苏su酥su俗su素su速su粟su僳su塑su溯su宿su诉su肃su酸suan蒜suan算suan虽sui隋sui随sui绥sui髓sui碎sui岁sui穗sui遂sui隧sui祟sui孙sun损sun笋sun蓑suo梭suo唆suo缩suo琐suo索suo锁suo所suo塌ta他ta它ta她ta塔ta獭ta挞ta蹋ta踏ta胎tai苔tai抬tai台tai泰tai酞tai太tai态tai汰tai坍tan摊tan贪tan瘫tan滩tan坛tan檀tan痰tan潭tan谭tan谈tan坦tan毯tan袒tan碳tan探tan叹tan炭tan汤tang塘tang搪tang堂tang棠tang膛tang唐tang糖tang倘tang躺tang淌tang趟tang烫tang掏tao涛tao滔tao绦tao萄tao桃tao逃tao淘tao陶tao讨tao套tao特te藤teng腾teng疼teng誊teng梯ti剔ti踢ti锑ti提ti题ti蹄ti啼ti体ti替ti嚏ti惕ti涕ti剃ti屉ti天tian添tian填tian田tian甜tian恬tian舔tian腆tian挑tiao条tiao迢tiao眺tiao跳tiao贴tie铁tie帖tie厅ting听ting烃ting汀ting廷ting停ting亭ting庭ting挺ting艇ting通tong桐tong酮tong瞳tong同tong铜tong彤tong童tong桶tong捅tong筒tong统tong痛tong偷tou投tou头tou透tou凸tu秃tu突tu图tu徒tu途tu涂tu屠tu土tu吐tu兔tu湍tuan团tuan推tui颓tui腿tui蜕tui褪tui退tui吞tun屯tun臀tun拖tuo托tuo脱tuo鸵tuo陀tuo驮tuo驼tuo椭tuo妥tuo拓tuo唾tuo挖wa哇wa蛙wa洼wa娃wa瓦wa袜wa歪wai外wai豌wan弯wan湾wan玩wan顽wan丸wan烷wan完wan碗wan挽wan晚wan皖wan惋wan宛wan婉wan万wan腕wan汪wang王wang亡wang枉wang网wang往wang旺wang望wang忘wang妄wang威wei巍wei微wei危wei韦wei违wei桅wei围wei唯wei惟wei为wei潍wei维wei苇wei萎wei委wei伟wei伪wei尾wei纬wei未wei蔚wei味wei畏wei胃wei喂wei魏wei位wei渭wei谓wei尉wei慰wei卫wei瘟wen温wen蚊wen文wen闻wen纹wen吻wen稳wen紊wen问wen嗡weng翁weng瓮weng挝wo蜗wo涡wo窝wo我wo斡wo卧wo握wo沃wo巫wu呜wu钨wu乌wu污wu诬wu屋wu无wu芜wu梧wu吾wu吴wu毋wu武wu五wu捂wu午wu舞wu伍wu侮wu坞wu戊wu雾wu晤wu物wu勿wu务wu悟wu误wu昔xi熙xi析xi西xi硒xi矽xi晰xi嘻xi吸xi锡xi牺xi稀xi息xi希xi悉xi膝xi夕xi惜xi熄xi烯xi溪xi汐xi犀xi檄xi袭xi席xi习xi媳xi喜xi铣xian洗xi系xi隙xi戏xi细xi瞎xia虾xia匣xia霞xia辖xia暇xia峡xia侠xia狭xia下xia厦sha夏xia吓xia掀xian锨xian先xian仙xian鲜xian纤xian咸xian贤xian衔xian舷xian闲xian涎xian弦xian嫌xian显xian险xian现xian献xian县xian腺xian馅xian羡xian宪xian陷xian限xian线xian相xiang厢xiang镶xiang香xiang箱xiang襄xiang湘xiang乡xiang翔xiang祥xiang详xiang想xiang响xiang享xiang项xiang巷xiang橡xiang像xiang向xiang象xiang萧xiao硝xiao霄xiao削xiao哮xiao嚣ao销xiao消xiao宵xiao淆xiao晓xiao小xiao孝xiao校xiao肖xiao啸xiao笑xiao效xiao楔xie些xie歇xie蝎xie鞋xie协xie挟xie携xie邪xie斜xie胁xie谐xie写xie械xie卸xie蟹xie懈xie泄xie泻xie谢xie屑xie薪xin芯xin锌xin欣xin辛xin新xin忻xin心xin信xin衅xin星xing腥xing猩xing惺xing兴xing刑xing型xing形xing邢xing行xing醒xing幸xing杏xing性xing姓xing兄xiong凶xiong胸xiong匈xiong汹xiong雄xiong熊xiong休xiu修xiu羞xiu朽xiu嗅xiu锈xiu秀xiu袖xiu绣xiu墟xu戌xu需xu虚xu嘘xu须xu徐xu许xu蓄xu酗xu叙xu旭xu序xu畜chu恤xu絮xu婿xu绪xu续xu轩xuan喧xuan宣xuan悬xuan旋xuan玄xuan选xuan癣xuan眩xuan绚xuan靴xue薛xue学xue穴xue雪xue血xue勋xun熏xun循xun旬xun询xun寻xun驯xun巡xun殉xun汛xun训xun讯xun逊xun迅xun压ya押ya鸦ya鸭ya呀ya丫ya芽ya牙ya蚜ya崖ya衙ya涯ya雅ya哑ya亚ya讶ya焉yan咽yan阉yan烟yan淹yan盐yan严yan研yan蜒yan岩yan延yan言yan颜yan阎yan炎yan沿yan奄yan掩yan眼yan衍yan演yan艳yan堰yan燕yan厌yan砚yan雁yan唁yan彦yan焰yan宴yan谚yan验yan殃yang央yang鸯yang秧yang杨yang扬yang佯yang疡yang羊yang洋yang阳yang氧yang仰yang痒yang养yang样yang漾yang邀yao腰yao妖yao瑶yao摇yao尧yao遥yao窑yao谣yao姚yao咬yao舀yao药yao要yao耀yao椰ye噎ye耶ye爷ye野ye冶ye也ye页ye掖ye业ye叶ye曳ye腋ye夜ye液ye一yi壹yi医yi揖yi铱yi依yi伊yi衣yi颐yi夷yi遗yi移yi仪yi胰yi疑yi沂yi宜yi姨yi彝yi椅yi蚁yi倚yi已yi乙yi矣yi以yi艺yi抑yi易yi邑yi屹yi亿yi役yi臆yi逸yi肄yi疫yi亦yi裔yi意yi毅yi忆yi义yi益yi溢yi诣yi议yi谊yi译yi异yi翼yi翌yi绎yi茵yin荫yin因yin殷yin音yin阴yin姻yin吟yin银yin淫yin寅yin饮yin尹yin引yin隐yin印yin英ying樱ying婴ying鹰ying应ying缨ying莹ying萤ying营ying荧ying蝇ying迎ying赢ying盈ying影ying颖ying硬ying映ying哟yo拥yong佣yong臃yong痈yong庸yong雍yong踊yong蛹yong咏yong泳yong涌yong永yong恿yong勇yong用yong幽you优you悠you忧you尤you由you邮you铀you犹you油you游you酉you有you友you右you佑you釉you诱you又you幼you迂yu淤yu于yu盂yu榆yu虞yu愚yu舆yu余yu俞yu逾yu鱼yu愉yu渝yu渔yu隅yu予yu娱yu雨yu与yu屿yu禹yu宇yu语yu羽yu玉yu域yu芋yu郁yu吁xu遇yu喻yu峪yu御yu愈yu欲yu狱yu育yu誉yu浴yu寓yu裕yu预yu豫yu驭yu鸳yuan渊yuan冤yuan元yuan垣yuan袁yuan原yuan援yuan辕yuan园yuan员yuan圆yuan猿yuan源yuan缘yuan远yuan苑yuan愿yuan怨yuan院yuan曰yue约yue越yue跃yue钥yao岳yue粤yue月yue悦yue阅yue耘yun云yun郧yun匀yun陨yun允yun运yun蕴yun酝yun晕yun韵yun孕yun匝za砸za杂za栽zai哉zai灾zai宰zai载zai再zai在zai咱zan攒zan暂zan赞zan赃zang脏zang葬zang遭zao糟zao凿zao藻zao枣zao早zao澡zao蚤zao躁zao噪zao造zao皂zao灶zao燥zao责ze择ze则ze泽ze贼zei怎zen增zeng憎zeng曾ceng赠zeng扎zha喳zha渣zha札zha轧ya铡zha闸zha眨zha栅shan榨zha咋za乍zha炸zha诈zha摘zhai斋zhai宅zhai窄zhai债zhai寨zhai瞻zhan毡zhan詹zhan粘nian沾zhan盏zhan斩zhan辗nian崭zhan展zhan蘸zhan栈zhan占zhan战zhan站zhan湛zhan绽zhan樟zhang章zhang彰zhang漳zhang张zhang掌zhang涨zhang杖zhang丈zhang帐zhang账zhang仗zhang胀zhang瘴zhang障zhang招zhao昭zhao找zhao沼zhao赵zhao照zhao罩zhao兆zhao肇zhao召zhao遮zhe折zhe哲zhe蛰zhe辙zhe者zhe锗zhe蔗zhe这zhe浙zhe珍zhen斟zhen真zhen甄zhen砧zhen臻zhen贞zhen针zhen侦zhen枕zhen疹zhen诊zhen震zhen振zhen镇zhen阵zhen蒸zheng挣zheng睁zheng征zheng狰zheng争zheng怔zheng整zheng拯zheng正zheng政zheng帧zhen症zheng郑zheng证zheng芝zhi枝zhi支zhi吱zhi蜘zhi知zhi肢zhi脂zhi汁zhi之zhi织zhi职zhi直zhi植zhi殖zhi执zhi值zhi侄zhi址zhi指zhi止zhi趾zhi只zhi旨zhi纸zhi志zhi挚zhi掷zhi至zhi致zhi置zhi帜zhi峙zhi制zhi智zhi秩zhi稚zhi质zhi炙zhi痔zhi滞zhi治zhi窒zhi中zhong盅zhong忠zhong钟zhong衷zhong终zhong种zhong肿zhong重zhong仲zhong众zhong舟zhou周zhou州zhou洲zhou诌zhou粥zhou轴zhou肘zhou帚zhou咒zhou皱zhou宙zhou昼zhou骤zhou珠zhu株zhu蛛zhu朱zhu猪zhu诸zhu诛zhu逐zhu竹zhu烛zhu煮zhu拄zhu瞩zhu嘱zhu主zhu著zhu柱zhu助zhu蛀zhu贮zhu铸zhu筑zhu住zhu注zhu祝zhu驻zhu抓zhua爪zhua拽zhuai专zhuan砖zhuan转zhuan撰zhuan赚zhuan篆zhuan桩zhuang庄zhuang装zhuang妆zhuang撞zhuang壮zhuang状zhuang椎zhui锥zhui追zhui赘zhui坠zhui缀zhui谆zhun准zhun捉zhuo拙zhuo卓zhuo桌zhuo琢zhuo茁zhuo酌zhuo啄zhuo着zhe灼zhuo浊zhuo兹zi咨zi资zi姿zi滋zi淄zi孜zi紫zi仔zai籽zi滓zi子zi自zi渍zi字zi鬃zong棕zong踪zong宗zong综zong总zong纵zong邹zou走zou奏zou揍zou租zu足zu卒zu族zu祖zu诅zu阻zu组zu钻zuan纂zuan嘴zui醉zui最zui罪zui尊zun遵zun昨zuo左zuo佐zuo柞zha做zuo作zuo坐zuo座zuo亍chu丌qi兀wu丐gai廿nian卅sa丕pi亘gen丞cheng鬲ge孬nao噩e丨gun禺yu丿pie匕bi乇tuo夭yao爻yao卮zhi氐di囟xin胤yin馗kui毓yu睾gao鼗tao丶zhu亟ji鼐nai乜nie乩ji亓qi芈mi孛bei啬se嘏gu仄ze厍she厝cuo厣yan厥jue厮si靥ye赝yan匚fang叵po匦gui匮kui匾bian赜ze卦gua卣you刂dao刈yi刎wen刭jing刳ku刿gui剀kai剌la剞ji剡yan剜wan蒯kuai剽piao劂jue劁qiao劐huo劓yi冂jiong罔wang亻ren仃ding仉zhang仂le仨sa仡yi仫mu仞ren伛yu仳pi伢ya佤wa仵wu伥chang伧chen伉kang伫zhu佞ning佧ka攸you佚yi佝gou佟tong佗tuo伲ni伽jia佶ji佴er侑you侉kua侃kan侏zhu佾yi佻tiao侪chai佼jiao侬nong侔mou俦chou俨yan俪li俅qiu俚li俣yu俜ping俑yong俟si俸feng倩qian偌ruo俳pai倬zhuo倏shu倮luo倭wo俾bi倜ti倌guan倥kong倨ju偾fen偃yan偕xie偈ji偎wei偬zong偻lv傥tang傧bin傩nuo傺chi僖xi儆jing僭jian僬jiao僦jiu僮tong儇xuan儋dan仝tong氽tun佘she佥qian俎zu龠yue汆cuan籴di兮xi巽xun黉hong馘guo冁chan夔kui勹bao匍pu訇hong匐fu凫fu夙su兕si亠tou兖yan亳bo衮gun袤mao亵xie脔luan裒pou禀bing嬴ying蠃luo羸lei冫bing冱hu冽lie冼xian凇song冖mi冢zhong冥ming讠yan讦jie讧hong讪shan讴ou讵ju讷ne诂gu诃he诋di诏zhao诎qu诒yi诓kuang诔lei诖gua诘jie诙hui诜shen诟gou诠quan诤zheng诨hun诩xu诮qiao诰gao诳kuang诶ei诹zou诼zhuo诿wei谀yu谂shen谄chan谇sui谌chen谏jian谑xue谒ye谔e谕yu谖xuan谙an谛di谘zi谝pian谟mo谠dang谡su谥shi谧mi谪zhe谫jian谮zen谯qiao谲jue谳yan谵zhan谶chen卩jie卺jin阝fu阢wu阡qian阱jing阪ban阽yan阼zuo陂bei陉xing陔gai陟zhi陧nie陬zou陲chui陴pi隈wei隍huang隗wei隰xi邗han邛qiong邝kuang邙mang邬wu邡fang邴bing邳pi邶bei邺ye邸di邰tai郏jia郅zhi邾zhu郐kuai郄xi郇huan郓yun郦li郢ying郜gao郗chi郛fu郫pi郯tan郾yan鄄juan鄢yan鄞yin鄣zhang鄱po鄯shan鄹zou酃ling酆feng刍chu奂huan劢mai劬qu劭shao劾he哿ge勐meng勖xu勰xie叟sou燮xie矍jue廴yin凵kan凼dang鬯chang厶si弁bian畚ben巯qiu坌ben垩e垡fa塾shu墼ji壅yong壑he圩xu圬wu圪ge圳zhen圹kuang圮pi圯yi坜li圻qi坂ban坩gan垅long坫dian垆lu坼che坻di坨tuo坭ni坶mu坳ao垭ya垤die垌dong垲kai埏shan垧shang垴nao垓gai垠yin埕cheng埘shi埚guo埙xun埒lie垸yuan埴zhi埯an埸yi埤pi埝nian堋peng堍tu埽sao埭dai堀ku堞die堙yin塄leng堠hou塥ge塬yuan墁man墉yong墚liang墀chi馨xin鼙pi懿yi艹ao艽jiao艿nai芏du芊qian芨ji芄wan芎xiong芑qi芗xiang芙fu芫yuan芸yun芾fei芰ji苈li苊e苣ju芘pi芷zhi芮rui苋xian苌chang苁cong芩qin芴wu芡qian芪qi芟shan苄bian苎zhu芤kou苡yi茉mo苷gan苤pie茏long茇ba苜mu苴ju苒ran苘qing茌chi苻fu苓ling茑niao茚yin茆mao茔ying茕qiong苠min苕tiao茜qian荑yi荛rao荜bi茈zi莒ju茼tong茴hui茱zhu莛ting荞qiao茯fu荏ren荇xing荃quan荟hui荀xun茗ming荠qi茭jiao茺chong茳jiang荦luo荥ying荨qian茛gen荩jin荬mai荪sun荭hong荮zhou莰kan荸bi莳shi莴wo莠you莪e莓mei莜you莅li荼tu莶xian莩piao荽sui莸you荻di莘shen莞wan莨lang莺ying莼chun菁jing萁qi菥xi菘song堇jin萘nai萋qi菝ba菽shu菖chang萜tie萸yu萑huan萆bi菔fu菟tu萏dan萃cui菸yan菹zu菪dang菅jian菀wan萦ying菰gu菡han葜qia葑feng葚shen葙xiang葳wei蒇chan蒈kai葺qi蒉kui葸xi萼e葆bao葩pa葶ting蒌lou蒎pai萱xuan葭jia蓁zhen蓍shi蓐ru蓦mo蒽en蓓bei蓊weng蒿hao蒺ji蓠li蒡bang蒹jian蒴shuo蒗lang蓥ying蓣yu蔌su甍meng蔸dou蓰xi蔹lian蔟cu蔺lin蕖qu蔻kou蓿xu蓼liao蕙hui蕈xun蕨jue蕤rui蕞zui蕺ji瞢meng蕃fan蕲qi蕻hong薤xie薨hong薇wei薏yi蕹weng薮sou薜bi薅hao薹tai薷ru薰xun藓xian藁gao藜li藿huo蘧qu蘅heng蘩fan蘖nie蘼mi廾gong弈yi夼kuang奁lian耷da奕yi奚xi奘zang匏pao尢wang尥liao尬ga尴gan扌shou扪men抟tuan抻chen拊fu拚pin拗ao拮jie挢jiao拶za挹yi捋lv捃jun掭tian揶ye捱ai捺na掎ji掴guo捭bai掬ju掊pou捩lie掮qian掼guan揲die揸zha揠ya揿qin揄yu揞an揎xuan摒bing揆kui掾yuan摅shu摁en搋chuai搛jian搠shuo搌zhan搦nuo搡sang摞luo撄ying摭zhi撖han摺zhe撷xie撸lu撙zun撺cuan擀gan擐huan擗pi擤xing擢zhuo攉huo攥zuan攮nang弋yi忒te甙dai弑shi卟bu叱chi叽ji叩kou叨dao叻le吒zha吖a吆yao呋fu呒fu呓yi呔dai呖li呃e吡bi呗bai呙guo吣qin吲yin咂za咔ka呷xia呱gua呤ling咚dong咛ning咄duo呶nao呦you咝si哐kuang咭ji哂shen咴hui哒da咧lie咦yi哓xiao哔bi呲ci咣guang哕yue咻xiu咿yi哌pai哙kuai哚duo哜ji咩mie咪mi咤zha哝nong哏gen哞mou唛mai哧chi唠lao哽geng唔wu哳zha唢suo唣zao唏xi唑zuo唧ji唪feng啧ze喏nuo喵miao啉lin啭zhuan啁zhou啕tao唿hu啐cui唼sha唷yo啖dan啵bo啶ding啷lang唳li唰shua啜chuo喋die嗒da喃nan喱li喹kui喈jie喁yong喟kui啾jiu嗖sou喑yin啻chi嗟jie喽lou喾ku喔wo喙hui嗪qin嗷ao嗉su嘟du嗑ke嗫nie嗬he嗔chen嗦suo嗝ge嗄a嗯ng嗥hao嗲dia嗳ai嗌ai嗍suo嗨hei嗵tong嗤chi辔pei嘞le嘈cao嘌piao嘁qi嘤ying嘣beng嗾sou嘀di嘧mi嘭peng噘jue嘹liao噗pu嘬zuo噍jiao噢o噙qin噜lu噌ceng噔deng嚆hao噤jin噱jue噫yi噻sai噼pi嚅ru嚓cha嚯huo囔nang囗wei囝jian囡nan囵lun囫hu囹ling囿you圄yu圊qing圉yu圜huan帏wei帙zhi帔pei帑tang帱chou帻ze帼guo帷wei幄wo幔man幛zhang幞fu幡fan岌ji屺qi岍qian岐qi岖qu岈ya岘xian岙ao岑cen岚lan岜ba岵hu岢ke岽dong岬jia岫xiu岱dai岣gou峁mao岷min峄yi峒dong峤qiao峋xun峥zheng崂lao崃lai崧song崦yan崮gu崤xiao崞guo崆kong崛jue嵘rong崾yao崴wai崽zai嵬wei嵛yu嵯cuo嵝lou嵫zi嵋mei嵊sheng嵩song嵴ji嶂zhang嶙lin嶝deng豳bin嶷yi巅dian彳chi彷pang徂cu徇xun徉yang後hou徕lai徙xi徜chang徨huang徭yao徵zhi徼jiao衢qu彡shan犭quan犰qiu犴an犷guang犸ma狃niu狁yun狎xia狍pao狒fei狨rong狯kuai狩shou狲sun狴bi狷juan猁li狳yu猃xian狺yin狻suan猗yi猓guo猡luo猊ni猞she猝cu猕mi猢hu猹cha猥wei猬wei猸mei猱nao獐zhang獍jing獗jue獠liao獬xie獯xun獾huan舛chuan夥huo飧sun夤yin夂zhi饣shi饧tang饨tun饩xi饪ren饫yu饬chi饴yi饷xiang饽bo馀yu馄hun馇cha馊sou馍mo馐xiu馑jin馓san馔zhuan馕nang庀pi庑wu庋gui庖pao庥xiu庠xiang庹tuo庵an庾yu庳bi赓geng廒ao廑jin廛chan廨xie廪lin膺ying忄xin忉dao忖cun忏chan怃wu忮zhi怄ou忡chong忤wu忾kai怅chang怆chuang忪song忭bian忸niu怙hu怵chu怦peng怛da怏yang怍zuo怩ni怫fu怊chao怿yi怡yi恸tong恹yan恻ce恺kai恂xun恪ke恽yun悖bei悚song悭qian悝kui悃kun悒yi悌ti悛quan惬qie悻xing悱fei惝chang惘wang惆chou惚hu悴cui愠yun愦kui愕e愣leng惴zhui愀qiao愎bi愫su慊qie慵yong憬jing憔qiao憧chong憷chu懔lin懵meng忝tian隳hui闩shuan闫yan闱wei闳hong闵min闶kang闼ta闾lv阃kun阄jiu阆lang阈yu阊chang阋xi阌wen阍hun阏e阒qu阕que阖he阗tian阙que阚kan丬pan爿pan戕qiang氵shui汔qi汜si汊cha沣feng沅yuan沐mu沔mian沌dun汨mi汩gu汴bian汶wen沆hang沩wei泐le泔gan沭shu泷long泸lu泱yang泗si沲duo泠ling泖mao泺luo泫xuan泮pan沱tuo泓hong泯min泾jing洹huan洧wei洌lie浃jia浈zhen洇yin洄hui洙zhu洎ji洫xu浍hui洮tao洵xun洚jiang浏liu浒hu浔xun洳ru涑su浯wu涞lai涠wei浞zhuo涓juan涔cen浜bang浠xi浼mei浣huan渚zhu淇qi淅xi淞song渎du涿zhuo淠pi渑mian淦gan淝fei淙cong渖shen涫guan渌lu涮shuan渫xie湮yan湎mian湫qiu溲sou湟huang溆xu湓pen湔jian渲xuan渥wo湄mei滟yan溱zhen溘ke滠she漭mang滢ying溥pu溧li溽ru溻ta溷hun滗bi溴xiu滏fu溏tang滂pang溟ming潢huang潆ying潇xiao漤lan漕cao滹hu漯luo漶huan潋lian潴zhu漪yi漉lu漩xuan澉gan澍shu澌si潸shan潲shao潼tong潺chan濑lai濉sui澧li澹dan澶chan濂lian濡ru濮pu濞bi濠hao濯zhuo瀚han瀣xie瀛ying瀹yue瀵fen灏hao灞ba宀mian宄gui宕dang宓mi宥you宸chen甯ning骞qian搴qian寤wu寮liao褰qian寰huan蹇jian謇jian辶chuo迓ya迕wu迥jiong迮ze迤yi迩er迦jia迳jing迨dai逅hou逄pang逋bu逦li逑qiu逍xiao逖ti逡qun逵kui逶wei逭huan逯lu遄chuan遑huang遒qiu遐xia遨ao遘gou遢ta遛liu暹xian遴lin遽ju邂xie邈miao邃sui邋la彐ji彗hui彖tuan彘zhi尻kao咫zhi屐ji屙e孱chan屣xi屦ju羼chan弪jing弩nu弭mi艴fu弼bi鬻yu屮che妁shuo妃fei妍yan妩wu妪yu妣bi妗jin姊zi妫gui妞niu妤yu姒si妲da妯zhou姗shan妾qie娅ya娆rao姝shu娈luan姣jiao姘pin姹cha娌li娉ping娲wa娴xian娑suo娣di娓wei婀e婧jing婊biao婕jie娼chang婢bi婵chan胬nu媪ao媛yuan婷ting婺wu媾gou嫫mo媲pi嫒ai嫔pin媸chi嫠li嫣yan嫱qiang嫖piao嫦chang嫘lei嫜zhang嬉xi嬗shan嬖bi嬲niao嬷mo孀shuang尕ga尜ga孚fu孥nu孳zi孑jie孓jue孢bao驵zang驷si驸fu驺zou驿yi驽nu骀dai骁xiao骅hua骈pian骊li骐qi骒ke骓zhui骖can骘zhi骛wu骜ao骝liu骟shan骠piao骢cong骣chan骥ji骧xiang纟si纡yu纣zhou纥he纨wan纩kuang纭yun纰pi纾shu绀gan绁xie绂fu绉zhou绋fu绌chu绐dai绔ku绗hang绛jiang绠geng绡xiao绨ti绫ling绮qi绯fei绱shang绲gun缍duo绶shou绺liu绻quan绾wan缁zi缂ke缃xiang缇ti缈miao缋hui缌si缏bian缑gou缒zhui缗min缙jin缜zhen缛ru缟gao缡li缢yi缣jian缤bin缥piao缦man缧lei缪miu缫sao缬xie缭liao缯zeng缰jiang缱qian缲qiao缳huan缵zuan幺yao畿ji巛chuan甾zai邕yong玎ding玑ji玮wei玢bin玟min珏jue珂ke珑long玷dian玳dai珀po珉min珈jia珥er珙gong顼xu琊ya珩heng珧yao珞luo玺xi珲hui琏lian琪qi瑛ying琦qi琥hu琨kun琰yan琮cong琬wan琛chen琚ju瑁mao瑜yu瑗yuan瑕xia瑙nao瑷ai瑭tang瑾jin璜huang璎ying璀cui璁cong璇xuan璋zhang璞pu璨can璩qu璐lu璧bi瓒zan璺wen韪wei韫yun韬tao杌wu杓shao杞qi杈cha杩ma枥li枇pi杪miao杳yao枘rui枧jian杵chu枨cheng枞cong枭xiao枋fang杷pa杼zhu柰nai栉zhi柘zhe栊long柩jiu枰ping栌lu柙xia枵xiao柚you枳zhi柝tuo栀zhi柃ling枸gou柢di栎li柁tuo柽cheng栲kao栳lao桠ya桡rao桎zhi桢zhen桄guang桤qi梃ting栝gua桕jiu桦hua桁heng桧gui桀jie栾luan桊juan桉an栩xu梵fan梏gu桴fu桷jue梓zi桫suo棂ling楮chu棼fen椟du椠qian棹zhao椤luo棰chui椋liang椁guo楗jian棣di椐ju楱cou椹shen楠nan楂zha楝lian榄lan楫ji榀pin榘ju楸qiu椴duan槌chui榇chen榈lv槎cha榉ju楦xuan楣mei楹ying榛zhen榧fei榻ta榫sun榭xie槔gao榱cui槁gao槊shuo槟bin榕rong槠zhu榍xie槿jin樯qiang槭qi樗chu樘cheng橥zhu槲hu橄gan樾yue檠qing橐tuo橛jue樵qiao檎qin橹lu樽zun樨xi橘ju橼yuan檑lei檐yan檩lin檗bo檫cha猷you獒ao殁mo殂cu殇shang殄tian殒yun殓lian殍piao殚dan殛ji殡bin殪yi轫ren轭e轱gu轲ke轳lu轵zhi轶yi轸zhen轷hu轹li轺yao轼shi轾zhi辁quan辂lu辄zhe辇nian辋wang辍chuo辎zi辏cou辘lu辚lin軎wei戋jian戗qiang戛jia戟ji戢ji戡kan戥deng戤gai戬jian臧zang瓯ou瓴ling瓿bu甏beng甑zeng甓pi攴pu旮ga旯la旰gan昊hao昙tan杲gao昃ze昕xin昀yun炅jiong曷he昝zan昴mao昱yu昶chang昵ni耆qi晟sheng晔ye晁chao晏yan晖hui晡bu晗han晷gui暄xuan暌kui暧ai暝ming暾tun曛xun曜yao曦xi曩nang贲ben贳shi贶kuang贻yi贽zhi赀zi赅gai赆jin赈zhen赉lai赇qiu赍ji赕dan赙fu觇chan觊ji觋xi觌di觎yu觏gou觐jin觑qu牮jian犟jiang牝pin牦mao牯gu牾wu牿gu犄ji犋ju犍jian犏pian犒kao挈qie挲sa掰bai搿ge擘bo耄mao毪mu毳cui毽jian毵san毹shu氅chang氇lu氆pu氍qu氕pie氘dao氙xian氚chuan氡dong氩ya氤yin氪ke氲yun攵pu敕chi敫jiao牍du牒die牖you爰yuan虢guo刖yue肟wo肜rong肓huang肼jing朊ruan肽tai肱gong肫zhun肭na肴yao肷qian胧long胨dong胩ka胪lu胛jia胂shen胄zhou胙zuo胍gua胗zhen朐qu胝zhi胫jing胱guang胴dong胭yan脍kuai脎sa胲gai胼pian朕zhen脒mi豚tun脶luo脞cuo脬pao脘wan脲niao腈jing腌yan腓fei腴yu腙zong腚ding腱jian腠cou腩nan腼mian腽wa腭e腧shu塍cheng媵ying膈ge膂lv膑bin滕teng膣zhi膪chuai臌gu朦meng臊sao膻shan臁lian膦lin欤yu欷xi欹qi歃sha歆xin歙xi飑biao飒sa飓ju飕sou飙biao飚biao殳shu彀gou毂gu觳hu斐fei齑ji斓lan於wu旆pei旄mao旃zhan旌jing旎ni旒liu旖yi炀yang炜wei炖dun炝qiang炻shi烀hu炷zhu炫xuan炱tai烨ye烊yang焐wu焓han焖men焯chao焱yan煳hu煜yu煨wei煅duan煲bao煊xuan煸bian煺tui熘liu熳man熵shang熨yun熠yi燠yu燔fan燧sui燹xian爝jue爨cuan灬huo焘tao煦xu熹xi戾li戽hu扃jiong扈hu扉fei礻shi祀si祆xian祉zhi祛qu祜hu祓fu祚zuo祢mi祗zhi祠ci祯zhen祧tiao祺qi禅chan禊xi禚zhuo禧xi禳rang忑te忐tan怼dui恝jia恚hui恧nv恁nen恙yang恣zi悫que愆qian愍min慝te憩qi憝dui懋mao懑men戆gang肀yu聿yu沓ta泶xue淼miao矶ji矸gan砀dang砉hua砗che砘dun砑ya斫zhuo砭bian砜feng砝fa砹ai砺li砻long砟zha砼tong砥di砬la砣tuo砩fu硎xing硭mang硖xia硗qiao砦zhai硐dong硇nao硌ge硪wo碛qi碓dui碚bei碇ding碜chen碡zhou碣jie碲di碹xuan碥bian磔zhe磙gun磉sang磬qing磲qu礅dun磴deng礓jiang礤ca礞meng礴bo龛kan黹zhi黻fu黼fu盱xu眄mian眍kou盹dun眇miao眈dan眚sheng眢yuan眙yi眭sui眦zi眵chi眸mou睐lai睑jian睇di睃suo睚ya睨ni睢sui睥pi睿rui瞍sou睽kui瞀mao瞌ke瞑ming瞟piao瞠cheng瞰kan瞵lin瞽gu町ting畀bi畎quan畋tian畈fan畛zhen畲she畹wan疃tuan罘fu罡gang罟gu詈li罨yan罴pi罱lan罹li羁ji罾zeng盍he盥guan蠲juan钅jin钆ga钇yi钋po钊zhao钌liao钍tu钏chuan钐shan钔men钗chai钕nv钚bu钛tai钜ju钣ban钤qian钫fang钪kang钭tou钬huo钯ba钰yu钲zheng钴gu钶ke钷po钸bu钹bo钺yue钼mu钽tan钿dian铄shuo铈shi铉xuan铊ta铋bi铌ni铍pi铎duo铐kao铑lao铒er铕you铖cheng铗jia铙nao铘ye铛dang铞diao铟yin铠kai铢zhu铤ting铥diu铧hua铨quan铪ha铩sha铫yao铮zheng铯se铳chong铴tang铵an铷ru铹lao铼lai铽te铿keng锃zeng锂li锆gao锇e锉cuo锊lve锍liu锎kai锏jian锒lang锓qin锔ju锕a锖qiang锘nuo锛ben锝de锞ke锟kun锢gu锪huo锫pei锩juan锬tan锱zi锲qie锴kai锶si锷e锸cha锼sou锾huan锿ai镂lou锵qiang镄fei镅mei镆mo镉ge镌juan镎na镏liu镒yi镓jia镔bin镖biao镗tang镘man镙luo镛yong镞zu镟xuan镝di镡tan镢jue镤pu镥lu镦dun镧lan镨pu镩cuan镪qiang镫deng镬huo镯zhuo镱yi镲cha镳biao锺zhong矧shen矬cuo雉zhi秕bi秭zi秣mo秫shu稆lv嵇ji稃fu稂lang稞ke稔ren稹zhen稷ji穑se黏nian馥fu穰rang皈gui皎jiao皓hao皙xi皤po瓞die瓠hu甬yong鸠jiu鸢yuan鸨bao鸩zhen鸪gu鸫dong鸬lu鸲qu鸱chi鸶si鸸er鸷zhi鸹gua鸺xiu鸾luan鹁bo鹂li鹄hu鹆yu鹇xian鹈ti鹉wu鹋miao鹌an鹎bei鹑chun鹕hu鹗e鹚ci鹛mei鹜wu鹞yao鹣jian鹦ying鹧zhe鹨liu鹩liao鹪jiao鹫jiu鹬yu鹱hu鹭lu鹳guan疒ne疔ding疖jie疠li疝shan疬li疣you疳gan疴ke疸dan痄zha疱pao疰zhu痃xuan痂jia痖ya痍yi痣zhi痨lao痦wu痤cuo痫xian痧sha瘃zhu痱fei痼gu痿wei瘐yu瘀yu瘅dan瘌la瘗yi瘊hou瘥chai瘘lou瘕jia瘙sao瘛chi瘼mo瘢ban瘠ji癀huang瘭biao瘰luo瘿ying瘵zhai癃long瘾yin瘳chou癍ban癞lai癔yi癜dian癖pi癫dian癯qu翊yi竦song穸xi穹qiong窀zhun窆bian窈yao窕tiao窦dou窠ke窬yu窨xun窭ju窳yu衤yi衩cha衲na衽ren衿jin袂mei袢pan裆dang袷jia袼ge裉ken裢lian裎cheng裣lian裥jian裱biao褚chu裼ti裨bi裾ju裰duo褡da褙bei褓bao褛lv褊bian褴lan褫chi褶zhe襁qiang襦ru襻pan疋pi胥xu皲jun皴cun矜jin耒lei耔zi耖chao耜si耠huo耢lao耥tang耦ou耧lou耩jiang耨nou耱mo耋die耵ding聃dan聆ling聍ning聒guo聩kui聱ao覃qin顸han颀qi颃hang颉jie颌he颍ying颏ke颔han颚e颛zhuan颞nie颟man颡sang颢hao颥ru颦pin虍hu虔qian虬qiu虮ji虿chai虺hui虼ge虻meng蚨fu蚍pi蚋rui蚬xian蚝hao蚧jie蚣gong蚪dou蚓yin蚩chi蚶han蛄gu蚵ke蛎li蚰you蚺ran蚱zha蚯qiu蛉ling蛏cheng蚴you蛩qiong蛱jia蛲nao蛭zhi蛳si蛐qu蜓ting蛞kuo蛴qi蛟jiao蛘yang蛑mou蜃shen蜇zhe蛸shao蜈wu蜊li蜍chu蜉fu蜣qiang蜻qing蜞qi蜥xi蜮yu蜚fei蜾guo蝈guo蜴yi蜱pi蜩tiao蜷quan蜿wan螂lang蜢meng蝽chun蝾rong蝻nan蝠fu蝰kui蝌ke蝮fu螋sou蝓yu蝣you蝼lou蝤you蝙bian蝥mao螓qin螯ao螨man蟒mang蟆ma螈yuan螅xi螭chi螗tang螃pang螫shi蟥huang螬cao螵piao螳tang蟋xi蟓xiang螽zhong蟑zhang蟀shuai蟊mao蟛peng蟪hui蟠pan蟮shan蠖huo蠓meng蟾chan蠊lian蠛mie蠡li蠹du蠼qu缶fou罂ying罄qing罅xia舐shi竺zhu竽yu笈ji笃du笄ji笕jian笊zhao笫zi笏hu筇qiong笸po笪da笙sheng笮ze笱gou笠li笥si笤tiao笳jia笾bian笞chi筘kou筚bi筅xian筵yan筌quan筝zheng筠yun筮shi筻gang筢pa筲shao筱xiao箐jing箦ze箧qie箸zhu箬ruo箝qian箨tuo箅bi箪dan箜kong箢yuan箫xiao箴zhen篑kui篁huang篌hou篝gou篚fei篥li篦bi篪chi簌su篾mie篼dou簏lu簖duan簋gui簟dian簪zan簦deng簸bo籁lai籀zhou臾yu舁yu舂chong舄xi臬nie衄nv舡chuan舢shan舣yi舭bi舯zhong舨ban舫fang舸ge舻lu舳zhu舴ze舾xi艄shao艉wei艋meng艏shou艚cao艟chong艨meng衾qin袅niao袈jia裘qiu裟sha襞bi羝di羟qiang羧suo羯jie羰tang羲xi籼xian敉mi粑ba粝li粜tiao粞xi粢zi粲can粼lin粽zong糁shen糇hou糌zan糍ci糈xu糅rou糗qiu糨jiang艮gen暨ji羿yi翎ling翕xi翥zhu翡fei翦jian翩pian翮he翳yi糸mi絷zhi綦qi綮qing繇yao纛dao麸fu麴qu赳jiu趄ju趔lie趑zi趱zan赧nan赭zhe豇jiang豉chi酊ding酐gan酎zhou酏yi酤gu酢cu酡tuo酰xian酩ming酯zhi酽yan酾shai酲cheng酴tu酹lei醌kun醅pei醐hu醍ti醑xu醢hai醣tang醪lao醭bu醮jiao醯xi醵ju醴li醺xun豕shi鹾cuo趸dun跫qiong踅xue蹙cu蹩bie趵bo趿ta趼jian趺fu跄qiang跖zhi跗fu跚shan跞luo跎tuo跏jia跛bo跆tai跬kui跷qiao跸bi跣xian跹xian跻ji跤jiao踉liang跽ji踔chuo踝huai踟chi踬zhi踮dian踣bo踯zhi踺jian蹀die踹chuai踵zhong踽ju踱duo蹉cuo蹁pian蹂rou蹑nie蹒pan蹊qi蹰chu蹶jue蹼pu蹯fan蹴cu躅zhu躏lin躔chan躐lie躜zuan躞xie豸zhi貂diao貊mo貅xiu貘mo貔pi斛hu觖jue觞shang觚gu觜zi觥gong觫su觯zhi訾zi謦qing靓liang雩yu雳li雯wen霆ting霁ji霈pei霏fei霎sha霪yin霭ai霰xian霾mai龀chen龃ju龅bao龆tiao龇zi龈yin龉yu龊chuo龌wo黾mian鼋yuan鼍tuo隹zhui隼sun隽jun雎ju雒luo瞿qu雠chou銎qiong銮luan鋈wu錾zan鍪mou鏊ao鎏liu鐾bei鑫xin鱿you鲂fang鲅ba鲆ping鲇nian鲈lu稣su鲋fu鲎hou鲐tai鲑gui鲒jie鲔wei鲕er鲚ji鲛jiao鲞xiang鲟xun鲠geng鲡li鲢lian鲣jian鲥shi鲦tiao鲧gun鲨sha鲩huan鲫ji鲭qing鲮ling鲰zou鲱fei鲲kun鲳chang鲴gu鲵ni鲶nian鲷diao鲺shi鲻zi鲼fen鲽die鳄e鳅qiu鳆fu鳇huang鳊bian鳋sao鳌ao鳍qi鳎ta鳏guan鳐yao鳓le鳔biao鳕xue鳗man鳘min鳙yong鳜jue鳝shan鳟zun鳢li靼da鞅yang鞑da鞒qiao鞔man鞯jian鞫ju鞣rou鞲gou鞴bei骱jie骰tou骷ku鹘hu骶di骺hou骼ge髁ke髀bi髅lou髂qia髋kuan髌bin髑du魅mei魃ba魇yan魉liang魈xiao魍wang魑chi飨xiang餍yan餮tie饕tao饔yong髟biao髡kun髦mao髯ran髫tiao髻ji髭zi髹xiu鬈quan鬏jiu鬓bin鬟huan鬣lie麽mo麾hui縻mi麂ji麇jun麈zhu麋mi麒qi鏖ao麝she麟lin黛dai黜chu黝you黠xia黟yi黢qu黩du黧li黥qing黪can黯an鼢fen鼬you鼯wu鼹yan鼷xi鼽qiu鼾han齄zha'
    let PINYIN_MAP = null
    /** char -> pinyin (lowercase, toneless). Built once, on first search. */
    function pinyinMap() {
      if (PINYIN_MAP) return PINYIN_MAP
      PINYIN_MAP = Object.create(null)
      const raw = PINYIN_TABLE
      let i = 0
      while (i < raw.length) {
        const ch = raw[i]
        i += 1
        let py = ''
        while (i < raw.length && raw.charCodeAt(i) < 128) {
          py += raw[i]
          i += 1
        }
        if (py) PINYIN_MAP[ch] = py
      }
      return PINYIN_MAP
    }
    function isHanzi(ch) {
      const code = ch.charCodeAt(0)
      return code >= 0x4e00 && code <= 0x9fff
    }
    /** Per-label sound forms, cached: the same labels are matched on every keystroke. */
    const SOUND_CACHE = new Map()
    function soundForms(text) {
      const hit = SOUND_CACHE.get(text)
      if (hit) return hit
      const map = pinyinMap()
      let latin = ''
      let initials = ''
      for (const ch of text) {
        if (isHanzi(ch)) {
          const py = map[ch]
          if (!py) continue
          latin += py
          initials += py[0]
        } else if (/[a-z0-9]/i.test(ch)) {
          latin += ch.toLowerCase()
          initials += ch.toLowerCase()
        } else if (ch === ' ' || ch === '-' || ch === '_' || ch === '.') {
          latin += ' '
        }
      }
      const forms = { latin: latin, initials: initials }
      if (SOUND_CACHE.size > 512) SOUND_CACHE.clear()
      SOUND_CACHE.set(text, forms)
      return forms
    }
    /**
     * Score tiers. Literal hits always outrank sound hits, and a match at the
     * start of the label outranks one buried in the middle.
     */
    const MATCH_SCORE = {
      EXACT: 1000,
      PREFIX: 900,
      INITIAL_EXACT: 860,
      PINYIN_PREFIX: 820,
      SUBSTRING: 700,
      INITIAL_SUBSTRING: 620,
      PINYIN_SUBSTRING: 540,
      FUZZY_TEXT: 320,
      FUZZY_INITIAL: 260,
    }
    /**
     * Subsequence match with a gap penalty: every needle character must
     * appear in order. 0 means "no subsequence".
     */
    function fuzzyScore(hay, needle) {
      let at = 0
      let gaps = 0
      for (let n = 0; n < needle.length; n++) {
        const found = hay.indexOf(needle[n], at)
        if (found < 0) return 0
        if (found > at) gaps += found - at
        at = found + 1
      }
      return Math.max(1, 60 - gaps)
    }
    /**
     * Match one label against a query.
     * @returns {{hit: boolean, score: number, mark: number}} `mark` is the
     *          index of the literal hit in the lowercased label, or -1 when the
     *          hit came from the sound forms (nothing to highlight then).
     */
    function matchLabel(label, query) {
      const text = String(label || '')
      const q = String(query || '').trim().toLowerCase()
      if (!q) return { hit: true, score: 0, mark: -1 }
      const lower = text.toLowerCase()
      if (lower === q) return { hit: true, score: MATCH_SCORE.EXACT, mark: 0 }
      if (lower.indexOf(q) === 0) return { hit: true, score: MATCH_SCORE.PREFIX, mark: 0 }
      const forms = soundForms(text)
      if (forms.initials === q) {
        return { hit: true, score: MATCH_SCORE.INITIAL_EXACT, mark: -1 }
      }
      if (forms.latin.indexOf(q) === 0) {
        return { hit: true, score: MATCH_SCORE.PINYIN_PREFIX, mark: -1 }
      }
      const at = lower.indexOf(q)
      if (at >= 0) {
        return { hit: true, score: MATCH_SCORE.SUBSTRING - Math.min(at, 60), mark: at }
      }
      if (forms.initials.indexOf(q) >= 0) {
        return { hit: true, score: MATCH_SCORE.INITIAL_SUBSTRING, mark: -1 }
      }
      if (forms.latin.indexOf(q) >= 0) {
        return { hit: true, score: MATCH_SCORE.PINYIN_SUBSTRING, mark: -1 }
      }
      const fuzzy = fuzzyScore(lower, q)
      if (fuzzy > 0) return { hit: true, score: MATCH_SCORE.FUZZY_TEXT + fuzzy, mark: -1 }
      const fuzzyInitials = fuzzyScore(forms.initials, q)
      if (fuzzyInitials > 0) {
        return { hit: true, score: MATCH_SCORE.FUZZY_INITIAL + fuzzyInitials, mark: -1 }
      }
      return { hit: false, score: 0, mark: -1 }
    }

    const SLOT = 'sidebar.panellist.actions'
    const SLOT_ID = 'panel-pins'
    const STORE_KEY = 'dsh-panel-pins:unpinned'

    // Ordered top pins: panel ids in display order. Applied as negative CSS
    // `order` on the panel rows (the host panel list is a flex column), which
    // reorders visually without touching DOM structure — see applyTopPins.
    const TOP_KEY = 'dsh-panel-pins:top'

    // Whether the panel ROWS are hidden (collected into the Panels launcher).
    // Deliberately NOT migrated from the old 'panellist-folded-v2' key: that
    // key used to mean "collapse the whole nav", and an even older one could
    // lock the sidebar collapsed with no way out.
    const ROWS_HIDDEN_KEY = 'dsh-panel-pins:rows-hidden-v2'

    // Whether the "compact footer" layout patch (rule group 7) is applied.
    const TIDY_KEY = 'dsh-panel-pins:tidy'
    const TIDY_CLASS = 'dpp-tidy'

    // Whether third-party plugin entry rows (family rows between the
    // new-session anchor and the panel list) are collected into the launcher.
    const FAMILY_KEY = 'dsh-panel-pins:family-collected'
    // b76: opt-in (default OFF — footer entries stay put per the original
    // constraint) collection of footer-area plugin entries (kanban etc.).
    const FOOTER_KEY = 'dsh-panel-pins:footer-collected'

    // Overlay group fold states (v0.10.0): {"panel":bool,"family":bool,"cmd":bool}
    // true = collapsed. Persisted per group; independent of the search filter.
    const FOLD_GROUPS_KEY = 'dsh-panel-pins:overlay-groups-folded'

    // Recently used panels (v0.13.0): a capped MRU queue of panel labels,
    // rendered as its own group at the top of the overlay/palette. Labels are
    // stored (not ids) because ids may be unknown for unpinned entries; a
    // label that no longer resolves to an entry is simply skipped at render.
    const RECENT_KEY = 'dsh-panel-pins:recent-panels'
    const RECENT_CAP = 5

    // Display-layer overrides (v1.1.0): user-defined display names and
    // hidden rows. Both are keyed by the ORIGINAL label (the stable handle
    // across restarts; ids are not always resolvable for family rows) and
    // only affect what this plugin renders — the host's own rows, menus and
    // plugin registrations stay untouched. Hidden rows disappear from the
    // sidebar AND from the overlay inventory; they come back from Settings.
    const RENAMES_KEY = 'dsh-panel-pins:display-renames'
    const HIDDEN_KEY = 'dsh-panel-pins:hidden-rows'

    // Icon-only panel rows (v0.10.0): rows keep their slot but show only the
    // glyph. Gated on an html class like the tidy patch.
    const ICONONLY_KEY = 'dsh-panel-pins:icon-only'
    const ICONONLY_CLASS = 'dpp-icononly'

    // Numeric tunables (vh/px), edited from the Settings page section and
    // applied as CSS custom properties on <html>.
    const PANEL_MAX_KEY = 'dsh-panel-pins:panel-list-max'
    const FOOT_MAX_KEY = 'dsh-panel-pins:foot-max'
    const PANEL_MAX_DEFAULT = 20
    const FOOT_MAX_DEFAULT = 15
    const OVERLAY_MAX_KEY = 'dsh-panel-pins:overlay-max'
    const QR_SIZE_KEY = 'dsh-panel-pins:qr-size'
    const OVERLAY_MAX_DEFAULT = 60
    const QR_SIZE_DEFAULT = 132

    // Whitelist: entry labels containing any of these names stay in the
    // sidebar (never collected, never hidden).
    const WHITELIST_KEY = 'dsh-panel-pins:whitelist'

    // Persisted label→id map for panels, seeded every time the host feeds the
    // More-menu slot. The Settings pin list needs ids to toggle pins, and the
    // host only renders that slot when the More menu opens — so the map makes
    // the pin list work even before that.
    const LABEL_ID_MAP_KEY = 'dsh-panel-pins:label-id-map'

    // Layout presets (v1.0.0): named snapshots of the whole panel layout —
    // pin store, top pins, overlay group folds, whitelist, icon-only and the
    // compact-footer master. {name: snapshotObject}. Applied atomically from
    // the palette (quick commands) and managed on the Settings page.
    const PRESETS_KEY = 'dsh-panel-pins:layout-presets'
    const PRESET_NAME_KEY = 'dsh-panel-pins:active-preset'

    // Custom panel groups (v1.0.0): user-defined overlay groups mapping a
    // group id → {name, labels:[panel labels]}. Rendered after the global
    // panels group; a panel assigned to a custom group is hidden from that
    // group (it still appears in Recent).
    const CUSTOM_GROUPS_KEY = 'dsh-panel-pins:custom-groups'

    // Granular compact-footer sub-toggles (each rule group gated on its own
    // html class AND the master dpp-tidy class).
    const TIDY_QR_KEY = 'dsh-panel-pins:tidy-qr'
    const TIDY_BRAND_KEY = 'dsh-panel-pins:tidy-brand'
    const TIDY_METER_KEY = 'dsh-panel-pins:tidy-meter'
    const TIDY_QR_CLASS = 'dpp-tidy-qr'
    const TIDY_BRAND_CLASS = 'dpp-tidy-brand'
    const TIDY_METER_CLASS = 'dpp-tidy-meter'

    const STYLE_ID = 'dsh-panel-pins-style'
    const LAUNCHER_ATTR = 'data-dpp-launcher'
    // v1.4.4: scroll-contract gate. html.dpp-rc3 opts INTO the rc.3-era
    // structural sidebar overrides (b79 flex viewport / b83 root unbounding /
    // b81 nav wheel hijack). Applied only when a _scrollArea exists without
    // the rc.5 hand-off markers — rc.5 hosts keep their wheel hand-off intact.
    const RC3_CLASS = 'dpp-rc3'
    // v1.4.8: rc.5 hosts get html.dpp-rc5 — the dispatch gate for the LITE
    // nav-wheel driver (installNavWheelLite). No CSS is gated on it: the
    // panel-list cap stays UNGATED exactly as v1.4.4 shipped it (the user's
    // verified-good baseline; v1.4.7's gated rewrite of EXTRA_CSS introduced
    // a duplicated selector line that truncated the whole stylesheet).
    const RC5_CLASS = 'dpp-rc5'
    const BUILD = 'b100'
    // Keep in sync with package.json — shown on the Settings page so an
    // installed build can be identified at a glance (verify-install aid).
    const VERSION = '1.8.0'
    // v1.3.3: feedback channels. Channel A is this repo's issue tracker
    // (pre-filled title/body via URL params). Channel B is the PLUGIN OWNER's
    // own Feishu form — submissions land in a base the author actually reads
    // (the host shell's questionnaire would route feedback to the DSH team,
    // invisible to the plugin author). The shell's __DSH_CONTACT_CONFIG__
    // .contactSource, when present, is folded into the source prefill purely
    // as attribution context. No telemetry anywhere: every channel fires
    // only from a user click.
    const FEEDBACK_ISSUE_URL = 'https://github.com/QDNBD/dsh-panel-pins/issues/new'
    const FEEDBACK_SURVEY_URL =
      'https://rcnenqajjbvx.feishu.cn/share/base/form/shrcnclXQes8lP9EgsfNY19I7fg'
    // v1.4.0: settings-page bridge constants (dsh-panel-control precedent,
    // prefix renamed to keep the two plugins' namespaces apart).
    const SLOT_SETTINGS = 'settings.section'
    const SLOT_MAIN = 'main'
    const BRIDGE_PREFIX = 'dpp-bridge-'
    const BRIDGE_SLOT_PREFIX = 'dpp-bridge-slot-'
    const BRIDGE_KEY = 'dsh-panel-pins:bridge'
    const BRIDGE_RESCAN_SCHEDULE = [350, 900, 2000, 4200, 8000, 15000]
    /**
     * v1.6.0: the UI language is no longer a module-load-time constant.
     *
     * The old code read `navigator.language` ONCE, at module evaluation, and
     * baked the answer into 157 label keys plus ~30 inline ternaries. Two
     * problems: (a) the host owns its own language setting (8 languages plus
     * an in-app switch) that `navigator.language` does not follow — a host
     * set to 中文 while the browser reports en-US rendered English; (b) even
     * the browser-driven value could not change while the plugin was mounted.
     *
     * Now `zh` is mutable state, `LABEL` is rebuilt IN PLACE (the object
     * identity never changes, so every existing LABEL.x reference keeps
     * working untouched), and `refreshLocale()` re-evaluates and repaints.
     */
    let zh = detectChinese()

    /**
     * True when the plugin's own copy should render in Chinese.
     * The host's locale wins — it is the setting the user actually changed.
     */
    function detectChinese() {
      try {
        const id = readHostLanguageId()
        if (id) return String(id).toLowerCase().indexOf('zh') === 0
      } catch (error) {
        /* host locale service absent on this build */
      }
      try {
        return String((navigator && navigator.language) || '').toLowerCase().indexOf('zh') === 0
      } catch (error) {
        return false
      }
    }

    /**
     * The host's active language id, or '' when the host has no locale
     * service (older builds) or the shape is unfamiliar.
     *
     * The host's locale runtime lives in the CLIENT half and publishes a
     * snapshot whose `active` is the effective language id
     * (dsh-client-locale/src/client/index.ts:75-82, :228-230); the host
     * ships eight ids (zh/en/ja/es/fr/de/ru/pt) and lets the user switch
     * them in-app, which `navigator.language` cannot see.
     *
     * Read through optionalService() and NEVER declare 'locale' in `inject`:
     * the locale package is not guaranteed to exist on every host version we
     * support (engines.dsh >=0.2.0-rc.1), and a missing declared service
     * parks the fiber — the plugin would never load at all.
     */
    function readHostLanguageId() {
      try {
        const locale = optionalService('locale')
        if (!locale) return ''
        let snapshot = null
        if (typeof locale.getSnapshot === 'function') snapshot = locale.getSnapshot()
        else if (typeof locale.getLocale === 'function') snapshot = locale.getLocale()
        if (!snapshot) return ''
        const active = snapshot.active || snapshot.locale || snapshot.language
        return active ? String(active) : ''
      } catch (error) {
        return ''
      }
    }

    /** Build the label table for the current UI language (see refreshLocale). */
    function buildLabels() {
      return {
      pin: zh ? '钉住在侧栏' : 'Pin to sidebar',
      unpin: zh ? '从侧栏取消钉住' : 'Unpin from sidebar',
      fold: zh ? '收起面板列表' : 'Hide panel list',
      unfold: zh ? '展开面板列表' : 'Show panel list',
      panels: zh ? '面板' : 'Panels',
      panelsMenu: zh ? '打开面板菜单' : 'Open panels menu',
      showRows: zh ? '显示面板行' : 'Show panel rows',
      hideRows: zh ? '隐藏面板行' : 'Hide panel rows',
      tidyOn: zh ? '收紧底部插件区' : 'Compact footer area',
      tidyOff: zh ? '还原底部插件区' : 'Restore footer area',
      familyOn: zh ? '收纳插件入口行' : 'Collect plugin rows',
      familyOff: zh ? '还原插件入口行' : 'Restore plugin rows',
      groupPanels: zh ? '全局面板' : 'Global panels',
      groupMain: zh ? '主面板' : 'Main panels',
      groupRight: zh ? '右栏标签页' : 'Right sidebar',
      groupFamily: zh ? '插件入口' : 'Plugin entries',
      setTitle: zh ? '面板收纳' : 'Panel Pins',
      setIntro: zh
        ? '调整侧栏收纳与紧凑布局的各项参数，改动即时生效并自动保存。侧栏行可直接按住拖动排序（拖到另一行上松手，蓝色横线指示插入位置），或右键任意行选「移到最前」。'
        : 'Tune sidebar collection and the compact layout. Changes apply live and save automatically. Sidebar rows can be dragged to reorder (drop onto another row — the blue line marks the insert position), or right-click a row and pick "Move to front".',
      setRows: zh ? '收纳面板行' : 'Collect panel rows',
      setRowsDetail: zh ? '全局面板行收进「面板」菜单' : 'Fold global panel rows into the Panels menu',
      setFamily: zh ? '收纳插件入口行' : 'Collect plugin rows',
      setFamilyDetail: zh ? '第三方插件入口行（无论位于顶部还是底部）收进「面板」菜单' : 'Fold third-party entry rows — top or bottom — into the Panels menu',
      setTidy: zh ? '紧凑底部区' : 'Compact footer',
      setTidyDetail: zh ? '底部插件区限高 + 内部滚动，二维码缩小' : 'Cap the footer area with internal scrolling; shrink QR codes',
      setPanelMax: zh ? '面板列表限高' : 'Panel list max height',
      setFootMax: zh ? '底部插件区限高' : 'Footer area max height',
      setOverlayMax: zh ? '弹层菜单限高' : 'Panels menu max height',
      setQrSize: zh ? '二维码尺寸' : 'QR code size',
      setWhitelist: zh ? '白名单常驻' : 'Keep entries pinned',
      setWhitelistDetail: zh
        ? '打开开关的入口留在侧栏原位，不收进「面板」菜单'
        : 'Entries switched on stay in the sidebar and are never collected',
      setPickEmpty: zh
        ? '尚未发现侧栏入口（打开侧栏后重试）'
        : 'No sidebar entries found yet — open the sidebar and retry',
      setPinManage: zh ? '钉住管理' : 'Pin management',
      setPinManageDetail: zh
        ? '列出全部面板：已钉住的在侧栏原位，未钉住的只在「更多」菜单里'
        : 'All panels: pinned ones sit in the sidebar, unpinned ones live in the More menu',
      setPinRestore: zh ? '钉住' : 'Pin',
      setPinUnpin: zh ? '取消钉住' : 'Unpin',
      setPinNeedMenu: zh
        ? '打开一次「更多」菜单以识别该面板后即可操作'
        : 'Open the More menu once so this panel can be identified',
      setPinEmpty: zh ? '尚未发现面板' : 'No panels found yet',
      rowOrderTitle: zh ? '行排序' : 'Row order',
      rowOrderDetail: zh
        ? '侧栏行被拖动或「移到最前」过，这里的顺序覆盖宿主默认。恢复默认即清空自定义顺序。'
        : 'Sidebar rows were drag-reordered or moved to front; this order overrides the host default. Restoring clears the custom order.',
      rowOrderCount: zh ? '已自定义 N 行的顺序' : 'N rows reordered',
      rowOrderReset: zh ? '恢复默认行序' : 'Restore default row order',
      rowOrderResetDone: zh ? '已恢复默认行序' : 'Default row order restored',
      setTop: zh ? '置顶' : 'To top',
      setTopOff: zh ? '取消置顶' : 'Unpin from top',
      setTopNeedPin: zh
        ? '先钉住该面板，才能置顶'
        : 'Pin the panel first — only pinned rows can be topped',
      setTopNoMatch: zh
        ? '置顶已保存，但尚未匹配到侧栏面板行——打开一次「更多」菜单后会自动生效'
        : 'Top pins saved, but no sidebar rows matched yet — open the More menu once to activate',
      topFlag: zh ? '（置顶）' : ' (top)',
      setSubQr: zh ? '二维码缩放' : 'Shrink QR codes',
      setSubBrand: zh ? '品牌行收紧' : 'Tighten brand row',
      setSubMeter: zh ? '费用条紧凑' : 'Compact cost meter',
      setSubNote: zh ? '以下细分在「紧凑底部区」开启时生效' : 'These apply while Compact footer is on',
      setReset: zh ? '恢复默认布局' : 'Reset layout',
      setResetData: zh ? '清除钉住与白名单' : 'Clear pins & whitelist',
      setResetDataTitle: zh
        ? '同时清除取消钉住、置顶与白名单数据，不可撤销'
        : 'Clears unpinned/top-pin/whitelist data. Cannot be undone.',
      setResetDone: zh ? '已恢复默认' : 'Reset done',
      searchPh: zh ? '搜索面板或插件…（支持拼音 mbsn / mianban）' : 'Search panels & plugins… (pinyin: mbsn / mianban)',
      searchEmpty: zh ? '没有匹配项' : 'No matches',
      ovMenu: zh ? '面板菜单' : 'Panels menu',
      ovPalette: zh ? '命令面板' : 'Command palette',
      badgeTitle: zh ? '已收纳 N 行进启动器' : 'N rows folded into the launcher',
      ctxOpen: zh ? '打开' : 'Open',
      ctxPin: zh ? '钉住' : 'Pin',
      ctxUnpin: zh ? '取消钉住' : 'Unpin',
      ctxTop: zh ? '置顶' : 'To top',
      ctxTopOff: zh ? '取消置顶' : 'Remove top',
      ctxWhitelist: zh ? '常驻侧栏' : 'Keep in sidebar',
      ctxWhitelistOff: zh ? '取消常驻' : 'Stop keeping in sidebar',
      // v1.1.0: display rename + hide (context menu).
      ctxRename: zh ? '重命名' : 'Rename',
      ctxToFront: zh ? '移到最前' : 'Move to front',
      ctxHide: zh ? '隐藏此行' : 'Hide this row',
      ctxUnhide: zh ? '取消隐藏' : 'Unhide',
      renamePrompt: zh ? '输入新名称，留空恢复默认' : 'New name (empty to reset)',
      hiddenTitle: zh ? '隐藏的行' : 'Hidden rows',
      hiddenDetail: zh ? '从侧栏隐藏的入口在这里恢复显示' : 'Rows hidden from the sidebar; restore them here',
      hiddenEmpty: zh ? '没有隐藏任何行' : 'Nothing hidden',
      hiddenRestore: zh ? '恢复显示' : 'Restore',
      hiddenRestoreAll: zh ? '全部恢复' : 'Restore all',
      hiddenRestoreAllDone: zh ? '已恢复全部隐藏行' : 'All hidden rows restored',
      groupHidden: zh ? '已隐藏' : 'Hidden rows',
      renamesTitle: zh ? '重命名的行' : 'Renamed rows',
      renamesDetail: zh ? '显示名改动只影响本机显示；原名仍用于钉住/分组/白名单' : 'Display-only changes; the original label still keys pins/groups/whitelist',
      renamesReset: zh ? '恢复原名' : 'Reset name',
      renamesEmpty: zh ? '没有重命名的行' : 'No renames',
      cmdTitle: zh ? '快速命令' : 'Quick commands',
      recentTitle: zh ? '最近使用' : 'Recent',
      presetEmptyHint: zh ? '还没有预设，在设置页的「布局预设」卡里保存' : 'No presets yet — save one in Settings → Layout presets',
      presetApplyFailed: zh ? '预设 NAME 应用失败' : 'Failed to apply preset NAME',
      cmdShowRows: zh ? '显示面板行' : 'Show panel rows',
      cmdHideRows: zh ? '收纳面板行' : 'Collect panel rows',
      cmdToggleFamily: zh ? '切换插件入口收纳' : 'Toggle plugin-row collection',
      cmdToggleTidy: zh ? '切换紧凑底部区' : 'Toggle compact footer',
      setExport: zh ? '导出配置' : 'Export settings',
      setImport: zh ? '导入配置' : 'Import settings',
      setImportTitle: zh ? '粘贴此前导出的配置 JSON 后写入' : 'Paste a previously exported settings JSON, then apply',
      setExportFile: zh ? '下载配置文件' : 'Download settings file',
      setImportFile: zh ? '从文件导入' : 'Import from file',
      setExportFileFail: zh ? '导出失败：浏览器下载不可用' : 'Export failed: browser download unavailable',
      setImportFileBad: zh ? '文件内容不是有效的配置 JSON' : 'File does not hold a valid settings JSON',
      setImportFileDone: zh ? '配置已从文件导入并生效' : 'Settings imported from file and applied',
      setImportFileTitle: zh ? '选择此前导出的 dsh-panel-pins 配置 JSON 文件写入' : 'Pick a previously exported dsh-panel-pins settings JSON file, then apply',
      setExportDone: zh ? '配置已复制到剪贴板' : 'Settings copied to clipboard',
      setImportBad: zh ? '剪贴板内容不是有效的配置 JSON' : 'Clipboard does not hold a valid settings JSON',
      setImportDone: zh ? '配置已导入并生效' : 'Settings imported and applied',
      setIconOnly: zh ? '面板行仅图标' : 'Icon-only panel rows',
      setIconOnlyDetail: zh
        ? '面板行保留位置但只显示图标，比整行收纳更温和'
        : 'Panel rows keep their slot but show only the glyph — a middle ground',
      grpShow: zh ? '展开' : 'Show',
      grpHide: zh ? '收起' : 'Hide',
      setDragHint: zh ? '拖拽到其他置顶行上可调整顺序' : 'Drag onto another top row to reorder',
      noRowsAfterShow: zh
        ? '侧栏没有已钉住的面板——在「面板」菜单里悬停某行点图钉即可钉住'
        : 'No pinned panels — hover a line in the Panels menu and click the pin icon',
      unnamed: zh ? '未命名' : 'Unnamed',
      // Layout presets (v1.0.0)
      presetTitle: zh ? '布局预设' : 'Layout presets',
      presetDetail: zh
        ? '把整套面板布局（钉住/置顶/折叠/白名单/仅图标/紧凑）存成命名预设，随时一键切回'
        : 'Save the whole layout (pins/tops/folds/whitelist/icon-only/compact) as named presets and switch anytime',
      presetSave: zh ? '存为预设' : 'Save preset',
      presetApply: zh ? '应用' : 'Apply',
      presetDelete: zh ? '删除' : 'Delete',
      presetDeleteConfirm: zh ? '确认?' : 'Sure?',
      presetDeleteTitle: zh ? '再次点击确认删除' : 'Click again to confirm deletion',
      presetEmpty: zh ? '还没有预设——先调整布局，再点「存为预设」' : 'No presets yet — adjust the layout, then save one',
      presetSaved: zh ? '预设已保存' : 'Preset saved',
      presetSavedAs: zh ? '已存为预设「NAME」' : 'Saved as preset "NAME"',
      presetApplied: zh ? '已应用预设「NAME」' : 'Applied preset "NAME"',
      presetAppliedDefault: zh ? '已恢复当前布局（未套用预设）' : 'Restored the live layout (no preset)',
      presetDeleted: zh ? '预设已删除' : 'Preset deleted',
      presetNamePh: zh ? '预设名称（回车保存）' : 'Preset name (Enter to save)',
      presetNameRequired: zh ? '请输入预设名称' : 'Enter a preset name',
      presetActiveFlag: zh ? '（当前）' : ' (active)',
      presetNone: zh ? '（无）' : '(none)',
      // Palette: preset quick commands
      cmdPresetPrefix: zh ? '布局: ' : 'Layout: ',
      cmdPresetSave: zh ? '保存当前布局为预设' : 'Save current layout as preset',
      cmdPresetSavePrompt: zh ? '输入预设名称' : 'Preset name',
      cmdPresetNone: zh ? '（还没有预设）' : '(no presets yet)',
      // Custom groups (v1.0.0)
      cgTitle: zh ? '自定义分组' : 'Custom groups',
      cgDetail: zh
        ? '在「面板」菜单里自建分组：把面板归入你自己的分类，菜单按分组陈列'
        : 'Build your own groups in the Panels menu and file panels into them',
      cgAdd: zh ? '新建分组' : 'New group',
      cgNamePh: zh ? '分组名称（回车新建）' : 'Group name (Enter to create)',
      cgRename: zh ? '重命名' : 'Rename',
      cgDelete: zh ? '删除' : 'Delete',
      cgDeleteTitle: zh ? '再次点击确认删除' : 'Click again to confirm deletion',
      cgAddPanel: zh ? '＋面板' : '+ panel',
      cgRemovePanel: zh ? '移出' : 'Remove',
      cgEmpty: zh ? '还没有分组' : 'No groups yet',
      cgPickTitle: zh ? '选择要加入的面板：' : 'Pick panels to add:',
      cgSaved: zh ? '分组已保存' : 'Groups saved',
      cgDeleted: zh ? '分组已删除' : 'Group deleted',
      cgNoPanels: zh ? '尚无可用面板（打开一次「更多」菜单后重试）' : 'No panels available yet — open the More menu once and retry',
      cgNoMembers: zh ? '还没有面板成员，用右侧「+ 面板」下拉添加' : 'No members yet — add panels with the "+ panel" dropdown',
      cgAssignedNote: zh ? '已归组的面板不再出现在「全局面板」组里' : 'Panels in a custom group no longer repeat under Global panels',
      // Feedback (v1.3.3)
      fbTitle: zh ? '反馈' : 'Feedback',
      fbDetail: zh
        ? '遇到问题或有想法？GitHub issue 或宿主问卷都可以，环境信息会预填，可删可改'
        : 'Found a bug or have an idea? Open a GitHub issue or the host survey — environment facts are pre-filled and editable',
      fbIssue: zh ? '去 GitHub 提 issue' : 'Open a GitHub issue',
      fbIssueTitle: zh ? '在浏览器打开 GitHub 并预填环境信息' : 'Opens GitHub with environment facts pre-filled',
      fbSurvey: zh ? '填写问卷反馈' : 'Fill in the survey',
      fbSurveyTitle: zh ? '打开问卷（宿主问卷，随环境预填）' : 'Open the survey (host form, pre-filled from the environment)',
      fbDiag: zh ? '复制诊断信息' : 'Copy diagnostics',
      fbDiagTitle: zh ? '复制配置导出 + 环境信息到剪贴板，自行粘贴到 issue 或问卷' : 'Copy the settings dump + environment facts to the clipboard; paste them yourself',
      fbDiagDone: zh ? '诊断信息已复制，请粘贴到 issue 或问卷' : 'Diagnostics copied — paste them into the issue or survey',
      fbDiagFail: zh ? '复制失败：剪贴板不可用' : 'Copy failed: clipboard unavailable',
      fbEnvTitle: zh ? '环境' : 'Environment',
      fbProblem: zh ? '问题描述' : 'Problem',
      fbSteps: zh ? '复现步骤' : 'Steps to reproduce',
      cmdFeedback: zh ? '反馈与诊断' : 'Feedback & diagnostics',
      // Settings-page bridge (v1.4.0)
      bridgeTitle: zh ? '设置页入口' : 'Bridged settings pages',
      bridgeDetail: zh
        ? '把只注册了设置页、没有侧栏入口的第三方插件的页面搬进「面板」菜单'
        : 'Surface third-party settings-only pages inside the Panels launcher',
      bridgeGroup: zh ? '设置页' : 'Settings pages',
      bridgeBack: zh ? '← 返回对话' : '← Back to conversation',
      bridgeTag: zh ? '设置页' : 'Settings page',
      bridgeMissing: zh ? '该设置页暂时无法加载（源插件可能未就绪）' : 'This settings page could not load (source plugin may not be ready)',
      bridgeEmpty: zh ? '暂无可桥接的设置页' : 'No bridgeable settings pages',
      }
    }
    const LABEL = buildLabels()

    // ------------------------------------------------------- locale plumbing
    // v1.6.0. `LABEL` is rebuilt IN PLACE, so the object identity never
    // changes and every existing LABEL.x reference keeps working untouched.
    // The settings section subscribes so an open settings page repaints in the
    // new language instead of waiting for a remount; the launcher button and
    // the overlay/context menus are rebuilt from LABEL on open anyway.

    const localeSubscribers = []

    /** Subscribe to UI-language changes; returns an unsubscribe function. */
    function onLocaleChange(listener) {
      if (typeof listener !== 'function') return function () {}
      localeSubscribers.push(listener)
      return function () {
        const index = localeSubscribers.indexOf(listener)
        if (index >= 0) localeSubscribers.splice(index, 1)
      }
    }

    /**
     * Re-evaluate the UI language and repaint everything that cached it.
     * A no-op when the effective language did not move, so it is safe to call
     * on every host locale notification.
     */
    function refreshLocale() {
      const next = detectChinese()
      if (next === zh) return false
      zh = next
      const nextLabels = buildLabels()
      for (const key of Object.keys(LABEL)) delete LABEL[key]
      Object.assign(LABEL, nextLabels)
      repaintLauncherLabels()
      for (const listener of localeSubscribers.slice()) {
        try {
          listener()
        } catch (error) {
          /* one bad listener must not block the rest */
        }
      }
      applyConfig()
      applyTheme()
      return true
    }

    /** The launcher button caches its label at creation time; refresh it. */
    function repaintLauncherLabels() {
      if (typeof document === 'undefined') return
      try {
        const launcher = document.querySelector('[' + LAUNCHER_ATTR + ']')
        if (!launcher) return
        launcher.setAttribute('aria-label', LABEL.panelsMenu)
        const text = launcher.querySelector('.dpp-launcher-label')
        if (text) text.textContent = LABEL.panels
      } catch (error) {
        /* the launcher may not be mounted yet */
      }
    }

    // Bridge between the React slot component (which knows panel ids and pin
    // state) and the DOM launcher (which knows the live panel rows). The slot
    // component refreshes `bridge` on every render.
    const bridge = {
      entries: [],
      onPinnedChange: null,
    }

    // Live ctx.slots handle (captured in apply) — used to seed the label→id
    // map from the authoritative sidebar.panellist slot.
    let ctxSlots = null

    // Live ctx handle (v1.3.2, captured in apply) — lets the DOM layer read
    // optional services (layout) without declaring them in inject. Reading an
    // undeclared service throws on some cordis versions, so every access goes
    // through optionalService() below; absence degrades to "no exemption".
    let ctxRef = null

    /**
     * Cordis service access that tolerates absence. `ctx.get(name)` throws
     * for an undeclared service on some cords versions and returns undefined
     * on others (dsh-panellist src/client/service.ts documents both); never
     * declare optional services in `inject` — a missing declared service
     * parks the fiber and the plugin never loads.
     */
    function optionalService(name) {
      const ctx = ctxRef
      if (!ctx) return undefined
      try {
        if (typeof ctx.get === 'function') {
          const value = ctx.get(name)
          if (value) return value
        }
      } catch (error) {
        /* not injected / not present on this cords version */
      }
      try {
        return ctx[name]
      } catch (error) {
        return undefined
      }
    }

    /**
     * Seed the label→id map straight from the sidebar.panellist slot.
     * The More-menu bridge cannot be trusted for this: its entry labels may
     * be missing (observed in the wild: map stayed EMPTY while ids like
     * "cli-bridge" got pinned, so top-pin matching had no label to match).
     * The sidebar renders its rows from THIS slot, so labels resolved here
     * are the exact row aria-labels — the matching key for top pins.
     */
    function seedMapFromSlots() {
      if (!ctxSlots || typeof ctxSlots.entriesOfSlot !== 'function') return
      try {
        const entries = ctxSlots.entriesOfSlot('sidebar.panellist')
        if (!Array.isArray(entries) || entries.length === 0) return
        const pairs = []
        entries.forEach(function (entry) {
          const options = entry && entry.options
          if (!options || typeof options.id !== 'string' || options.id.length === 0) return
          let label = options.label
          try {
            if (typeof label === 'function') label = label()
          } catch (error) {
            label = null
          }
          if (typeof label !== 'string' || label.length === 0) return
          pairs.push({ id: options.id, label: label })
        })
        if (pairs.length > 0) mergeLabelIdMap(pairs)
      } catch (error) {
        /* slots API unavailable: the More-menu bridge stays the fallback */
      }
    }

    /**
     * The full panel list for the Settings pin manager, merged from three
     * sources: visible panel rows (pinned, label→id via the persisted map),
     * the unpinned store (ids), and the host-fed bridge entries whenever the
     * More menu has rendered. Rows whose id is still unknown are flagged so
     * the UI can disable their toggle until the More menu identifies them.
     */
    function readPanelList() {
      const unpinned = readUnpinned()
      const map = readLabelIdMap()
      const byId = {}
      Object.keys(map).forEach(function (label) {
        const id = map[label]
        if (id && !(id in byId)) byId[id] = label
      })
      const list = []
      function findItem(pred) {
        for (let i = 0; i < list.length; i++) {
          if (pred(list[i])) return list[i]
        }
        return null
      }
      try {
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            const label = (row.getAttribute('aria-label') || row.textContent || '').trim()
            if (label.length === 0) return
            // b61: rows the user hid via the context menu stay in the nav DOM
            // (display:none via applyHiddenRows) — they must not inflate the
            // launcher badge, which advertises what the menu can offer.
            if (isRowHidden(label)) return
            const id = map[label]
            list.push({
              id: id || label,
              label: label,
              pinned: !unpinned.has(id || label),
              idKnown: typeof id === 'string' && id.length > 0,
            })
          })
        }
      } catch (error) {
        /* sidebar not ready */
      }
      Array.from(unpinned).forEach(function (id) {
        const existing = findItem(function (item) {
          return item.id === id
        })
        if (existing) {
          existing.pinned = false
          existing.idKnown = true
          return
        }
        // b62: a hidden row must not re-enter the inventory through the
        // unpinned backfill — the badge counts this list, and the menu skips
        // hidden labels at render time, so the numbers would drift apart.
        const backfillLabel = byId[id] || id
        if (isRowHidden(backfillLabel)) return
        list.push({ id: id, label: backfillLabel, pinned: false, idKnown: true })
      })
      if (Array.isArray(bridge.entries)) {
        bridge.entries.forEach(function (entry) {
          if (!entry || !entry.id) return
          const existing =
            findItem(function (item) {
              return item.id === entry.id
            }) ||
            findItem(function (item) {
              return !item.idKnown && item.label === entry.label
            })
          if (existing) {
            existing.id = entry.id
            existing.idKnown = true
            if (entry.label) existing.label = entry.label
            existing.pinned = !unpinned.has(entry.id)
          } else {
            // b62: same hidden-row guard as the unpinned backfill — bridge
            // entries must not re-inflate the badge for rows the user hid.
            if (isRowHidden(entry.label || entry.id)) return
            list.push({
              id: entry.id,
              label: entry.label || entry.id,
              pinned: !unpinned.has(entry.id),
              idKnown: true,
            })
          }
        })
      }
      const topPins = readTopPins()
      list.forEach(function (item) {
        item.top = topPins.indexOf(item.id) !== -1
      })
      return list
    }

    // ------------------------------------------------------------ persisted pins

    function readUnpinned() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        const out = new Set()
        if (Array.isArray(parsed)) {
          parsed.forEach(function (id) {
            if (typeof id === 'string' && id.length > 0) out.add(id)
          })
        }
        return out
      } catch (error) {
        return new Set()
      }
    }

    function writeUnpinned(set) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(set)))
      } catch (error) {
        /* storage unavailable: pins stay session-only */
      }
    }

    // ------------------------------------------------------------ top pins

    /** Persisted top pins: ordered [{id, label?}] entries (top order = array order).
     * v0.7.4 stored bare id strings; those normalize to {id, label: null}. */
    function readTopPins() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(TOP_KEY) || '[]')
        if (!Array.isArray(parsed)) return []
        return parsed
          .map(function (item) {
            if (typeof item === 'string' && item.length > 0) return { id: item, label: null }
            if (item && typeof item.id === 'string' && item.id.length > 0) {
              return {
                id: item.id,
                label: typeof item.label === 'string' && item.label.length > 0 ? item.label : null,
              }
            }
            return null
          })
          .filter(function (e) {
            return e !== null
          })
      } catch (error) {
        return []
      }
    }

    function writeTopPins(list) {
      try {
        window.localStorage.setItem(TOP_KEY, JSON.stringify(list))
      } catch (error) {
        /* storage unavailable: top pins stay session-only */
      }
    }

    /** Toggle `id` in the top-pin list; returns whether it is now top-pinned.
     * `label` is stored alongside so row matching does not depend on the
     * label→id map (which can lag behind locale changes). */
    function toggleTopPinStore(id, label) {
      const list = readTopPins()
      const idx = list.findIndex(function (e) {
        return e.id === id
      })
      if (idx >= 0) list.splice(idx, 1)
      else list.push({ id: id, label: label || null })
      writeTopPins(list)
      return idx < 0
    }

    /**
     * Match a sidebar row (by its aria-label) against the top-pin list.
     * Direct stored-label hit first, then id equivalence via the map (covers
     * rows whose aria-label is the raw panel id when locale resolution lags).
     * Returns the index in the top-pin order, or -1.
     */
    function topPinIndexFor(label, map, topPins) {
      for (let i = 0; i < topPins.length; i++) {
        const entry = topPins[i]
        if (entry.label && entry.label === label) return i
        if (map[label] && map[label] === entry.id) return i
        if (entry.id === label) return i
      }
      return -1
    }

    // The host's pins are memory-only; we mirror ours into them on mount and
    // whenever the entry list changes (new plugin installed, ids renamed).
    // ------------------------------------------------------- native pin mirror
    // v1.7 (dual-source convergence, scheme "host wins on interaction"): since
    // DSH 0.2.2-rc.5 the host ships its own native pin controls on the sidebar
    // panel rows (SidebarRoot.tsx `css.panelUnpin`, hashed to `*_panelUnpin`)
    // plus a pin action in the More menu (entry-customization). The host's pin
    // store is memory-only (panel-pins.ts, reset on reload), so our persisted
    // set remains the only durable copy. With native controls present we stop
    // rendering our own pin/unpin menu rows and turn this store into a pure
    // mirror: first mount of a session restores the persisted intent (the
    // host just forgot it), and every later sync RECORDS the host's state
    // instead of pushing ours — a native unpin can no longer be resurrected.
    // Without native controls (older hosts) everything behaves exactly as
    // before: our rows render and syncIntoHost pushes on every mount.
    const NATIVE_PIN_SELECTOR = 'button[class$="_panelUnpin"]'

    // Session latches. nativePinSeen never unsets (a host update removing the
    // controls resets it on the next renderer reload); mirrorArmed is reset by
    // full-state writers (import / layout presets) so the next mount restores
    // the freshly written store instead of mirroring the stale host state.
    let nativePinSeen = false
    let mirrorArmed = false

    function probeNativePinControls() {
      try {
        return !!document.querySelector(NATIVE_PIN_SELECTOR)
      } catch (error) {
        return false
      }
    }

    /**
     * Host wins: reconcile our persisted set with the host's current pin
     * flags. Only called once the mirror is armed — a host-side change at
     * this point can only come from the user acting on the native controls
     * (or our own settings page, which pushes and then re-matches here).
     */
    function mirrorFromHost(entries) {
      if (!Array.isArray(entries)) return
      let changed = false
      const set = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || !entry.id || entry.id === 'plugins') return
        const hostPinned = entry.pinned !== false
        if (!hostPinned && !set.has(entry.id)) {
          set.add(entry.id)
          changed = true
        } else if (hostPinned && set.has(entry.id)) {
          set.delete(entry.id)
          changed = true
        }
      })
      if (changed) writeUnpinned(set)
    }

    /**
     * First mount of a session (mirror not armed yet): adopt unpinned ids the
     * host knows but we don't (a native unpin that happened before our slot
     * ever mounted), then restore the persisted intent — the host's memory
     * store resets on every restart, so a "host says pinned, we say unpinned"
     * mismatch at first mount means the host forgot, not that the user pinned.
     */
    function mirrorAdoptAndRestore(entries, onPinnedChange) {
      if (typeof onPinnedChange !== 'function' || !Array.isArray(entries)) return
      const set = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || !entry.id || entry.id === 'plugins') return
        if (entry.pinned === false && !set.has(entry.id)) set.add(entry.id)
      })
      writeUnpinned(set)
      entries.forEach(function (entry) {
        if (!entry || !entry.id || entry.id === 'plugins') return
        const entryPinned = entry.pinned !== false
        const wantPinned = !set.has(entry.id)
        if (entryPinned !== wantPinned) {
          try {
            onPinnedChange(entry.id, wantPinned)
          } catch (error) {
            /* host refused: keep our intent for the next mount */
          }
        }
      })
    }

    function syncIntoHost(entries, onPinnedChange) {
      if (typeof onPinnedChange !== 'function' || !Array.isArray(entries)) return
      const unpinned = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || entry.id === 'plugins') return
        const entryPinned = entry.pinned !== false
        const wantPinned = !unpinned.has(entry.id)
        if (entryPinned !== wantPinned) onPinnedChange(entry.id, wantPinned)
      })
    }

    // ---------------------------------------------------------------- row state

    /**
     * Whether the panel ROWS are hidden (collected into the Panels launcher).
     * Defaults to hidden: the original complaint was that the panel rows filled
     * the sidebar and pushed the session history out of view.
     */
    function readRowsHidden() {
      try {
        const raw = window.localStorage.getItem(ROWS_HIDDEN_KEY)
        if (raw === '1') return true
        if (raw === '0') return false
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeRowsHidden(value) {
      try {
        window.localStorage.setItem(ROWS_HIDDEN_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------------------------- compact footer

    /**
     * Whether the compact-footer patch is applied. ON by default: footer
     * plugins (cost meter, pairing QR, …) grow unbounded and squeeze the
     * session history out of view — the same complaint that motivated the
     * panel-row collection above.
     */
    function readTidy() {
      try {
        const raw = window.localStorage.getItem(TIDY_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeTidy(value) {
      try {
        window.localStorage.setItem(TIDY_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // Granular compact-footer sub-toggles. Each gates its own CSS rule group;
    // all groups additionally require the master dpp-tidy class, so turning
    // the master off wins over every sub-toggle.
    function readTidyQr() {
      return readFlag(TIDY_QR_KEY)
    }
    function readTidyBrand() {
      return readFlag(TIDY_BRAND_KEY)
    }
    function readTidyMeter() {
      return readFlag(TIDY_METER_KEY)
    }

    /**
     * Apply (or remove) the `html.dpp-tidy` class that gates the compact-footer
     * CSS block. Toggling a class keeps the stylesheet immutable — no style
     * rewriting, no flicker, and React cannot lose it.
     */
    function applyTidy() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(TIDY_CLASS, readTidy())
      root.classList.toggle(TIDY_QR_CLASS, readTidyQr())
      root.classList.toggle(TIDY_BRAND_CLASS, readTidyBrand())
      root.classList.toggle(TIDY_METER_CLASS, readTidyMeter())
    }

    // ------------------------------------------------------- icon-only rows

    function readIconOnly() {
      return readFlag(ICONONLY_KEY)
    }

    /** Apply the html.dpp-icononly gate: panel rows collapse to glyphs. */
    function applyIconOnly() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(ICONONLY_CLASS, readIconOnly())
    }

    // ------------------------------------------------------------- theme probe

    /**
     * The host's own color scheme, when we know it ('light' | 'dark'; '' = unknown).
     *
     * v1.6.0: the host applies its palette by writing THREE attributes — and
     * none of them is a class on <html>:
     *   documentElement.style.colorScheme       (dsh-client-ui-layout/src/client/theme-presenter.ts:71)
     *   documentElement[data-ds-theme-source]   (:72-73)
     *   body[data-ds-dark-theme]                 (:75-76)
     * The old class-only MutationObserver could never see those, so a theme
     * switch only reached us through the 5s fallback sweep. The host publishes
     * the same information as a public event ('theme/change', ui-theme
     * src/client/index.ts:144/438) and as a service (ctx.provide('theme'),
     * :609) whose snapshot carries `active.colorScheme` — read that instead
     * and keep the DOM probe only as the fallback for hosts without it.
     */
    let hostColorScheme = ''

    /** Read the host's current color scheme out of the theme service, if any. */
    function readThemeServiceScheme() {
      try {
        const theme = optionalService('theme')
        if (!theme) return ''
        const snapshot = typeof theme.getTheme === 'function' ? theme.getTheme() : null
        if (!snapshot) return ''
        const active = snapshot.active || snapshot
        const scheme = active && (active.colorScheme || active.scheme)
        if (scheme === 'dark' || scheme === 'light') return scheme
      } catch (error) {
        /* service absent on this host build */
      }
      return ''
    }

    /**
     * The host's color scheme, read from the DOM attributes the host
     * ACTUALLY writes. '' when it wrote none of them.
     *
     * The runtime palette application writes
     *   <html>[data-ds-theme-source]  ('dark' | 'light' | 'system')
     *   <html>.style.colorScheme
     *   <body>[data-ds-dark-theme]    (present only when the RESOLVED scheme
     *                                   is dark)
     * (dsh-client-ui-layout/src/client/theme-presenter.ts:69-76). With the
     * 'system' preference the resolved scheme still decides, and it decides
     * through the body attribute — so that attribute is authoritative in
     * every case, while `data-ds-theme-source` only speaks for the explicit
     * choices.
     */
    function readDomColorScheme() {
      try {
        const root = document.documentElement
        const body = document.body
        if (!root || !body) return ''
        const source = root.getAttribute('data-ds-theme-source')
        if (source === 'dark' || source === 'light') return source
        if (body.hasAttribute('data-ds-dark-theme')) return 'dark'
        if (source === 'system') return 'light'
      } catch (error) {
        /* fall through */
      }
      return ''
    }

    /**
     * The host's RESOLVED color scheme, read LIVE from the signals the host's
     * own theme presenter writes. Never cached.
     *
     * The presenter (dsh-client-ui-layout/src/client/theme-presenter.ts:69-76)
     * writes the RESOLVED scheme to
     *   <html>.style.colorScheme / getComputedStyle(<html>).colorScheme
     *   <html>[data-ds-theme-source]  (the resolved scheme, or 'system')
     *   <body>[data-ds-dark-theme]    (present only when it resolved to dark)
     * so those are the authoritative "what is actually on screen" signals.
     *
     * The theme SERVICE is deliberately the LAST resort, not the primary: a
     * third-party custom theme (e.g. a wallpaper plugin registering its own
     * 'custom-color' theme) can make theme.getTheme().active.colorScheme
     * disagree with the palette in use, and caching that value shadows the
     * live signals — which is exactly how the plugin stayed light while the
     * host had already gone dark.
     *
     * '' when the host wrote none of them.
     */
    function readHostSchemeLive() {
      try {
        const root = document.documentElement
        if (!root) return ''
        const inline = root.style && root.style.colorScheme
        if (inline === 'dark' || inline === 'light') return inline
        // <html>, NOT <body>: a body-level color-scheme declaration does not
        // inherit, so reading body reports 'light' inside a dark palette.
        const cs = window.getComputedStyle(root).colorScheme
        if (cs === 'dark' || cs === 'light') return cs
      } catch (error) {
        /* fall through */
      }
      return readDomColorScheme()
    }

    /**
     * Best-effort dark-surface detection, used only to pick the OPAQUE base
     * color under the popup menu. Four signals, in order:
     *   1. the host's own resolved scheme (live, from its presenter);
     *   2. the theme service's answer (fallback for hosts with no presenter);
     *   3. computed `color-scheme` on <html>;
     *   4. fallback: luminance of the body background color.
     * Never throws; defaults to light.
     */
    function isDarkSurface() {
      // 1. the host's own resolved scheme — read live, never cached: the host
      //    REMOVES body[data-ds-dark-theme] when it switches back to light, and
      //    a cached answer would keep the popup dark.
      const live = readHostSchemeLive()
      if (live === 'dark') return true
      if (live === 'light') return false
      // 2. the theme service (a third-party custom theme may not match the
      //    palette in use, so this is a fallback, not the primary)
      if (hostColorScheme === 'dark') return true
      if (hostColorScheme === 'light') return false
      // 3. computed `color-scheme` on <html>
      try {
        const cs = window.getComputedStyle(document.documentElement).colorScheme
        if (cs) return /dark/i.test(cs) && !/light/i.test(cs)
      } catch (error) {
        /* fall through */
      }
      // 4. fallback: luminance of the body background color
      try {
        const bg = window.getComputedStyle(document.body).backgroundColor
        const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bg)
        if (m) return (Number(m[1]) + Number(m[2]) + Number(m[3])) < 384
      } catch (error) {
        /* fall through */
      }
      return false
    }

    const DARK_CLASS = 'dpp-dark'

    /**
     * The MutationObserver constructor to use.
     *
     * The bare global is correct in a browser, but a plugin that runs inside
     * another window's realm (the jsdom regression harness, or any host that
     * evaluates us in a sandbox) has no global MutationObserver — `new
     * MutationObserver` would throw ReferenceError and the observer would
     * silently never exist. Prefer the window we were handed.
     */
    function mutationObserverFor(callback) {
      try {
        if (typeof window !== 'undefined' && typeof window.MutationObserver === 'function') {
          return new window.MutationObserver(callback)
        }
      } catch (error) {
        /* fall through to the global */
      }
      try {
        if (typeof MutationObserver === 'function') return new MutationObserver(callback)
      } catch (error) {
        /* no observer available at all */
      }
      return null
    }

    /** Toggle html.dpp-dark so the opaque menu base follows the host theme. */
    function applyTheme() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      // The theme service may be provided a tick after our fiber starts, so
      // re-read it on every pass. Only the SERVICE answer is cached: the DOM
      // attributes are read live inside isDarkSurface(), because the host
      // removes them when it switches back.
      const service = readThemeServiceScheme()
      if (service) hostColorScheme = service
      root.classList.toggle(DARK_CLASS, isDarkSurface())
    }

    // ------------------------------------------------------------- numeric config

    function clampNum(v, min, max) {
      return Math.min(max, Math.max(min, v))
    }

    /** Read a persisted integer, clamped; falls back to `def` on any problem. */
    function readNum(key, def, min, max) {
      try {
        const raw = window.localStorage.getItem(key)
        const n = raw === null ? NaN : Number(raw)
        if (Number.isFinite(n)) return clampNum(Math.round(n), min, max)
      } catch (error) {
        /* fall through */
      }
      return def
    }

    /** Generic persisted boolean flag, default ON ('0' = off). */
    function readFlag(key) {
      try {
        return window.localStorage.getItem(key) !== '0'
      } catch (error) {
        return true
      }
    }

    function writeFlag(key, value) {
      try {
        window.localStorage.setItem(key, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    function readPanelMax() {
      return readNum(PANEL_MAX_KEY, PANEL_MAX_DEFAULT, 8, 80)
    }

    function readFootMax() {
      return readNum(FOOT_MAX_KEY, FOOT_MAX_DEFAULT, 5, 60)
    }

    function readOverlayMax() {
      return readNum(OVERLAY_MAX_KEY, OVERLAY_MAX_DEFAULT, 30, 90)
    }

    function readQrSize() {
      return readNum(QR_SIZE_KEY, QR_SIZE_DEFAULT, 80, 256)
    }

    function writePanelMax(v) {
      try {
        window.localStorage.setItem(PANEL_MAX_KEY, String(clampNum(Math.round(v), 8, 80)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeFootMax(v) {
      try {
        window.localStorage.setItem(FOOT_MAX_KEY, String(clampNum(Math.round(v), 5, 60)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeOverlayMax(v) {
      try {
        window.localStorage.setItem(OVERLAY_MAX_KEY, String(clampNum(Math.round(v), 30, 90)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeQrSize(v) {
      try {
        window.localStorage.setItem(QR_SIZE_KEY, String(clampNum(Math.round(v), 80, 256)))
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------------------------------- whitelist

    // Cache for the parsed whitelist (invalidated on every write path):
    // isWhitelisted() runs per row per refresh pass, and re-parsing the whole
    // JSON array per row multiplied that cost for no benefit.
    let whitelistCache = null

    /** Persisted whitelist: an array of non-empty name strings. */
    function readWhitelist() {
      // Cached: isWhitelisted() runs per row per refresh tick, and parsing the
      // whole JSON array for every row multiplied that cost. The cache is
      // invalidated on every write path, so it cannot go stale.
      if (whitelistCache) return whitelistCache
      try {
        const parsed = JSON.parse(window.localStorage.getItem(WHITELIST_KEY) || '[]')
        if (Array.isArray(parsed)) {
          whitelistCache = parsed
            .filter(function (n) {
              return typeof n === 'string' && n.trim().length > 0
            })
            .map(function (n) {
              return n.trim()
            })
          return whitelistCache
        }
      } catch (error) {
        /* fall through */
      }
      whitelistCache = []
      return whitelistCache
    }

    function writeWhitelist(list) {
      whitelistCache = null
      try {
        window.localStorage.setItem(WHITELIST_KEY, JSON.stringify(list || []))
      } catch (error) {
        /* session-only */
      }
    }

    /** Persisted label→id map (plain object). Missing key → empty object. */
    // Cached like the whitelist: isWhitelisted(label, id) reads it per row
    // per pass; invalidated on every write path.
    let labelIdMapCache = null
    function readLabelIdMap() {
      if (labelIdMapCache) return labelIdMapCache
      try {
        const parsed = JSON.parse(window.localStorage.getItem(LABEL_ID_MAP_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          labelIdMapCache = parsed
          return labelIdMapCache
        }
      } catch (error) {
        /* fall through */
      }
      labelIdMapCache = {}
      return labelIdMapCache
    }

    function mergeLabelIdMap(pairs) {
      try {
        const map = readLabelIdMap()
        let changed = false
        pairs.forEach(function (pair) {
          if (pair && pair.id && pair.label) {
            // b67: keep ONE current label per id — after a locale switch the
            // stale-label key would linger and id-first lookups (hidden/
            // renames) would resolve to a dead string.
            Object.keys(map).forEach(function (label) {
              if (label !== pair.label && map[label] === pair.id) {
                delete map[label]
                changed = true
              }
            })
            if (map[pair.label] !== pair.id) {
              map[pair.label] = pair.id
              changed = true
            }
          }
        })
        if (changed) {
          window.localStorage.setItem(LABEL_ID_MAP_KEY, JSON.stringify(map))
          labelIdMapCache = null // keep the isWhitelisted fast path honest
        }
      } catch (error) {
        /* session-only */
      }
    }

    // ------------------------------------------------------- layout presets

    /**
     * Snapshot the whole panel layout (v1.0.0). Captured state:
     * unpinned store, top pins, overlay group folds, whitelist, icon-only,
     * compact-footer master. NOT captured: numeric sliders (they are visual
     * tuning, not layout identity) and the Recent queue (behavioral, not
     * spatial) — the same trade layout-organizer makes for its presets.
     */
    function captureLayoutSnapshot() {
      return {
        unpinned: Array.from(readUnpinned()),
        topPins: readTopPins(),
        folds: readGroupFolds(),
        whitelist: readWhitelist(),
        iconOnly: readFlag(ICONONLY_KEY),
        tidy: readTidy(),
      }
    }

    /**
     * Apply a snapshot atomically: write every captured key, invalidate the
     * caches, re-run every applier, and let the refresh pass replay the
     * sidebar rows. Rows whose id the snapshot mentions but the host no
     * longer shows simply match nothing (no error, no residue).
     */
    function applyLayoutSnapshot(snap) {
      if (!snap || typeof snap !== 'object') return
      try {
        writeUnpinned(new Set(Array.isArray(snap.unpinned) ? snap.unpinned : []))
        // v1.7: this wrote a full new pin intent — disarm the mirror so the
        // next slot mount RESTORES it to the host instead of recording the
        // host's stale state over it.
        mirrorArmed = false
        writeTopPins(Array.isArray(snap.topPins) ? snap.topPins : [])
        writeGroupFolds(snap.folds && typeof snap.folds === 'object' ? snap.folds : {})
        writeWhitelist(Array.isArray(snap.whitelist) ? snap.whitelist : [])
        writeFlag(ICONONLY_KEY, snap.iconOnly !== false)
        writeTidy(snap.tidy !== false)
        // Caches + every applier, mirroring importSettings' replay list.
        whitelistCache = null
        labelIdMapCache = null
        applyConfig()
        applyTidy()
        applyIconOnly()
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        applyTopPins()
        ensureLauncher()
        // If a menu is open, close it: the next open rebuilds from scratch and
        // replays the snapshot's fold states (replayGroupFolds is an openOverlay
        // closure, unreachable from here — closing is the clean replay path).
        try {
          if (overlay) closeOverlay()
        } catch (error) {
          /* ignore */
        }
      } catch (error) {
        /* preset application is cosmetic: never break the host */
      }
    }

    function readPresets() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(PRESETS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writePresets(obj) {
      try {
        window.localStorage.setItem(PRESETS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    function savePreset(name) {
      const n = String(name || '').trim()
      if (!n) return false
      const presets = readPresets()
      presets[n] = captureLayoutSnapshot()
      writePresets(presets)
      try {
        window.localStorage.setItem(PRESET_NAME_KEY, n)
      } catch (error) {
        /* active-marker is cosmetic */
      }
      return true
    }

    function applyPreset(name) {
      const presets = readPresets()
      const snap = presets[name]
      if (!snap) return false
      applyLayoutSnapshot(snap)
      try {
        window.localStorage.setItem(PRESET_NAME_KEY, String(name))
      } catch (error) {
        /* active-marker is cosmetic */
      }
      return true
    }

    function deletePreset(name) {
      const presets = readPresets()
      if (!(name in presets)) return false
      delete presets[name]
      writePresets(presets)
      try {
        if (window.localStorage.getItem(PRESET_NAME_KEY) === name) {
          window.localStorage.removeItem(PRESET_NAME_KEY)
        }
      } catch (error) {
        /* ignore */
      }
      return true
    }

    function readActivePreset() {
      try {
        return window.localStorage.getItem(PRESET_NAME_KEY) || ''
      } catch (error) {
        return ''
      }
    }

    // ------------------------------------------------------- custom groups

    /** {groupId: {name, labels:[...]}} — labels are panel aria-labels. */
    function readCustomGroups() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_GROUPS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writeCustomGroups(obj) {
      try {
        window.localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    /** Labels already assigned to SOME custom group (set-like object). */
    function customGroupedLabels() {
      const groups = readCustomGroups()
      const assigned = {}
      Object.keys(groups).forEach(function (gid) {
        const labels = groups[gid] && groups[gid].labels
        if (!Array.isArray(labels)) return
        labels.forEach(function (l) {
          if (typeof l === 'string' && l.length > 0) assigned[l] = true
        })
      })
      return assigned
    }


    /**
     * Whether an entry is whitelisted. Entries are stored id-FIRST since
     * v0.8.0 (stable across UI-language switches); entries written by older
     * builds are plain labels, still matched case-insensitively-exact. A
     * legacy label entry that now maps to `id` in the label→id map also
     * matches — so a whitelist kept in Chinese keeps working after switching
     * the UI to English, and vice versa. Pass both label and id whenever the
     * id is known; label-only callers (arbitrary DOM sweep) still work.
     */
    function isWhitelisted(label, id) {
      const l = String(label || '').trim().toLowerCase()
      if (l.length === 0 && !id) return false
      const list = readWhitelist()
      const map = id ? readLabelIdMap() : null
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]
        if (id && entry === id) return true
        if (l.length > 0 && entry.toLowerCase() === l) return true
        if (id && map[entry] === id) return true
      }
      return false
    }

    /**
     * Every selectable sidebar entry: {label, id|null}. Global panel rows
     * resolve id via the persisted label→id map; plugin entry (family) rows
     * have no panel id — they stay label-keyed. De-duplicated by label. This
     * is what the Settings whitelist picker offers — no free-text typing.
     */
    function readAvailableEntries() {
      const out = []
      const seen = {}
      function push(label, id) {
        const l = String(label || '').trim()
        if (l.length === 0) return
        const key = l.toLowerCase()
        if (seen[key]) return
        seen[key] = true
        out.push({ label: l, id: id || null })
      }
      try {
        const map = readLabelIdMap()
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            const l = (row.getAttribute('aria-label') || row.textContent || '').trim()
            push(l, map[l])
          })
        }
        findFamilyRows().concat(findFooterRows()).forEach(function (row) {
          push(rowLabel(row))
        })
      } catch (error) {
        /* sidebar not ready: empty list */
      }
      return out
    }

    /**
     * Push the numeric tunables into CSS custom properties on <html>. The
     * stylesheet reads var(--dpp-panel-list-max) / var(--dpp-foot-max) etc.,
     * so this is the whole "apply" path — no stylesheet rewriting, instant.
     */
    function applyConfig() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root || !root.style) return
      try {
        root.style.setProperty('--dpp-panel-list-max', readPanelMax() + 'vh')
        root.style.setProperty('--dpp-foot-max', readFootMax() + 'vh')
        root.style.setProperty('--dpp-overlay-max', readOverlayMax() + 'vh')
        root.style.setProperty('--dpp-qr-size', readQrSize() + 'px')
      } catch (error) {
        /* ignore */
      }
    }

    // ---------------------------------------------------- settings transfer
    // v1.2.0: clipboard and file export/import share one dump builder and one
    // replay chain. Lives at factory scope so it works before the Settings
    // component ever renders; the Settings section wraps these with a React
    // state refresh. A window.__dppTransfer hook exposes the closures for the
    // jsdom regression (React is stubbed there, so the component never runs).

    function buildDump() {
      // Every plugin-owned localStorage key as one JSON blob. Restores are
      // full-value (no merging): import replaces.
      const dump = { __plugin: 'dsh-panel-pins', __version: VERSION }
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.indexOf('dsh-panel-pins:') === 0) {
          dump[key] = window.localStorage.getItem(key)
        }
      }
      return JSON.stringify(dump, null, 2)
    }

    // ------------------------------------------------------------- feedback
    // v1.3.3: click-triggered feedback channels. No timers, no network calls
    // of our own — window.open happens synchronously inside the click handler
    // (async-opened popups are blocked by the webview), everything else is
    // string building around data the page already has.

    function hostClientVersion() {
      try {
        const v = window.__DSH_CLIENT_VERSION__
        if (typeof v === 'string' && v.length > 0) return v
      } catch (error) {
        /* ignore */
      }
      return 'unknown'
    }

    function clientLanguage() {
      try {
        const lang = document.documentElement && document.documentElement.lang
        if (lang) return String(lang)
      } catch (error) {
        /* fall through */
      }
      try {
        return (navigator && navigator.language) || 'unknown'
      } catch (error) {
        return 'unknown'
      }
    }

    /**
     * One paragraph of environment facts for the issue body / diagnostics
     * copy. Deliberately minimal and user-deletable: plugin version, host
     * version, UA, language. NEVER includes session content, panel labels,
     * renames or any localStorage values — those stay manual-only (the dump
     * the user may paste contains labels, so copying it is the user's call).
     */
    function feedbackEnvBody() {
      const lines = [
        '### ' + LABEL.fbEnvTitle,
        '- dsh-panel-pins v' + VERSION,
        '- DSH: ' + hostClientVersion(),
        '- Platform: ' + (typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : 'unknown'),
        '- Language: ' + clientLanguage(),
      ]
      return lines.join('\n')
    }

    function openFeedbackIssue() {
      try {
        const url = new URL(FEEDBACK_ISSUE_URL)
        url.searchParams.set('title', '[feedback] v' + VERSION)
        url.searchParams.set('body', feedbackEnvBody() + '\n\n### ' + LABEL.fbProblem + '\n\n\n### ' + LABEL.fbSteps + '\n\n')
        window.open(url.href, '_blank', 'noopener,noreferrer')
      } catch (error) {
        /* URL constructor or open failed — degrade silently */
      }
    }

    function readSurveyConfig() {
      try {
        const config = window.__DSH_CONTACT_CONFIG__
        if (config && typeof config === 'object' && typeof config.contactFormUrl === 'string' && /^https:\/\//.test(config.contactFormUrl)) {
          return config
        }
      } catch (error) {
        /* ignore */
      }
      return null
    }

    function openFeedbackSurvey() {
      try {
        // The plugin owner's own form (see FEEDBACK_SURVEY_URL note). The
        // shell's contactSource is attribution context only — never the
        // destination.
        const config = readSurveyConfig()
        const url = new URL(FEEDBACK_SURVEY_URL)
        // Host questionnaire contract (panel-layout precedent): hidden fields
        // are declared with hide_<name>=1 and carried with prefill_<name>.
        url.searchParams.set('hide_source', '1')
        const source = config && typeof config.contactSource === 'string' ? config.contactSource : ''
        url.searchParams.set('prefill_source', 'dsh-panel-pins' + (source ? '/' + source : ''))
        url.searchParams.set('hide_device_info', '1')
        let ratio = 1
        let sw = 0
        let sh = 0
        try {
          ratio = window.devicePixelRatio && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
          sw = Math.round((window.screen && window.screen.width) * ratio)
          sh = Math.round((window.screen && window.screen.height) * ratio)
        } catch (error) {
          /* ignore */
        }
        const device = [typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '']
        if (sw > 0 && sh > 0) device.push('screen_resolution=' + sw + 'x' + sh)
        url.searchParams.set('prefill_device_info', device.filter(Boolean).join('; '))
        window.open(url.href, '_blank', 'noopener,noreferrer')
      } catch (error) {
        /* degrade silently */
      }
    }

    function copyFeedbackDiagnostics() {
      // The full settings dump + the environment block. Clipboard-write only;
      // if the webview refuses, say so — never fall back to pasting anywhere.
      let text = ''
      try {
        text = buildDump() + '\n\n' + feedbackEnvBody()
      } catch (error) {
        showToast(LABEL.fbDiagFail)
        return
      }
      const fail = function () {
        showToast(LABEL.fbDiagFail)
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          Promise.resolve(navigator.clipboard.writeText(text)).then(
            function () {
              showToast(LABEL.fbDiagDone)
            },
            fail,
          )
          return
        }
      } catch (error) {
        /* fall through to the textarea fallback */
      }
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        let ok = false
        try {
          ok = document.execCommand('copy')
        } catch (error) {
          ok = false
        }
        document.body.removeChild(ta)
        if (ok) showToast(LABEL.fbDiagDone)
        else fail()
      } catch (error) {
        fail()
      }
    }


    function exportSettingsToClipboard() {
      try {
        const json = buildDump()
        const write = function (text) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text)
          }
          // Fallback: hidden textarea + execCommand (older webviews).
          const ta = document.createElement('textarea')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          try {
            document.execCommand('copy')
          } catch (error) {
            /* ignore */
          }
          document.body.removeChild(ta)
          return Promise.resolve()
        }
        Promise.resolve(write(json)).then(
          function () {
            showToast(LABEL.setExportDone)
          },
          function () {
            showToast(zh ? '复制失败：剪贴板不可用' : 'Copy failed: clipboard unavailable')
          },
        )
      } catch (error) {
        showToast(zh ? '导出失败' : 'Export failed')
      }
    }

    function exportSettingsToFile() {
      // Download the dump as a JSON file (a real file survives machine swaps
      // better than a clipboard buffer).
      let json = null
      try {
        json = buildDump()
      } catch (error) {
        showToast(zh ? '导出失败' : 'Export failed')
        return
      }
      try {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'dsh-panel-pins-settings.json'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.setTimeout(function () {
          URL.revokeObjectURL(url)
        }, 4000)
        showToast(LABEL.setExportDone)
      } catch (error) {
        showToast(LABEL.setExportFileFail)
      }
    }

    function applyImportedDumpShared(dump) {
      // Write every key back, invalidate every cache, re-apply everything.
      // Returns true on success; callers own toasts and the Settings state
      // refresh (see applyImportedDump in the Settings section).
      try {
        Object.keys(dump).forEach(function (key) {
          if (key.indexOf('dsh-panel-pins:') !== 0) return
          const value = dump[key]
          if (typeof value === 'string') window.localStorage.setItem(key, value)
        })
        // v1.7: an import overwrites the whole unpinned store — disarm the
        // mirror so the next slot mount restores the imported intent to the
        // host (see applyLayoutSnapshot).
        mirrorArmed = false
        whitelistCache = null
        labelIdMapCache = null
        applyConfig()
        applyTidy()
        applyIconOnly()
        applyTheme()
        applyFold()
        applyFamily()
        applyTopPins()
        ensureLauncher()
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        ensureLauncher()
        return true
      } catch (error) {
        return false
      }
    }

    function importSettingsFromClipboard() {
      // Read the clipboard, validate against the __plugin sentinel, replay.
      const read = navigator.clipboard && navigator.clipboard.readText
        ? navigator.clipboard.readText()
        : Promise.reject(new Error('no clipboard api'))
      Promise.resolve(read).then(
        function (text) {
          let dump = null
          try {
            dump = JSON.parse(String(text || ''))
          } catch (error) {
            dump = null
          }
          if (!dump || dump.__plugin !== 'dsh-panel-pins' || typeof dump !== 'object') {
            showToast(LABEL.setImportBad)
            return
          }
          if (applyImportedDumpShared(dump)) {
            showToast(LABEL.setImportDone)
          } else {
            showToast(zh ? '导入失败' : 'Import failed')
          }
        },
        function () {
          showToast(zh ? '无法读取剪贴板：请手动复制后重试' : 'Cannot read clipboard — copy again and retry')
        },
      )
    }

    function importSettingsFromText(text, sourceLabel) {
      // Shared validation + replay for every text-bearing import channel
      // (clipboard / file / drag-drop). sourceLabel picks the rejection toast.
      let dump = null
      try {
        dump = JSON.parse(String(text || ''))
      } catch (error) {
        dump = null
      }
      if (!dump || dump.__plugin !== 'dsh-panel-pins' || typeof dump !== 'object') {
        showToast(sourceLabel === 'file' ? LABEL.setImportFileBad : LABEL.setImportBad)
        return false
      }
      if (applyImportedDumpShared(dump)) {
        showToast(sourceLabel === 'file' ? LABEL.setImportFileDone : LABEL.setImportDone)
        return true
      }
      showToast(zh ? '导入失败' : 'Import failed')
      return false
    }

    function importSettingsFromFile() {
      // Pick a previously exported settings JSON file. A one-shot
      // <input type="file"> is appended to the body on demand; the change
      // handler validates and re-applies, and a cancel (no change event)
      // leaves nothing behind — a 120s safety net removes it anyway.
      let input = null
      try {
        input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json,.json'
        input.style.display = 'none'
        let done = false
        input.addEventListener('change', function () {
          done = true
          const file = input.files && input.files[0]
          if (!file) {
            document.body.removeChild(input)
            return
          }
          const reader = new FileReader()
          reader.onload = function () {
            try {
              document.body.removeChild(input)
            } catch (error) {
              /* already detached */
            }
            importSettingsFromText(String(reader.result || ''), 'file')
          }
          reader.onerror = function () {
            try {
              document.body.removeChild(input)
            } catch (error) {
              /* already detached */
            }
            showToast(zh ? '导入失败' : 'Import failed')
          }
          try {
            reader.readAsText(file)
          } catch (error) {
            showToast(zh ? '导入失败' : 'Import failed')
          }
        })
        document.body.appendChild(input)
        window.setTimeout(function () {
          if (!done && input && input.parentNode) document.body.removeChild(input)
        }, 120000)
        input.click()
      } catch (error) {
        if (input && input.parentNode) {
          try {
            document.body.removeChild(input)
          } catch (cleanupError) {
            /* ignore */
          }
        }
        showToast(zh ? '导入失败' : 'Import failed')
      }
    }

    // Test hook: the jsdom regression drives these closures directly (React
    // is stubbed there, so the Settings section never renders).
    try {
      window.__dppTransfer = {
        buildDump: buildDump,
        exportSettingsFile: exportSettingsToFile,
        importSettingsFile: importSettingsFromFile,
        importSettingsFromText: importSettingsFromText,
        applyImportedDump: applyImportedDumpShared,
      }
    } catch (error) {
      /* non-window context */
    }

    // v1.3.3 test hook: the jsdom regression drives the feedback closures
    // directly (React is stubbed, the Settings card never renders; window.open
    // and clipboard.writeText are stubbed per-test).
    try {
      window.__dppFeedback = {
        feedbackEnvBody: feedbackEnvBody,
        openFeedbackIssue: openFeedbackIssue,
        openFeedbackSurvey: openFeedbackSurvey,
        copyFeedbackDiagnostics: copyFeedbackDiagnostics,
        hostClientVersion: hostClientVersion,
        readSurveyConfig: readSurveyConfig,
      }
    } catch (error) {
      /* non-window context */
    }

    // ------------------------------------------------------ plugin entry rows

    /**
     * Whether third-party plugin entry rows are collected into the launcher.
     * ON by default: the same complaint as the panel rows — every sidebar
     * plugin injects an entry row and the list grows unbounded.
     */
    function readFamily() {
      try {
        const raw = window.localStorage.getItem(FAMILY_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeFamily(value) {
      try {
        window.localStorage.setItem(FAMILY_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    /**
     * b76: whether footer-area plugin entries (rc.3: the kanban button below
     * _footArea) are collected into the launcher. DEFAULT OFF — the original
     * plugin constraint was "footer entries are never collected"; the user
     * explicitly lifted it for these entries (they used to render at the top
     * of the sidebar before the rc.3 host moved the injection point).
     */
    function readFooter() {
      try {
        const raw = window.localStorage.getItem(FOOTER_KEY)
        if (raw === '1') return true
        if (raw === '0') return false
      } catch (error) {
        /* fall through to the default */
      }
      return false
    }

    function writeFooter(value) {
      try {
        window.localStorage.setItem(FOOTER_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // ------------------------------------------------------------ host DOM lookups

    function findPanelListNav() {
      // css-modules hash agnostic: class is "<hash>_panelList".
      try {
        return document.querySelector('nav[class$="_panelList"]')
      } catch (error) {
        return null
      }
    }

    // -------------------------------------------------- scroll contract (v1.4.4)

    /**
     * Detected sidebar scroll contract: 'rc5' (wheel hand-off — viewport
     * scrolls the navigation away, then the workspace list seat scrolls),
     * 'rc3' (shared viewport holds list+region, plugin must restructure it),
     * or null (sidebar not mounted / unknown layout — no structural rules).
     * Detection: rc.5 marks its viewport with data-sidebar-scrollport and its
     * workspace list seat with data-sidebar-list-area; rc.3 has neither.
     * Exposed as window.__dppScrollContract for the jsdom regression.
     */
    let scrollContract = null

    function detectScrollContract() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      const scrollArea = document.querySelector('div[class$="_scrollArea"]')
      let next = null
      if (scrollArea) {
        next = scrollArea.hasAttribute('data-sidebar-scrollport') ? 'rc5' : 'rc3'
      }
      if (next !== scrollContract) {
        scrollContract = next
        try {
          window.__dppScrollContract = scrollContract
        } catch (error) { /* expose is diagnostic only */ }
      } else if (window.__dppScrollContract === undefined) {
        try {
          window.__dppScrollContract = scrollContract
        } catch (error) { /* expose is diagnostic only */ }
      }
      root.classList.toggle(RC3_CLASS, scrollContract === 'rc3')
      // v1.4.8: rc.5 marker dispatches the LITE nav-wheel driver in
      // ensureLauncher (no CSS is gated on this class — see RC5_CLASS).
      root.classList.toggle(RC5_CLASS, scrollContract === 'rc5')
    }

    /** Panel rows = nav button children, minus the More launcher and our launcher. */
    function findPanelRows(nav) {
      if (!nav) return []
      let rows = []
      try {
        // b75: rc.3 wraps every row button in a DIV[class*="_panelEntry"]
        // flex child (row BUTTON._panelRow + host-native unpin button).
        rows = Array.prototype.slice.call(nav.querySelectorAll('button[class*="_panelRow"]'))
      } catch (error) {
        rows = []
      }
      rows = rows.filter(function (b) {
        return !b.hasAttribute(LAUNCHER_ATTR) && b.getAttribute('aria-haspopup') !== 'menu'
      })
      if (rows.length) return rows
      // Legacy hosts: the row BUTTONs are direct nav children (may lack the
      // _panelRow marker class in very old builds).
      const kids = Array.prototype.slice.call(nav.children)
      const out = []
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i]
        if (!el.getAttribute) continue
        if (el.hasAttribute(LAUNCHER_ATTR)) continue
        if (el.getAttribute('aria-haspopup') === 'menu') continue
        if (el.tagName !== 'BUTTON') continue
        out.push(el)
      }
      return out
    }

    // ------------------------------------------- row unit helpers (b75)
    // A ROW UNIT is the flex child of the nav that visually owns a panel
    // row: legacy = the row BUTTON itself; rc.3 = the DIV._panelEntry
    // wrapper (row button + host unpin button). Visibility inline styles,
    // top-pin / row-order `order` values and drag marks must land on the
    // UNIT — writing them on a nested button has no flex effect.

    /** The nav flex child that visually owns `btn` (or null). */
    function rowUnitOf(nav, btn) {
      if (!nav || !btn) return null
      let el = btn
      for (let i = 0; el && el !== nav && i < 6; i++) {
        if (el.parentNode === nav) return el
        el = el.parentNode
      }
      return null
    }

    /** The row BUTTON inside a unit (the unit itself for legacy navs). */
    function rowBtnOf(unit) {
      if (!unit || !unit.querySelector) return null
      if (unit.tagName === 'BUTTON') return unit
      try {
        return unit.querySelector('button[class*="_panelRow"]') || unit.querySelector('button')
      } catch (error) {
        return null
      }
    }

    /** A row BUTTON: not our launcher, not the host More menu, not the
     * host unpin control. */
    function isRowButton(btn) {
      if (!btn || btn.tagName !== 'BUTTON') return false
      if (btn.hasAttribute(LAUNCHER_ATTR)) return false
      if (btn.getAttribute('aria-haspopup') === 'menu') return false
      const cls = String(btn.className || '')
      if (cls.indexOf('_panelUnpin') !== -1) return false
      return true
    }

    /** Sweep the row UNITS of a nav. fn(unit, btn, label) per row; our
     * launcher and the host More anchor are skipped. */
    function forEachRowUnit(nav, fn) {
      if (!nav) return
      Array.prototype.forEach.call(nav.children, function (unit) {
        if (!unit.getAttribute) return
        if (unit.hasAttribute(LAUNCHER_ATTR)) return
        const btn = rowBtnOf(unit)
        if (!isRowButton(btn)) return
        const label = ((btn.getAttribute('aria-label')) || btn.textContent || '').trim()
        fn(unit, btn, label)
      })
    }

    // ------------------------------------------------- family row lookups
    // Structural derivation, zero literal selectors (per weibaohui/
    // dsh-sidebar-tidy v0.1.0): the new-session container is the anchor, the
    // sidebar root is its container that also directly holds the panel-list
    // nav, and family rows are the CLICKABLE root children strictly between
    // the anchor and the nav — direct <button>s or containers wrapping one
    // button (wrapped third-party injections). Bottom/footer entries are
    // never considered: they live outside this span.

    /** The root child that holds the new-session control (or null). */
    function findAnchor(root) {
      if (!root) return null
      try {
        const el = document.querySelector('[class$="_newSession"]')
        if (!el) return null
        let node = el
        for (let i = 0; node && node !== document.body && i < 8; i++) {
          if (node.parentNode === root) return node
          node = node.parentNode
        }
      } catch (error) {
        /* ignore */
      }
      return null
    }

    /** Whether the element triggers something: a button or wraps one. */
    function isClickableRow(el) {
      if (!el || !el.querySelector) return false
      if (el.tagName === 'BUTTON') return true
      if (el.hasAttribute(LAUNCHER_ATTR)) return false
      // A wrapped injection: the container's first meaningful child is a button.
      return el.querySelector(':scope > button') !== null
    }

    /**
     * Family rows = clickable root children strictly between the new-session
     * anchor and the panel-list nav. Returns [] when the structure cannot be
     * derived (anchor or nav missing) — never guess.
     */
    function findFamilyRows() {
      try {
        const nav = findPanelListNav()
        if (!nav) return []
        // b75: rc.3 nests the nav inside DIV._scrollRegion, so the sidebar
        // root is the nearest ancestor that ALSO holds the new-session
        // anchor. Legacy hosts resolve on the first hop (nav.parentNode).
        let root = null
        let anchor = null
        for (let node = nav.parentNode, hop = 0; node && node !== document.body && hop < 8; node = node.parentNode, hop++) {
          const a = findAnchor(node)
          if (a) { root = node; anchor = a; break }
        }
        if (!root || !anchor) return []
        const kids = Array.prototype.slice.call(root.children)
        const ai = kids.indexOf(anchor)
        let ni = kids.indexOf(nav)
        if (ni < 0) {
          for (let i = 0; i < kids.length; i++) {
            if (kids[i].contains(nav)) { ni = i; break }
          }
        }
        if (ai < 0 || ni < 0 || ni <= ai + 1) return []
        const out = []
        for (let i = ai + 1; i < ni; i++) {
          if (isClickableRow(kids[i])) out.push(kids[i])
        }
        // b75: third-party rows may inject INSIDE the nav's container
        // (rc.3: scrollRegion), ahead of the scrollArea holding the nav —
        // scan those too, skipping host chrome (the scroll-fade decorator).
        const container = kids[ni]
        if (container !== nav) {
          const sub = Array.prototype.slice.call(container.children)
          let navSub = -1
          for (let i = 0; i < sub.length; i++) {
            if (sub[i].contains(nav)) { navSub = i; break }
          }
          for (let i = 0; i < navSub; i++) {
            const el = sub[i]
            if (!el.getAttribute) continue
            if (String(el.className).indexOf('_scrollFade') !== -1) continue
            if (isClickableRow(el)) out.push(el)
          }
        }
        return out
      } catch (error) {
        return []
      }
    }

    /**
     * b76: footer rows = clickable root children AFTER the child holding the
     * panel-list nav (rc.3: the kanban button following _footArea). Uses the
     * same anchor-root discovery as findFamilyRows; host chrome (_footArea)
     * and our own nodes are never listed. Returns [] when the structure
     * cannot be derived — never guess.
     */
    function findFooterRows() {
      try {
        const nav = findPanelListNav()
        if (!nav) return []
        let root = null
        for (let node = nav.parentNode, hop = 0; node && node !== document.body && hop < 8; node = node.parentNode, hop++) {
          if (findAnchor(node)) { root = node; break }
        }
        if (!root) return []
        const kids = Array.prototype.slice.call(root.children)
        let ni = kids.indexOf(nav)
        if (ni < 0) {
          for (let i = 0; i < kids.length; i++) {
            if (kids[i].contains(nav)) { ni = i; break }
          }
        }
        if (ni < 0) return []
        const out = []
        for (let i = ni + 1; i < kids.length; i++) {
          const el = kids[i]
          if (!el.getAttribute) continue
          if (el.hasAttribute(LAUNCHER_ATTR)) continue
          if (String(el.className).indexOf('_footArea') !== -1) continue
          if (isClickableRow(el)) out.push(el)
        }
        return out
      } catch (error) {
        return []
      }
    }

    /** Click the ORIGINAL control behind a row (unwrap wrapped injections). */
    function triggerRow(row) {
      try {
        const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
        if (btn) btn.click()
      } catch (error) {
        /* ignore */
      }
    }

    function rowLabel(row) {
      const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
      const el = btn || row
      return ((el.getAttribute && el.getAttribute('aria-label')) || el.textContent || '').trim()
    }

    function rowIcon(row) {
      const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
      return svgClone(btn || row, 16)
    }

    /** Apply the persisted family-row visibility (inline display, replayed). */
    function applyFamily() {
      if (typeof document === 'undefined') return
      const hidden = readFamily()
      // v1.3.2: the single-row hidden store is consulted here too — an
      // individually-hidden plugin entry needs the active exemption, and the
      // sweep must also UN-hide rows whose exemption no longer applies.
      const hiddenRows = readHiddenRows()
      // b78: position-agnostic — collect plugin entry rows wherever they sit
      // (top: between the new-session anchor and the panel list; bottom:
      // after the nav's container). One toggle covers both.
      findFamilyRows().concat(findFooterRows()).forEach(function (row) {
        // b52: skip rows with an in-place rename editor (observer race guard,
        // same as applyFold).
        if (row.getAttribute('data-dpp-renaming') === '1') return
        // Whitelisted entries stay in the sidebar no matter what. Family rows
        // have no panel id — match label + map-derived id equivalence.
        // b77: restore the hide computation — the b76 replacement ate this
        // line and every refreshAll pass threw "hide is not defined",
        // aborting the whole chain (launcher mount included).
        // v1.3.2: individually-hidden entries get the active-row exemption
        // through the same shouldHideRow contract as applyFold; the family
        // collection toggle itself never exempts (hiding rows wholesale IS
        // that feature).
        const familyLabel = rowLabel(row)
        const hide = shouldHideRow(familyLabel, hiddenRows.indexOf(familyLabel) !== -1, hidden)
        const want = hide ? 'none' : ''
        if (row.style.display === want) return
        row.style.display = want
        if (hide) row.dataset.dppHidden = '1'
        else delete row.dataset.dppHidden
      })
    }

    /**
     * b76: apply the opt-in footer-entry collection — same semantics as
     * applyFamily (inline display, whitelist still wins, hidden≠gone: the
     * entries stay listed in the launcher's family group).
     */
    function applyFooter() {
      // b78: footer entries merged into the single position-agnostic sweep.
      applyFamily()
    }

    /** Whitelist check for rows whose panel id is unknown: exact label, or
     * any whitelist entry that maps to a panel whose CURRENT label is this
     * one (label→id→reverse-label equivalence across locale switches). */
    function isWhitelistedLabelOrMapped(label) {
      if (isWhitelisted(label)) return true
      const map = readLabelIdMap()
      const id = map[label]
      if (!id) return false
      for (const entry of readWhitelist()) {
        if (map[entry] === id) return true
      }
      return false
    }

    const HIDDEN_MARK = 'dppHidden'

    /**
     * Sweep for rows we hid that drifted out of the structural derivation
     * (a plugin re-inserted or moved its entry). Anything still carrying our
     * marker whose label is now whitelisted gets restored — this is what
     * makes toggling a whitelist entry reliable even when the entry moved.
     * v1.3.2: the active-row exemption rides the same global sweep — a
     * marked row that IS the currently active panel (drift safety net; the
     * canonical per-pass paths are applyFold/applyFamily/applyHiddenRows)
     * must not stay hidden behind our marker.
     */
    function restoreWhitelistedEverywhere() {
      if (typeof document === 'undefined') return
      let marked
      try {
        marked = document.querySelectorAll('[data-dpp-hidden="1"]')
      } catch (error) {
        return
      }
      Array.prototype.forEach.call(marked, function (el) {
        const label =
          (el.getAttribute && el.getAttribute('aria-label')) ||
          rowLabel(el).trim() ||
          (el.textContent || '').trim()
        if (isWhitelistedLabelOrMapped(label) || isActiveRowLabel(label)) {
          el.style.display = ''
          delete el.dataset.dppHidden
        }
      })
    }

    // ---------------------------------------------------------------- fold state
    /**
     * Apply the persisted row-visibility state.
     *
     * The host renders the panel rows AND the "More" button (PanelMoreMenu) as
     * children of the same nav (dsh-client-ui-sidebar/lib/client.js:471-500).
     * Hiding the whole nav would hide the More button too — and that button is
     * the only way to unfold again, so the sidebar would lock itself collapsed
     * with no way out. We therefore hide only the panel rows and always keep
     * the More button (and our own launcher) visible.
     */
    function applyFold() {
      if (typeof document === 'undefined') return
      const nav = findPanelListNav()
      if (!nav) return
      const hidden = readRowsHidden()
      const rows = findPanelRows(nav)
      const renames = readRenames()
      const hiddenRows = readHiddenRows()
      rows.forEach(function (row) {
        // b75: rc.3 wraps each row button in a DIV._panelEntry flex child —
        // visibility and order must target that UNIT; the button only carries
        // labels and rename state. Legacy navs: unit === the row button.
        const unit = rowUnitOf(nav, row) || row
        // b52: an in-place rename editor lives in this row — do not touch
        // its label (the observer fires on the editor insertion and would
        // race the editor's text node).
        if (row.getAttribute('data-dpp-renaming') === '1') return
        // Whitelisted panels stay in the sidebar no matter what. The row's id
        // resolves through the persisted label→id map (locale-change safe).
        const label = (row.getAttribute('aria-label') || row.textContent || '').trim()
        // v1.1.0 display rename: rewrite the visible label text in place.
        // aria-label carries the ORIGINAL label (all lookups — pins, groups,
        // whitelist, context menu — keep matching); only the rendered text
        // and a tooltip show the override.
        const customName =
          typeof renames[label] === 'string' && renames[label].trim() ? renames[label].trim() : null
        const nameEl = row.querySelector('[class$="_label"], .dpp-label') || row
        // b69: carrier lookup shared by the commit and reset passes. Direct
        // text nodes first (b64 preference — reusing the host's own node keeps
        // its commit target stable); when the host nests the text deeper (e.g.
        // an inner span inside the label), fall back to the FIRST non-empty
        // DEEP text node, then any blanked one. A Text node cannot carry
        // attributes, so the marker carrier for the no-text-node-at-all
        // fallback is an ELEMENT span (b48's createTextNode().setAttribute
        // threw and silently killed the whole applyFold pass on deep rows —
        // the b68 walk's renamedRows=0 evidence).
        const findCarrier = function () {
          let blanked = null
          for (const n of nameEl.childNodes) {
            if (n.nodeType !== 3) continue
            if (n.nodeValue && n.nodeValue.trim()) return n
            if (!blanked) blanked = n
          }
          const walker = document.createTreeWalker(nameEl, NodeFilter.SHOW_TEXT)
          let deep = null
          let deepBlanked = null
          let n
          while ((n = walker.nextNode())) {
            if (n.nodeValue && n.nodeValue.trim()) { deep = n; break }
            if (!deepBlanked) deepBlanked = n
          }
          return deep || blanked || deepBlanked || null
        }
        // Blank every OTHER non-empty text node (direct + deep) so exactly one
        // carrier shows the label. TreeWalker touches only text nodes — the
        // row icon (svg paths) is never affected.
        const blankOthers = function (keep) {
          for (const n of nameEl.childNodes) {
            if (n.nodeType === 3 && n !== keep && n.nodeValue) n.nodeValue = ''
          }
          const walker = document.createTreeWalker(nameEl, NodeFilter.SHOW_TEXT)
          let n
          while ((n = walker.nextNode())) {
            if (n !== keep && n.nodeValue && n.nodeValue.trim()) n.nodeValue = ''
          }
        }
        if (customName) {
          // v1.1.0 b48: rewrite only the TEXT node — the label element also
          // hosts the row icon (svg); nameEl.textContent = customName wiped
          // it (icon-loss bug).
          // b61/b64: strip orphan carriers WE appended earlier (data-dpp-text
          // spans) and keep a SINGLE text carrier — two visible texts showed
          // duplicated labels ("XD Pool XD Pool").
          const stale = nameEl.querySelectorAll('[data-dpp-text="1"]')
          for (const s of stale) s.remove()
          const tn = findCarrier()
          if (tn) {
            if (tn.nodeValue !== customName) tn.nodeValue = customName
            blankOthers(tn)
          } else if (nameEl.textContent !== customName) {
            const span = document.createElement('span')
            span.setAttribute('data-dpp-text', '1')
            span.textContent = customName
            nameEl.appendChild(span)
          }
          if (row.getAttribute('data-dpp-renamed') !== '1') {
            row.setAttribute('data-dpp-renamed', '1')
            row.title = customName
          }
        } else if (row.getAttribute('data-dpp-renamed') === '1') {
          // Renaming was undone: b64 — clear our carriers and restore the
          // original label. b69: the restore WRITES the original (aria-label)
          // into the carrier text node instead of only blanking — React does
          // not rewrite text nodes it believes unchanged, so a blanked deep
          // node would stay empty forever on nested-label rows.
          const stale2 = nameEl.querySelectorAll('[data-dpp-text="1"]')
          for (const s of stale2) s.remove()
          const tn = findCarrier()
          if (tn) {
            if (tn.nodeValue !== label) tn.nodeValue = label
            blankOthers(tn)
          } else if (nameEl.textContent !== label) {
            const span = document.createElement('span')
            span.setAttribute('data-dpp-text', '1')
            span.textContent = label
            nameEl.appendChild(span)
          }
          row.removeAttribute('data-dpp-renamed')
          row.removeAttribute('title')
        }
        // v1.1.0 hide + v1.3.2 active-row exemption: user-hidden rows
        // disappear from the sidebar unless whitelisted; an individually
        // hidden row that IS the currently active panel stays visible
        // ("you are on this page" — the dsh-panellist hidden-vs-active
        // rule). Collection mode (rows-hidden) never exempts.
        const hide = shouldHideRow(label, hiddenRows.indexOf(label) !== -1, hidden)
        const want = hide ? 'none' : ''
        // Skip when already in place: refresh runs on every DOM mutation
        // burst, and redundant inline-style writes invalidate layout for nothing.
        if (unit.style.display === want) return
        unit.style.display = want
        if (hide) unit.dataset.dppHidden = '1'
        else delete unit.dataset.dppHidden
      })
    }

    /**
     * v1.1.0: hide user-hidden rows in the family (plugin entry) region too,
     * same semantics as applyFold — whitelist still wins.
     */
    function applyHiddenRows() {
      if (typeof document === 'undefined') return
      const hiddenRows = readHiddenRows()
      if (hiddenRows.length === 0) return
      findFamilyRows().concat(findFooterRows()).forEach(function (row) {
        const label = rowLabel(row)
        if (hiddenRows.indexOf(label) === -1) return
        if (isWhitelistedLabelOrMapped(label)) return
        // v1.3.2 active-row exemption: a hidden plugin entry that IS the
        // currently active panel (id known via the label→id map) stays
        // visible; leaving the panel re-hides it on the next refresh pass.
        if (isActiveRowLabel(label)) return
        if (row.style.display !== 'none') {
          row.style.display = 'none'
          row.dataset.dppHidden = '1'
        }
      })
    }

    /** Refresh pass: re-assert everything the plugin owns on the live DOM.
     * Called from the MutationObserver callback (debounced) and one low-rate
     * fallback interval — replacing the old unconditional 1.5s full sweep. */
    function refreshAll() {
      if (typeof document === 'undefined') return
      injectStyle()
      // v1.4.4: classify the host scroll contract BEFORE anything that gates
      // on it (the rc.3 structural CSS needs html.dpp-rc3, and the nav wheel
      // hijack in ensureLauncher checks the same class).
      detectScrollContract()
      applyConfig()
      applyTheme()
      applyTidy()
      applyIconOnly()
      seedMapFromSlots()
      restoreWhitelistedEverywhere()
      applyFamily()
      applyFooter()
      applyFold()
      applyHiddenRows()
      applyTopPins()
      applyRowOrder()
      // v1.4.0: reconcile bridged settings pages on the same debounced cadence
      // (sync itself is add/remove only, 120ms-debounced internally when the
      // subscription fires; direct calls here are cheap no-ops when the
      // candidate set is unchanged).
      syncBridgeSettings()
      ensureLauncher()
      updateDebug()
    }

    // ---------------------------------------------------------------- scroll css

    const EXTRA_CSS = [
      // Cap the global panel list so many plugin rows cannot squeeze the
      // session-history region below it; let the list scroll instead.
      // NOTE: no scrollbar-width/scrollbar-color here — in Chromium 121+ the
      // standard properties DISABLE ::-webkit-scrollbar styling below.
      '[class$="_panelList"] {',
      '  max-height: var(--dpp-panel-list-max, 20vh);',
      '  overflow-y: auto;',
      '  overflow-x: hidden;',
      '  /* b79: reaching the list end must not chain into the shared',
      '     sidebar scroller — the session region stays put. */',
      '  overscroll-behavior-y: contain;',
      '}',
      // v1.4.4: the b79/b83 structural overrides below are gated on
      // html.dpp-rc3 (set at runtime by detectScrollContract). DSH
      // 0.2.2-rc.5 redesigned the sidebar into a wheel hand-off — the
      // viewport (_scrollArea) is a GRID owned by scroll-handoff and a
      // scroll-state container query that decides when the workspace list
      // seat starts scrolling. Forcing flex onto that viewport (b79) and
      // unbounding the workspace root (b83) broke the hand-off: the
      // workspace region could not take over and the sidebar "could not
      // scroll down" (user report on rc.5 + plugin 1.4.3). On rc.5 we cap
      // only the panel list — reaching its end hands the gesture to the
      // viewport natively, which is exactly the host's contract.
      // rc.3 rules (no rc.5 markers on _scrollArea): the shared container
      // becomes a flex column so the capped panel list stays pinned and
      // the region below scrolls on its own.
      'html.dpp-rc3 [class$="_scrollArea"] {',
      '  /* !important: the host sets display:grid on this element via a',
      '     css-modules stylesheet that lands after ours — it wins the',
      '     same-specificity tie without this. */',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '}',
      '[class$="_panelList"] {',
      '  flex: none;',
      '}',
      'html.dpp-rc3 [class$="_regionArea"] {',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  overscroll-behavior-y: contain;',
      '}',
      'html.dpp-rc3 [class$="_regionArea"] [class$="_root"] {',
      '  /* b83: the host session component (GAkraW_root) carries a',
      '     viewport-derived max-height sized for the OLD shared-scroll',
      '     layout; bound it to the region so its own list scroller',
      '     (GAkraW_listArea — host flex:1 + overflow:auto) is the single',
      '     session scrollbar. b79 made regionArea itself scroll, which',
      '     nested two scrollbars into the session area. */',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  max-height: none;',
      '  overflow: visible;',
      '}',
      // Themed thin scrollbars for every area we cap (panel list, capped
      // footer, panels popup). Capsule thumb, transparent track. Colors come
      // from the host's own scrollbar tokens (--dsh-scrollbar-thumb / -hover,
      // which the sidebar root derives from --dsw-alias-scrollbar-*-l2), so
      // they follow the theme and dsh-any-background's palette; the
      // --dpp-scrollbar pair remains only as a last-resort fallback.
      'html { --dpp-scrollbar: rgba(127,127,127,.4); --dpp-scrollbar-hover: rgba(127,127,127,.6); }',
      'html.dpp-dark { --dpp-scrollbar: rgba(255,255,255,.26); --dpp-scrollbar-hover: rgba(255,255,255,.46); }',
      '[class$="_panelList"]::-webkit-scrollbar,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar {',
      '  width: 7px;',
      '  height: 7px;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-track,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-track,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-track,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-thumb,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-thumb,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-thumb,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '  min-height: 24px;',
      '  min-width: 24px;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-thumb:hover,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-thumb:hover,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-thumb:hover,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar-thumb:hover {',
      '  background-color: var(--dsh-scrollbar-thumb-hover, var(--dpp-scrollbar-hover, rgba(127,127,127,.6)));',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '}',
      // Compact footer ("sidebar tidy", ported from @weibaohui/dsh-sidebar-tidy).
      // Gated on html.dpp-tidy so the toggle only flips one class. Host class
      // names are css-modules hashes (_2H3hWW_footArea); the suffix is stable,
      // so the rules match with [class*="_footArea"]. Footer ENTRIES stay in
      // place — only their container gets a height cap and a scrollbar.
      'html.dpp-tidy [class*="_footArea"] {',
      '  max-height: var(--dpp-foot-max, 15vh) !important;',
      '  overflow-y: auto !important;',
      '  overscroll-behavior: contain;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr img[alt*="二维码"], html.dpp-tidy.dpp-tidy-qr img[alt*="QR"] {',
      '  width: var(--dpp-qr-size, 132px) !important;',
      '  height: auto !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr [class*="KV--Pq_qr"] {',
      '  width: var(--dpp-qr-size, 132px) !important;',
      '  height: auto !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr [class*="KV--Pq_content"] {',
      '  padding: 10px 0 !important;',
      '  gap: 8px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-brand [class*="_logoRow"] {',
      '  height: 44px !important;',
      '  margin-bottom: 0 !important;',
      '}',
      // b97: the gap below the New-session row belongs on the ROW, not on
      // everything whose class contains "_newSession". The host nests
      // _newSessionRow > [slot anchor] > button._newSession >
      // span._newSessionLabelMask > span._newSessionContent >
      // span._newSessionLabel, and a bare [class*="_newSession"] margin-bottom
      // landed on the button AND on all three inner spans, so the flex-centred
      // "+ 新会话" content was pushed 8px above the button's vertical middle
      // (measured: text centre 107 vs button centre 115). Anchor on the row.
      'html.dpp-tidy.dpp-tidy-brand [class*="_newSessionRow"] {',
      '  margin-bottom: 8px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-meter .cm-foot {',
      '  height: 26px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-meter .cm-bbox {',
      '  max-height: 128px;',
      '  overflow-y: auto;',
      '}',
      // Icon-only panel rows (v0.10.0, fixed in 0.10.2): rows keep their flex
      // slot but shrink to the glyph. Structure-independent approach — the
      // icon wrapper's class is a host css-modules hash we cannot match
      // reliably, so instead of guessing wrapper class names we hide every
      // DIRECT child that does NOT contain an svg (label spans, badges) via
      // :has(). Chromium in Electron 44 supports :has() natively. The
      // font-size:0 trick below also swallows bare text nodes in rows whose
      // label isn't wrapped. Our launcher keeps its label.
      'html.dpp-icononly [class$="_panelList"] > button:not([data-dpp-launcher]) {',
      '  width: 36px !important;',
      '  min-width: 36px !important;',
      '  padding: 7px 0 !important;',
      '  justify-content: center;',
      '  gap: 0 !important;',
      '  font-size: 0 !important; /* bare text nodes vanish */',
      '}',
      'html.dpp-icononly [class$="_panelList"] > button:not([data-dpp-launcher]) > *:not(:has(svg)) {',
      '  display: none !important;',
      '}',
      'html.dpp-icononly [class$="_panelList"] > button:not([data-dpp-launcher]) svg {',
      '  width: 18px !important;',
      '  height: 18px !important;',
      '  font-size: 0;',
      '}',
      // b75: rc.3 rows are BUTTON._panelRow inside DIV._panelEntry wrappers —
      // collapse the row button and its title span, keep the glyph DIV.
      'html.dpp-icononly [class$="_panelList"] button[class*="_panelRow"] {',
      '  width: 36px !important;',
      '  min-width: 36px !important;',
      '  padding: 7px 0 !important;',
      '  justify-content: center;',
      '  gap: 0 !important;',
      '  font-size: 0 !important;',
      '}',
      'html.dpp-icononly [class$="_panelList"] button[class*="_panelRow"] [class*="_panelTitle"] {',
      '  display: none !important;',
      '}',
      'html.dpp-icononly [class$="_panelList"] button[class*="_panelRow"] svg,',
      'html.dpp-icononly [class$="_panelList"] button[class*="_panelRow"] [class*="_panelGlyph"] > * {',
      '  width: 18px !important;',
      '  height: 18px !important;',
      '}',
      // Our launcher row: matches the host panel row metrics. `order: -1`
      // pins it to the top of the flex column while keeping it as the LAST
      // DOM child — React only ever appends new rows to the end, so this
      // avoids fighting the host renderer over sibling order.
      // Metrics mirror the rc.3 host row exactly (32px row, margin 0 2px,
      // padding 5px 9px, gap 6px, 16px glyph when wide / 18px in rail) so the
      // label aligns with the host rows' text column.
      '.dpp-launcher {',
      '  order: -1;',
      '  display: flex;',
      '  align-items: center;',
      '  /* b82: rc.3 host row metrics (32px rows, 5px/9px padding, 6px',
      '     icon-text gap) — previously mirrored the rc.2 36px/7px-8px/8px',
      '     metrics and sat visibly off against the rc.3 rows. */',
      '  gap: 6px;',
      '  box-sizing: border-box;',
      '  width: calc(100% - 4px);',
      '  min-height: 32px;',
      '  margin: 0 2px;',
      '  padding: 5px 9px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-md, 8px);',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 14px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
      '.dpp-launcher:hover, .dpp-launcher:focus-visible {',
      '  background-color: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-launcher .dpp-icon {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dpp-launcher svg { width: 16px; height: 16px; }',
      // Rail mode (collapsed sidebar): host rows switch back to 18px glyphs.
      '.dpp-launcher.dpp-rail .dpp-icon { width: 18px; height: 18px; }',
      '.dpp-launcher.dpp-rail svg { width: 18px; height: 18px; }',
      '.dpp-launcher .dpp-launcher-label {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-launcher .dpp-launcher-badge {',
      '  flex: none;',
      '  min-width: 16px;',
      '  padding: 0 5px;',
      '  border-radius: 8px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  text-align: center;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-launcher .dpp-launcher-badge:empty { display: none; }',
      // Rail mode (collapsed sidebar, 56px): icon only.
      '.dpp-launcher.dpp-rail {',
      '  width: 36px;',
      '  min-width: 36px;',
      '  justify-content: center;',
      '  gap: 0;',
      '  padding: 0;',
      '}',
      '.dpp-launcher.dpp-rail .dpp-launcher-label,',
      '.dpp-launcher.dpp-rail .dpp-launcher-badge { display: none; }',
      // Floating panels menu.
      '.dpp-overlay {',
      '  position: fixed;',
      '  z-index: 2147482000;',
      '  box-sizing: border-box;',
      '  display: flex;',
      '  flex-direction: column;',
      '  min-width: 220px;',
      '  max-width: 300px;',
      '  max-height: var(--dpp-overlay-max, 60vh);',
      '  /* v0.10.7: the BOX no longer scrolls — it is a flex column whose',
      '     middle .dpp-ov-body scrolls. Search box (top) and the footer rows',
      '     + Ctrl+K hint (bottom) stay pinned outside the scroll area, so the',
      '     hint is never clipped when the list exceeds --dpp-overlay-max. */',
      '  overflow: hidden;',
      '  padding: 6px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 10px;',
      '  /* Theme-inherited menu surface (dsh-any-background compatible): consume',
      '     the SAME tokens the host MenuSurface paints from. The wallpaper /',
      '     card-opacity / menu-blur sliders of dsh-any-background retint this',
      '     surface exactly like host menus — no hardcoded white/dark base. */',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, transparent)));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 12px 32px rgba(0,0,0,.35);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font-size: 13px;',
      '  /* Host scrollbar tokens (declared by the sidebar root for its own',
      '     scrollers) re-declared here because this overlay lives on <body>,',
      '     outside that inheritance scope. */',
      '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.4));',
      '  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(127,127,127,.6));',
      '}',
      // v0.10.7: middle scroll region — every list child (heads, items, empty
      // state) lives here; the search box and the footer/hint stay outside.
      '.dpp-ov-body {',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  overflow-y: auto;',
      '  overflow-x: hidden;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar {',
      '  width: 8px;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar-thumb:hover {',
      '  background-color: var(--dsh-scrollbar-thumb-hover, var(--dpp-scrollbar-hover, rgba(127,127,127,.6)));',
      '}',
      '.dpp-ov-head {',
      '  padding: 6px 8px 3px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  opacity: .55;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // Collapsible group header (v0.10.0): clickable, chevron shows the fold.
      '.dpp-ov-ghead {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  width: 100%;',
      '  border: none;',
      '  background: transparent;',
      '  color: inherit;',
      '  font: inherit;',
      '  font-size: 11px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-ov-ghead:hover { opacity: .85; }',
      '.dpp-ov-gchev { display: inline-flex; flex: none; width: 12px; height: 12px; }',
      '.dpp-ov-gchev svg { width: 12px; height: 12px; }',
      // Search box at the top of the panels overlay. flex:none so the flex
      // column never shrinks it when the body list saturates the cap.
      '.dpp-ov-search {',
      '  display: block;',
      '  box-sizing: border-box;',
      '  flex: none;',
      '  width: 100%;',
      '  height: 30px;',
      '  margin: 2px 0 4px;',
      '  padding: 4px 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  outline: none;',
      '}',
      '.dpp-ov-search:focus-visible {',
      '  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));',
      '  outline-offset: 0;',
      '}',
      '.dpp-ov-search::placeholder { color: var(--dsw-alias-label-tertiary, inherit); opacity: .7; }',
      '.dpp-ov-empty {',
      '  padding: 10px 8px;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  text-align: center;',
      '}',
      // Keyboard-active overlay line (↑↓ navigation highlight).
      '.dpp-ov-item.dpp-kb {',
      '  background: var(--dsw-alias-interactive-bg-active, rgba(127,127,127,.2));',
      '}',
      // Row context menu (right-click on a sidebar row).
      '.dpp-ctx {',
      '  position: fixed;',
      '  z-index: 2147482100;',
      '  box-sizing: border-box;',
      '  min-width: 180px;',
      '  max-width: 280px;',
      '  /* v1.2.2: cap at 80vh and let the menu body scroll — the viewport',
      '     clamp below can flip the menu upward but a menu taller than the',
      '     screen would still overflow. Eight items sit far below the cap;',
      '     future rows are covered. */',
      '  max-height: 80vh;',
      '  overflow-y: auto;',
      '  overflow-x: hidden;',
      '  padding: 5px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 10px;',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, transparent)));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 12px 32px rgba(0,0,0,.35);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font-size: 13px;',
      '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.4));',
      '  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(127,127,127,.6));',
      '}',
      '.dpp-ctx-title {',
      '  padding: 5px 8px 3px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  opacity: .55;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      '.dpp-ctx .dpp-row { min-height: 30px; border-radius: var(--dsw-radius-md, 8px); }',
      // Transient toast (bottom-center). v1.7.1: consume the host's toast      // tokens (--dsw-alias-toast-bg/-label, theme README.md:80) so the toast
      // looks like the host's own toasts (dark surface in BOTH palettes);
      // the previous menu-surface chain stays as the legacy-host fallback.
      '.dpp-toast {',
      '  position: fixed;',
      '  left: 50%;',
      '  bottom: 48px;',
      '  transform: translateX(-50%);',
      '  z-index: 2147483000;',
      '  padding: 8px 16px;',
      '  border-radius: 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  background-color: var(--dsw-alias-toast-bg, var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, rgba(40,40,40,.92)))));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 8px 24px rgba(0,0,0,.3);',
      '  color: var(--dsw-alias-toast-label, var(--dsw-alias-label-primary, inherit));',
      '  font-size: 13px;',
      '  max-width: 60vw;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // v1.8.0 (P1-5): collapsed-sidebar toggle badge — the host renders this
      // occupant next to the expand button while collapsed (non-interactive,
      // SidebarRoot.tsx:302). A small count pill; hidden entirely at 0.
      '.dpp-badge {',
      '  display: inline-block;',
      '  min-width: 16px;',
      '  height: 16px;',
      '  padding: 0 5px;',
      '  border-radius: 8px;',
      '  background-color: var(--dsw-alias-brand-primary, #4d6bfe);',
      '  color: #fff;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  font-weight: 500;',
      '  text-align: center;',
      '  vertical-align: middle;',
      '  pointer-events: none;',
      '}',
      // Command palette: centered variant of the panels overlay.
      '.dpp-overlay.dpp-palette {',
      '  left: 50% !important;',
      '  top: 18vh !important;',
      '  transform: translateX(-50%);',
      '  min-width: min(420px, calc(100vw - 24px));',
      '  max-width: calc(100vw - 24px);',
      '}',
      '.dpp-overlay.dpp-palette .dpp-ov-search {',
      '  height: 36px;',
      '  font-size: 14px;',
      '}',
      // Muted shortcut hint under the overlay footer. Lives OUTSIDE the
      // scrollable body (flex column child after .dpp-ov-body), so it stays
      // visible even when the panel list hits the height cap. v0.12.0: the
      // hint also documents Alt+数字 quick activation.
      '.dpp-ov-hint {',
      '  flex: none;',
      '  padding: 4px 8px 2px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  opacity: .75;',
      '  text-align: center;',
      '  user-select: none;',
      '}',
      '.dpp-ov-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  width: 100%;',
      '  min-height: 34px;',
      '  padding: 6px 8px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-md, 8px);',
      '  background: transparent;',
      '  color: inherit;',
      '  font: inherit;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
      '.dpp-ov-item:hover, .dpp-ov-item:focus-visible {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-ov-ico {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 18px;',
      '  height: 18px;',
      '}',
      '.dpp-ov-ico svg { width: 16px; height: 16px; }',
      '.dpp-ov-letter {',
      '  flex: none;',
      '  width: 16px;',
      '  height: 16px;',
      '  border-radius: 50%;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.15));',
      '  font-size: 10px;',
      '  line-height: 14px;',
      '  text-align: center;',
      '  opacity: .75;',
      '}',
      '.dpp-ov-lbl {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-ov-dot {',
      '  flex: none;',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      // Search hit highlight (v0.12.0): the matched substring inside a row
      // label. Theme-aware accent color, never overrides the kb highlight.
      '.dpp-ov-lbl .dpp-mark {',
      '  color: var(--dsw-alias-brand-primary, #4d6bfe);',
      '  font-weight: 600;',
      '  background: transparent;',
      '}',
      // Unpinned panel lines: reachable but visually secondary.
      '.dpp-ov-item.dpp-ov-unpinned .dpp-ov-lbl { opacity: .7; }',
      // Hover action cluster (pin/unpin, to-top) on panel lines.
      '.dpp-ov-acts {',
      '  flex: none;',
      '  display: none;',
      '  align-items: center;',
      '  gap: 2px;',
      '  margin-left: auto;',
      '}',
      '.dpp-ov-item:hover .dpp-ov-acts,',
      '.dpp-ov-item:focus-within .dpp-ov-acts { display: inline-flex; }',
      '.dpp-ov-act {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 22px;',
      '  height: 22px;',
      '  padding: 0;',
      '  border: none;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '  cursor: pointer;',
      '}',
      '.dpp-ov-act:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-ov-act[disabled] { opacity: .35; cursor: default; }',
      '.dpp-ov-act[disabled]:hover { background: transparent; }',
      '.dpp-ov-act[data-active="1"] {',
      '  color: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      // v0.10.7 flex column: only .dpp-ov-body shrinks/scrolls — the search
      // box, the footer rows and the hint keep their natural height.
      '.dpp-overlay > .dpp-ov-item { flex: none; }',
      '.dpp-ov-foot {',
      '  flex: none;',
      '  margin-top: 4px;',
      '  padding-top: 4px;',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      // Our menu rows: match the host MenuItemButton metrics exactly.
      '.dpp-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  width: 100%;',
      '  padding: 0 12px;',
      '  min-height: 32px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-sm, 6px);',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-row:hover, .dpp-row:focus-visible, .dpp-row:focus {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      // v1.1.1 b69: rename editor float — a BODY-LEVEL plugin-owned surface,
      // not a row child (host React re-renders rip foreign nodes out of the
      // row subtree within milliseconds). Paints from the SAME menu-surface
      // tokens as .dpp-overlay so dsh-any-background retints it identically;
      // no hardcoded base color anywhere (dark mode is host-token driven).
      '.dpp-rename-float {',
      '  position: fixed;',
      '  z-index: 2147482000;',
      '  box-sizing: border-box;',
      '  padding: 6px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 10px;',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, transparent)));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 12px 32px rgba(0,0,0,.35);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  /* Host scrollbar tokens (declared by the sidebar root) re-declared',
      '     here because this float lives on <body>, outside that scope. */',
      '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.4));',
      '  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(127,127,127,.6));',
      '}',
      '.dpp-rename-float .dpp-row-rename {',
      '  display: block;',
      '  width: 100%;',
      '  height: 28px;',
      '  padding: 0 8px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 14px;',
      '  outline: none;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-rename-float .dpp-row-rename:focus {',
      '  border-color: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-row .dpp-icon {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dpp-row .dpp-label { min-width: 0; }',
      '.dpp-row .dpp-detail {',
      '  margin-left: auto;',
      '  padding-left: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // Settings page section (dpp-set-*): plain host-token styling, no
      // primitives import (see note at item 5 in the header).
      '.dpp-set {',
      '  max-width: 760px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-set-title { margin: 0; font-size: 18px; font-weight: 600; }',
      '.dpp-set-intro {',
      '  margin: 0;',
      '  font-size: 13px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-card {',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));',
      '  border-radius: 10px;',
      '  padding: 2px 14px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '}',
      '.dpp-set-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 12px;',
      '  min-height: 46px;',
      '}',
      '.dpp-set-row + .dpp-set-row {',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      '.dpp-set-texts { flex: 1 1 auto; min-width: 0; }',
      '.dpp-set-label { font-size: 13px; }',
      '.dpp-set-detail {',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set input[type="range"] {',
      '  flex: none;',
      '  width: 160px;',
      '  accent-color: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-set-val {',
      '  flex: none;',
      '  min-width: 44px;',
      '  text-align: right;',
      '  font-size: 12px;',
      '  font-variant-numeric: tabular-nums;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-switch {',
      '  flex: none;',
      '  width: 36px;',
      '  height: 20px;',
      '  box-sizing: border-box;',
      '  border: none;',
      '  border-radius: 10px;',
      '  padding: 0;',
      '  position: relative;',
      '  cursor: pointer;',
      '  background: var(--dsw-alias-border-l2, rgba(127,127,127,.4));',
      '  transition: background .15s ease;',
      '}',
      '.dpp-set-switch::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 2px;',
      '  left: 2px;',
      '  width: 16px;',
      '  height: 16px;',
      '  border-radius: 50%;',
      '  background: #fff;',
      '  box-shadow: 0 1px 2px rgba(0,0,0,.25);',
      '  transition: transform .15s ease;',
      '}',
      '.dpp-set-switch[data-on="true"] {',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-set-switch[data-on="true"]::after { transform: translateX(16px); }',
      '.dpp-set-reset {',
      '  align-self: flex-start;',
      '  padding: 6px 14px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.15));',
      '  border-radius: 8px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-reset:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '}',
      '.dpp-set-actions {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 8px;',
      '  align-items: center;',
      '}',
      '.dpp-set-danger {',
      '  color: var(--dsw-alias-state-error-primary, #c0392b);',
      '  border-color: var(--dsw-alias-state-error-primary, rgba(192,57,43,.5));',
      '}',
      '.dpp-set-danger:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(192,57,43,.08));',
      '}',
      '.dpp-set-version { opacity: .7; }',
      // v1.4.0: bridged settings-page shell — a 40px back bar above the
      // host-rendered section body. Tokens only, same theme contract as the
      // overlay surface.
      '.dpp-bridge {',
      '  display: flex;',
      '  flex-direction: column;',
      '  min-height: 100%;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '}',
      '.dpp-bridge-bar {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  min-height: 40px;',
      '  padding: 0 14px;',
      '  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25));',
      '  flex: none;',
      '}',
      '.dpp-bridge-back {',
      '  border: 0;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '  padding: 4px 8px;',
      '  border-radius: 8px;',
      '}',
      '.dpp-bridge-back:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '}',
      '.dpp-bridge-tag {',
      '  font-size: 12px;',
      '  padding: 1px 8px;',
      '  border-radius: 999px;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35));',
      '  opacity: .85;',
      '}',
      '.dpp-bridge-from {',
      '  font-size: 12px;',
      '  opacity: .6;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-bridge-body {',
      '  flex: 1 1 auto;',
      '  overflow-y: auto;',
      '  padding: 12px 14px;',
      '}',
      '.dpp-bridge-missing {',
      '  opacity: .7;',
      '  font-size: 13px;',
      '}',
      // Settings dialog: let the LEFT NAV scroll when many plugin sections
      // register. The host .navList already declares overflow-y:auto but its
      // flex chain has no height bound (nav is flex:none, navList has no
      // flex/min-height), so a long rail overflows the panel instead of
      // scrolling. Scoped with :has(.dpp-set) so the rules only apply to the
      // settings dialog that hosts our own section. The panel already declares
      // --dsh-scrollbar-thumb vars, so the thumb follows the theme.
      '[class$="_panel"]:has(.dpp-set) nav[class$="_nav"] {',
      '  min-height: 0;',
      '}',
      '[class$="_panel"]:has(.dpp-set) nav[class$="_nav"] > [class$="_navList"] {',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  overscroll-behavior: contain;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar {',
      '  width: 7px;',
      '  height: 7px;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '  min-height: 24px;',
      '}',
      '.dpp-set-note {',
      '  padding: 6px 0 2px;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-inputrow {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 8px 0;',
      '}',
      '.dpp-set-input {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  box-sizing: border-box;',
      '  height: 30px;',
      '  padding: 4px 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '}',
      '.dpp-set-input:focus-visible {',
      '  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));',
      '  outline-offset: 1px;',
      '}',
      '.dpp-set-add {',
      '  flex: none;',
      '  padding: 5px 14px;',
      '  border: none;',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '  color: var(--dsw-alias-label-on-business, #fff);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-add:hover { filter: brightness(1.08); }',
      '.dpp-set-chip {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  min-height: 38px;',
      '}',
      '.dpp-set-chip + .dpp-set-chip {',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      // Drag-to-reorder top pins (v0.10.0).
      '.dpp-set-chip.dpp-draggable { cursor: grab; }',
      '.dpp-set-chip.dpp-draggable:active { cursor: grabbing; }',
      '.dpp-set-chip.dpp-droptarget {',
      '  outline: 2px dashed var(--dsw-alias-state-business-primary, #4d6bfe);',
      '  outline-offset: -2px;',
      '}',
      '.dpp-set-x {',
      '  flex: none;',
      '  padding: 4px 10px;',
      '  border: none;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  font: inherit;',
      '  font-size: 12px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-x:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-set-x[disabled] {',
      '  opacity: .45;',
      '  cursor: default;',
      '}',
      '.dpp-set-x[disabled]:hover {',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-empty {',
      '  padding: 8px 0;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-subrow { padding-left: 14px; }',
    ].join('\n')

    // ---------------------------------------------------------------- debug

    /**
     * Runtime diagnostics, enabled only with ?dppdebug in the page URL.
     *
     * The host has no DevTools in production builds (F12 is disabled and the
     * CDP ports are closed), so this overlay is the only way to inspect the
     * live sidebar DOM from the outside.
     */
    const DEBUG_ENABLED = (function () {
      try {
        return /[?&]dppdebug\b/.test(window.location.search || '')
      } catch (error) {
        return false
      }
    })()

    function debugText() {
      const nav = findPanelListNav()
      const out = []
      if (!nav) {
        out.push('nav NOT FOUND')
        return out.join('\n')
      }
      const ncs = window.getComputedStyle(nav)
      const nr = nav.getBoundingClientRect()
      out.push(
        'nav rect=' +
          [nr.top, nr.left, nr.width, nr.height].map(Math.round).join(',') +
          ' ovy=' +
          ncs.overflowY +
          ' scrollTop=' +
          nav.scrollTop +
          ' scrollH=' +
          nav.scrollHeight +
          ' clientH=' +
          nav.clientHeight +
          ' fd=' +
          ncs.flexDirection +
          ' wrap=' +
          ncs.flexWrap,
      )
      const l = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      Array.prototype.slice.call(nav.children).forEach(function (el, i) {
        const ecs = window.getComputedStyle(el)
        const er = el.getBoundingClientRect()
        out.push(
          (el === l ? '*' : ' ') +
            i +
            ' ' +
            el.tagName +
            ' inlineOrd=' +
            (el.style && el.style.order ? el.style.order : '-') +
            ' csOrd=' +
            ecs.order +
            ' disp=' +
            ecs.display +
            ' top=' +
            Math.round(er.top) +
            ' h=' +
            Math.round(er.height) +
            ' lbl=' +
            String(el.getAttribute ? el.getAttribute('aria-label') || '' : '').slice(0, 10),
        )
      })
      if (l) {
        const r = l.getBoundingClientRect()
        out.push('launcher rect=' + [r.top, r.left, r.width, r.height].map(Math.round).join(','))
        const cx = Math.round(r.left + r.width / 2)
        const cy = Math.round(r.top + r.height / 2)
        const hit = document.elementFromPoint(cx, cy)
        out.push('hit@' + cx + ',' + cy + '=' + (hit ? hit.tagName + '.' + String(hit.className || '').slice(0, 40) : 'null'))
      }
      out.push('rowsHidden=' + readRowsHidden())
      // v1.3.2: the active panel id (empty when the layout service is
      // absent) — the exemption's input, visible for troubleshooting.
      out.push('active=' + (activePanelId() || '-'))
      out.push('tidy=' + readTidy() + ' family=' + readFamily() + ' famRows=' + findFamilyRows().length)
      out.push('dark=' + isDarkSurface())
      out.push('BUILD=' + BUILD)
      const styleTag = document.getElementById(STYLE_ID)
      out.push('styleTag=' + (styleTag ? 'yes len=' + String(styleTag.textContent || '').length : 'NO'))
      const ov = document.querySelector('.dpp-overlay')
      if (ov) {
        const ocs = window.getComputedStyle(ov)
        out.push(
          'overlay bg=' +
            ocs.backgroundColor +
            ' bgImage=' +
            ocs.backgroundImage +
            ' z=' +
            ocs.zIndex +
            ' pos=' +
            ocs.position +
            ' shadow=' +
            ocs.boxShadow.slice(0, 40),
        )
        const v = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-layer-2')
        out.push('var bg-layer-2=' + String(v))
        const v2 = getComputedStyle(document.documentElement).getPropertyValue('--dsw-elevation-prominent')
        out.push('var elevation=' + String(v2))
        const v3 = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-border-l2')
        out.push('var border-l2=' + String(v3))
      } else {
        out.push('overlay: not open')
      }
      const keys = []
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (k && k.indexOf('dsh-panel-pins') === 0) keys.push(k + '=' + String(window.localStorage.getItem(k)).slice(0, 60))
        }
      } catch (error) {
        /* ignore */
      }
      out.push('ls: ' + keys.join(' | '))
      return out.join('\n')
    }

    function updateDebug() {
      if (typeof document === 'undefined') return
      // Debug-only diagnostics (enable with ?dppdebug). The title/status
      // channel is intentionally gated: unconditionally rewriting
      // document.title every tick would clobber the host's session title
      // and the taskbar unread indicator. DEBUG_ENABLED is a const captured
      // once at apply-time (URL cannot change in this embedded webview).
      if (!DEBUG_ENABLED) return
      try {
        const nav = findPanelListNav()
        document.title =
          'dpp ' +
          BUILD +
          ' hidden=' +
          readRowsHidden() +
          ' rows=' +
          (nav ? findPanelRows(nav).length : -1) +
          ' kids=' +
          (nav ? nav.children.length : -1)
      } catch (error) {
        /* ignore */
      }
      if (!DEBUG_ENABLED) return
      let box = document.getElementById('dsh-panel-pins-debug')
      if (!box) {
        box = document.createElement('pre')
        box.id = 'dsh-panel-pins-debug'
        box.style.cssText =
          'position:fixed;left:8px;bottom:8px;z-index:2147483000;margin:0;max-width:560px;max-height:46vh;overflow:auto;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.86);color:#d8f7d0;font:11px/1.45 Consolas,monospace;white-space:pre-wrap;word-break:break-all;'
        document.body.appendChild(box)
      }
      // Guard against observer feedback: the box lives outside the sidebar
      // root, so writes here do not re-trigger refreshAll — but keep the
      // signature check anyway in case the debug scope ever widens.
      const text = debugText()
      if (box.__dppSig === text) return
      box.__dppSig = text
      box.textContent = text
    }

    function injectStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.dataset.plugin = 'dsh-panel-pins'
      tag.dataset.pluginCss = 'dsh-panel-pins/panellist'
      tag.textContent = EXTRA_CSS
      document.head.appendChild(tag)
    }

    // ---------------------------------------------------------------- svg icons

    /** Fluent-style 20x20 stroke icon rendered inline (16px display). */
    function SvgIcon({ d, filled }) {
      return h(
        'span',
        { className: 'dpp-icon', 'aria-hidden': 'true' },
        h(
          'svg',
          {
            width: 16,
            height: 16,
            viewBox: '0 0 20 20',
            fill: filled ? 'currentColor' : 'none',
            stroke: 'currentColor',
            strokeWidth: 1.4,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', { d }),
        ),
      )
    }

    // Fluent-ish pin: head + stem, matching the host pin metaphor.
    const ICON_PIN =
      'M10.5 2.8c.2-.2.5-.2.7 0l2.5 2.5c.2.2.2.5 0 .7l-.4.4.6 3 2.4 2.4c.2.2.2.5 0 .7l-.7.7-3.4-1.1-3.1 3.1c-.3.3-.8.3-1.1 0L5.6 12.8 3 15.4'
    const ICON_PIN_ALT =
      'M10.5 2.8c.2-.2.5-.2.7 0l2.5 2.5c.2.2.2.5 0 .7l-.4.4.6 3 2.4 2.4c.2.2.2.5 0 .7l-.7.7-3.4-1.1-3.1 3.1c-.3.3-.8.3-1.1 0L5.6 12.8 3 15.4M13 7.5 7.5 13'
    const ICON_CHEVRON_UP = 'M5 12.2 10 7.2l5 5'
    const ICON_CHEVRON_DOWN = 'M5 7.8l5 5 5-5'
    // Pencil: display rename (v1.1.0).
    const ICON_EDIT =
      'M12.8 3.6a1.6 1.6 0 0 1 2.3 2.3L7.6 13.4 4 14.5l1.1-3.6zM4 17h12'
    // Eye with a slash: hide row (v1.1.0).
    const ICON_EYE_OFF =
      'M4 4l12 12M9.9 5.2A8.6 8.6 0 0 1 10 5.2c3.2 0 5.9 2 7 4.8a8.4 8.4 0 0 1-2 2.9M6.7 6.7A8.3 8.3 0 0 0 3 10a9.5 9.5 0 0 0 3.4 3.4A8.9 8.9 0 0 0 10 14.8c1.2 0 2.3-.2 3.3-.7M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6'
    const ICON_GRID =
      'M4 4.5h4.2v4.2H4zM11.8 4.5H16v4.2h-4.2zM4 11.3h4.2v4.2H4zM11.8 11.3H16v4.2h-4.2z'
    // Compact: two arrows pointing at each other vertically.
    const ICON_COMPACT =
      'M6.5 7.2 10 3.7l3.5 3.5M6.5 12.8 10 16.3l3.5-3.5M10 4.5v11'
    // Stack: three rows, like a list of plugin entries.
    const ICON_STACK =
      'M4 5h12M4 10h12M4 15h8'
    // Feedback (v1.3.3): speech bubble with a tail — matches the 20x20
    // stroke-icon set used across the overlay and palette.
    const ICON_FEEDBACK =
      'M4.5 5.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9l-3.4 3v-3h-1.1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zM7 9h6M7 11.4h4'

    // ---------------------------------------------------------------- launcher

    let overlay = null
    let overlayCleanup = null

    function closeOverlay() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
      overlay = null
      if (overlayCleanup) {
        try {
          overlayCleanup()
        } catch (error) {
          /* ignore */
        }
        overlayCleanup = null
      }
    }

    function svgClone(node, size) {
      try {
        const svg = node && node.querySelector ? node.querySelector('svg') : null
        if (!svg) return null
        const copy = svg.cloneNode(true)
        copy.setAttribute('width', String(size || 16))
        copy.setAttribute('height', String(size || 16))
        return copy
      } catch (error) {
        return null
      }
    }

    function letterBadge(label) {
      const span = document.createElement('span')
      span.className = 'dpp-ov-letter'
      const first = String(label || '').trim().charAt(0)
      span.textContent = (first || '?').toUpperCase()
      return span
    }

    /** Inline stroke SVG from a path d (used by overlay action buttons). */
    function iconSvgPath(d, size) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', String(size || 14))
      svg.setAttribute('height', String(size || 14))
      svg.setAttribute('viewBox', '0 0 20 20')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '1.4')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', d)
      svg.appendChild(path)
      return svg
    }

    /** Find the live sidebar row backing a merged panel entry (label first,
     * then id equivalence via the persisted map). */
    function rowForEntry(entry, liveRows) {
      const map = readLabelIdMap()
      for (let i = 0; i < liveRows.length; i++) {
        const label = (liveRows[i].getAttribute('aria-label') || liveRows[i].textContent || '').trim()
        if (label === entry.label) return liveRows[i]
        if (entry.idKnown && (map[label] === entry.id || entry.id === label)) return liveRows[i]
      }
      return null
    }

    /**
     * Open a panel from the merged menu. Visible rows click directly; an
     * unpinned panel has no row, so "peek": temporarily pin it via the host
     * callback, click the row once React mounts it (polled up to ~1.8s), then
     * restore the stored pin state — the panel opens without stealing a
     * permanent sidebar slot.
     */
    function openPanelEntry(entry, row) {
      // C1 (v0.13.0): every explicit open feeds the Recent queue — both the
      // row-click path and the temporary-pin "peek" path.
      try {
        recordRecent(entry.label)
      } catch (error) {
        /* cosmetic */
      }
      if (row) {
        try {
          row.click()
        } catch (error) {
          /* ignore */
        }
        return
      }
      if (!entry.idKnown || typeof bridge.onPinnedChange !== 'function') return
      try {
        bridge.onPinnedChange(entry.id, true)
      } catch (error) {
        return
      }
      const restore = function () {
        if (entry.pinned) return // was pinned: nothing to restore
        try {
          bridge.onPinnedChange(entry.id, false)
        } catch (error) {
          /* ignore */
        }
      }
      let tries = 0
      const timer = setInterval(function () {
        tries++
        const nav = findPanelListNav()
        const found = nav && rowForEntry(entry, findPanelRows(nav))
        if (found) {
          clearInterval(timer)
          try {
            found.click()
          } catch (error) {
            /* ignore */
          }
          setTimeout(restore, 800)
        } else if (tries > 12) {
          clearInterval(timer)
          restore()
          showToast(zh ? '「' + entry.label + '」暂时无法打开' : 'Could not open "' + entry.label + '" right now')
        }
      }, 150)
    }

    // ------------------------------------------------------------- toast

    /**
     * After "show panel rows": if the sidebar still has no visible panel
     * rows, every panel is unpinned (v0.7.7 merged inventory made unpinning
     * easy) and the toggle looks like a no-op. Point the user at the fix.
     */
    function adviseIfNoRows() {
      try {
        if (readRowsHidden()) return // just hid them: silence is correct
        const nav = findPanelListNav()
        const visible = nav ? findPanelRows(nav).filter(function (row) {
          if (row.style.display === 'none') return false
          // b75: rc.3 hides via the wrapper unit, not the button.
          const unit = rowUnitOf(nav, row)
          return !unit || unit.style.display !== 'none'
        }).length : 0
        if (visible === 0) showToast(LABEL.noRowsAfterShow)
      } catch (error) {
        /* advisory only */
      }
    }

    // --------------------------------------------- overlay group fold state
    function readGroupFolds() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(FOLD_GROUPS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writeGroupFolds(obj) {
      try {
        window.localStorage.setItem(FOLD_GROUPS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------- display renames + hidden rows
    // Both maps are keyed by the ORIGINAL label. A rename changes what the
    // sidebar row, overlay items and context menus DISPLAY; the original
    // label stays the storage key everywhere else (pins, whitelist, groups,
    // presets keep working unchanged). Hidden rows are filtered out of the
    // sidebar and the overlay inventory entirely.
    /** Same-document change notification for the Settings page cards. The DOM
     * `storage` event does NOT fire in the document that performed the write,
     * so ctx-menu hides / inline renames would silently leave already-mounted
     * Settings cards stale (the "card says empty but the store has data" bug).
     * Writers dispatch this; PanelPinsSettingsSection subscribes. */
    function notifyStoreChange(key) {
      try {
        window.dispatchEvent(new CustomEvent('dpp:store-changed', { detail: { key: key } }))
      } catch (error) {
        /* engines without CustomEvent: cards just stay as-is */
      }
    }

    /** Resolve a v2 store entry to its CURRENT label. Entries carry the
     * registration id whenever one was known at write time; after a locale
     * switch the id maps to the new label via the persisted label→id map
     * (kept one-label-per-id by mergeLabelIdMap), while id-less entries
     * (family rows, unknown ids) fall back to the stored label. */
    function resolveEntryLabel(entry, idMap) {
      if (entry && entry.id && idMap) {
        for (const l in idMap) {
          if (idMap[l] === entry.id) return l
        }
      }
      return entry && typeof entry.label === 'string' && entry.label ? entry.label : null
    }

    // v2 store shape: { v: 2, items: [{ id, label(, name) }] }. Legacy v1
    // values (label-keyed object / plain label array) are converted on read
    // and rewritten in v2 on the next write — no separate migration step.
    function readRenameEntries() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(RENAMES_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (parsed.v === 2 && Array.isArray(parsed.items)) {
            return parsed.items
              .filter(function (e) {
                return e && typeof e.label === 'string' && e.label && typeof e.name === 'string' && e.name
              })
              .map(function (e) { return { id: e.id || null, label: e.label, name: e.name } })
          }
          const entries = []
          Object.keys(parsed).forEach(function (label) {
            const name = parsed[label]
            if (typeof name === 'string' && name) entries.push({ id: null, label: label, name: name })
          })
          return entries
        }
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeRenameEntries(entries) {
      try {
        window.localStorage.setItem(RENAMES_KEY, JSON.stringify({ v: 2, items: entries || [] }))
        notifyStoreChange('renames')
      } catch (error) {
        // b67: no longer silent — a failed write (quota, blocked storage) used
        // to look exactly like a successful save.
        console.warn('[dsh-panel-pins] rename store write failed (session-only):', error)
      }
    }

    /** Rebuild v2 entries from a resolved {label: name} map, preserving the
     * id of any existing entry that resolves to the same label, and seeding
     * the id from the label→id map when available. */
    function renameMapToEntries(map, prevEntries) {
      const prev = Array.isArray(prevEntries) ? prevEntries : []
      const idMap = readLabelIdMap()
      const entries = []
      Object.keys(map).forEach(function (label) {
        const name = typeof map[label] === 'string' ? map[label].trim() : ''
        if (!label || !name) return
        let id = null
        for (const p of prev) {
          if (resolveEntryLabel(p, idMap) === label) { id = p.id; break }
        }
        if (!id && idMap[label]) id = idMap[label]
        entries.push({ id: id || null, label: label, name: name })
      })
      return entries
    }

    /** Public shape kept label-keyed: { resolvedLabel: name } (deduped).
     * All existing call sites — applyFold, displayNameFor, the settings
     * reset card — keep matching on CURRENT labels unchanged. */
    function readRenames() {
      const idMap = readLabelIdMap()
      const map = {}
      const seen = {}
      readRenameEntries().forEach(function (e) {
        const label = resolveEntryLabel(e, idMap)
        if (!label || seen[label]) return
        seen[label] = true
        map[label] = e.name
      })
      return map
    }

    function writeRenames(obj) {
      writeRenameEntries(renameMapToEntries(obj || {}, readRenameEntries()))
    }

    /** Display name for a row label: rename override, else the label itself. */
    function displayNameFor(label) {
      if (!label) return label
      try {
        const renames = readRenames()
        const custom = renames[label]
        return typeof custom === 'string' && custom.trim() ? custom.trim() : label
      } catch (error) {
        return label
      }
    }

    function readHiddenEntries() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) || '[]')
        if (parsed && typeof parsed === 'object' && parsed.v === 2 && Array.isArray(parsed.items)) {
          return parsed.items
            .filter(function (e) { return e && typeof e.label === 'string' && e.label })
            .map(function (e) { return { id: e.id || null, label: e.label } })
        }
        if (Array.isArray(parsed)) {
          // legacy v1: plain label array
          return parsed
            .filter(function (x) { return typeof x === 'string' && x })
            .map(function (label) { return { id: null, label: label } })
        }
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeHiddenEntries(entries) {
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify({ v: 2, items: entries || [] }))
        notifyStoreChange('hidden')
      } catch (error) {
        console.warn('[dsh-panel-pins] hidden-rows store write failed (session-only):', error)
      }
    }

    /** Public shape kept a plain label array (current labels, deduped) —
     * badge counts, applyFold, applyHiddenRows and the Alt+N build path all
     * keep doing string indexOf against it. */
    function readHiddenRows() {
      const idMap = readLabelIdMap()
      const out = []
      const seen = {}
      readHiddenEntries().forEach(function (e) {
        const label = resolveEntryLabel(e, idMap)
        if (label && !seen[label]) {
          seen[label] = true
          out.push(label)
        }
      })
      return out
    }

    function writeHiddenRows(arr) {
      const prev = readHiddenEntries()
      const idMap = readLabelIdMap()
      const entries = []
      const seen = {}
      ;(Array.isArray(arr) ? arr : []).forEach(function (label) {
        if (typeof label !== 'string' || !label || seen[label]) return
        seen[label] = true
        let id = null
        for (const p of prev) {
          if (resolveEntryLabel(p, idMap) === label) { id = p.id; break }
        }
        if (!id && idMap[label]) id = idMap[label]
        entries.push({ id: id || null, label: label })
      })
      writeHiddenEntries(entries)
    }

    function isRowHidden(label) {
      return readHiddenRows().indexOf(label) !== -1
    }

    // -------------------------------------------- active-row exemption (v1.3.2)

    /**
     * The currently active panel id, read from the host layout service's
     * public observable (`panelInfo.getSnapshot().activePanelId` — the same
     * contract dsh-panellist and dsh-panel-control consume). Returns null
     * when the service is absent, the snapshot is missing, or the id is not
     * a string — callers treat null as "no exemption".
     */
    function activePanelId() {
      try {
        const layout = optionalService('layout')
        const info = layout && layout.panelInfo
        const snapshot =
          info && typeof info.getSnapshot === 'function' ? info.getSnapshot() : info
        return snapshot && typeof snapshot.activePanelId === 'string'
          ? snapshot.activePanelId
          : null
      } catch (error) {
        return null
      }
    }

    /**
     * Whether the panel row with `label` is the active panel. The label
     * resolves to a panel id through the slot-seeded label→id map; rows
     * whose id is unknown can never match (no guessing — an unknown id must
     * not exempt the wrong row).
     */
    function isActiveRowLabel(label) {
      const active = activePanelId()
      if (!active) return false
      if (label === active) return true // raw-id label fallback (locale lag)
      const id = readLabelIdMap()[label]
      return !!id && id === active
    }

    /**
     * Single-row hide decision with the v1.3.2 exemption. Contract:
     * - Whitelist wins over everything (rows stay visible, never collected).
     * - Collection ON (rows-hidden / family fold) suppresses unconditionally
     *   — the dsh-panellist suppressed-wins rule: collected rows have their
     *   launcher drawer as the entry point, so the active row must NOT pop
     *   back into the sidebar and break the collection contract.
     * - Collection OFF + individually hidden: exempt while the row IS the
     *   active panel ("you are on this page" — the dsh-panellist
     *   hidden-vs-active rule); hidden otherwise.
     */
    function shouldHideRow(label, individuallyHidden, collectionOn) {
      // Whitelist predicate: the FULL isWhitelisted(label, mappedId) form —
      // it covers label matches, direct id entries AND whitelist labels that
      // map to the same id (locale-switch safe). isWhitelistedLabelOrMapped
      // is its strict subset (no `entry === id` check), so using the full
      // form preserves applyFold's original behavior exactly and only
      // strengthens the family-row sweep (whose rows have no id, where the
      // extra clause is inert).
      if (isWhitelisted(label, readLabelIdMap()[label])) return false
      if (collectionOn) return true
      if (individuallyHidden) return !isActiveRowLabel(label)
      return false
    }

    // Test hook: the jsdom regression drives these closures directly (same
    // pattern as window.__dppTransfer).
    try {
      window.__dppActive = {
        activePanelId: activePanelId,
        isActiveRowLabel: isActiveRowLabel,
        shouldHideRow: shouldHideRow,
        setCtx: function (ctx) { ctxRef = ctx },
      }
    } catch (error) {
      /* non-window context */
    }

    // ---------------------------------------- settings-page bridge (v1.4.0)
    // dsh-panel-control's bridged-settings-pages mechanism, adapted: bridge
    // rows do NOT join the sidebar — they surface only inside this plugin's
    // Panels launcher overlay. The host's settings dialog state is private
    // (no API can aim it at one section), so "click a row, land on that
    // page" is only achievable by owning a real main-keyed panel.

    /** Bridge master toggle (default ON). */
    function readBridge() {
      try {
        const raw = window.localStorage.getItem(BRIDGE_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeBridge(value) {
      try {
        window.localStorage.setItem(BRIDGE_KEY, value ? '1' : '0')
      } catch (error) {
        /* ignore */
      }
    }

    /**
     * Sections of the settings.section slot, with the registration face.
     * `inject`, `store`, `locale` and `children` sit on the ENTRY, next to
     * `options` (host StoredEntry shape — dsh-panel-control 0.9.3 incident:
     * reading them from `options` silently yields undefined and the bridged
     * page renders without translations, store or error boundary). `order`
     * is read too: the settings dialog sorts its nav by it, and the launcher
     * group must mirror that order row for row (v1.4.1 parity).
     */
    function readBridgeSections() {
      if (!ctxSlots || typeof ctxSlots.entriesOfSlot !== 'function') return []
      try {
        const raw = ctxSlots.entriesOfSlot(SLOT_SETTINGS) || []
        return raw
          .map(function (entry) {
            const options = (entry && entry.options) || {}
            return {
              id: typeof options.id === 'string' ? options.id : '',
              order: typeof options.order === 'number' ? options.order : 0,
              label: options.label,
              component: entry && entry.component,
              inject: entry && entry.inject,
              store: entry && entry.store,
              locale: entry && entry.locale,
              children: entry && entry.children,
            }
          })
          .filter(function (section) {
            return section.id !== ''
          })
      } catch (error) {
        return []
      }
    }

    function resolveLabelOption(label, fallbackId) {
      try {
        if (typeof label === 'function') label = label()
      } catch (error) {
        label = null
      }
      if (typeof label === 'string' && label.length > 0) return label
      return fallbackId
    }

    /**
     * EVERY settings section becomes a launcher row (v1.4.1 full parity with
     * the settings dialog: the dialog nav is exactly this slot sorted by
     * `order`, so the group mirrors it 1:1 — same rows, same order, same
     * count). v1.4.0 excluded core host pages, sections whose plugin owned a
     * sidebar/main entry, and child-slot declarers; v1.4.1 b88 also bridges
     * OUR OWN settings column (panel-pins): the section is a plain React
     * card column with no slot machinery, so rendering it inside the bridge
     * shell is safe — the earlier "self-nesting" worry was wrong, and count
     * parity was requested explicitly. The single remaining guard: a section
     * without a callable component has nothing to render.
     * The section's OWN child slots (models' provider-card, plugins' tab…)
     * were declared by its original registration and live in the global slot
     * registry — our bridge slot re-renders the same component, so those
     * renderSlots resolve against the original declarations unchanged.
     * Stable sort by `order` (stable so equal orders keep slot order, like
     * the dialog's Array.sort which is stable per spec).
     */
    function bridgeCandidates() {
      const out = []
      const taken = new Set()
      readBridgeSections()
        .filter(function (section) {
          return typeof section.component === 'function'
        })
        .sort(function (a, b) {
          return a.order - b.order
        })
        .forEach(function (section) {
          const label = resolveLabelOption(section.label, section.id)
          const bridgeId = BRIDGE_PREFIX + section.id
          if (taken.has(bridgeId)) return
          taken.add(bridgeId)
          out.push({
            bridgeId: bridgeId,
            sectionId: section.id,
            label: label,
            component: section.component,
            inject: section.inject,
            store: section.store,
            locale: section.locale,
          })
        })
      return out
    }

    /** The bridge lives at factory scope: the overlay reads it on every open. */
    const bridgeSettings = {
      entries: new Map(), // bridgeId -> { sectionId, label, slotName, disposers[] }
      unsub: null,
      timers: [],
      syncing: false,
      declaredHooked: false,
    }

    /** Landing back on the conversation; safe when layout is absent. */
    function bridgeBackToConversation() {
      try {
        const layout = optionalService('layout')
        if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
      } catch (error) {
        /* already on the conversation */
      }
    }

    function disposeBridgeEntry(bridgeId) {
      const record = bridgeSettings.entries.get(bridgeId)
      if (!record) return
      bridgeSettings.entries.delete(bridgeId)
      record.disposers.slice().reverse().forEach(function (dispose) {
        try {
          dispose()
        } catch (error) {
          /* half-disposed pair */
        }
      })
      // The main key is gone: a reader sitting on it would stare at an empty
      // center column. selectPanel(null) is the only safe landing.
      if (activePanelId() === bridgeId) bridgeBackToConversation()
    }

    /** The bridge shell: back bar + the section rendered through OUR slot. */
    function makeBridgePanel(candidate, slotName) {
      return function BridgePanel(props) {
        const renderSlot = props && typeof props.renderSlot === 'function' ? props.renderSlot : null
        let node = null
        try {
          if (renderSlot) node = renderSlot(slotName, { close: bridgeBackToConversation }, {})
        } catch (error) {
          /* renderSlot absent / section threw: shell stays up */
        }
        return h(
          'div',
          { className: 'dpp-bridge' },
          h(
            'div',
            { className: 'dpp-bridge-bar' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-bridge-back',
                onClick: bridgeBackToConversation,
              },
              LABEL.bridgeBack,
            ),
            h('span', { className: 'dpp-bridge-tag' }, LABEL.bridgeTag),
            h('span', { className: 'dpp-bridge-from' }, candidate.sectionId),
          ),
          node
            ? h('div', { className: 'dpp-bridge-body' }, node)
            : h('div', { className: 'dpp-bridge-body' }, h('p', { className: 'dpp-bridge-missing' }, LABEL.bridgeMissing)),
        )
      }
    }

    function syncBridgeSettings() {
      const slots = ctxSlots
      if (!slots || typeof slots.register !== 'function' || bridgeSettings.syncing) return
      bridgeSettings.syncing = true
      try {
        watchSettingsSection()
        const enabled = readBridge()
        const desired = new Map()
        if (enabled) {
          bridgeCandidates().forEach(function (candidate) {
            desired.set(candidate.bridgeId, candidate)
          })
        }
        // Remove first (desired may have shrunk), then add. Reconcile only —
        // re-registering an unchanged row would remount it mid-interaction.
        Array.from(bridgeSettings.entries.keys()).forEach(function (bridgeId) {
          if (!desired.has(bridgeId)) disposeBridgeEntry(bridgeId)
        })
        desired.forEach(function (candidate, bridgeId) {
          if (bridgeSettings.entries.has(bridgeId)) return
          const slotName = BRIDGE_SLOT_PREFIX + candidate.sectionId
          const record = { sectionId: candidate.sectionId, label: candidate.label, slotName: slotName, disposers: [] }
          try {
            record.disposers.push(
              slots.register(
                {
                  name: SLOT_MAIN,
                  key: bridgeId,
                  children: (function () { const c = {}; c[slotName] = { kind: 'single', scope: 'root' }; return c })(),
                },
                makeBridgePanel(candidate, slotName),
              ),
            )
            // Re-register the SAME component with its TOP-LEVEL registration
            // face into our own child slot: the host then supplies inject,
            // locale `t`, store, and the error boundary exactly as it does
            // inside the settings dialog.
            record.disposers.push(
              slots.register(
                {
                  name: slotName,
                  inject: candidate.inject,
                  store: candidate.store,
                  locale: candidate.locale,
                },
                candidate.component,
              ),
            )
            bridgeSettings.entries.set(bridgeId, record)
          } catch (error) {
            // Pair-rollback: a half-registered bridge is worse than none, and
            // a leaked register throw inside loader.start() aborts the whole
            // boot (documented incident).
            record.disposers.slice().reverse().forEach(function (dispose) {
              try {
                dispose()
              } catch (ignored) {
                /* already half gone */
              }
            })
            try {
              console.error('[dsh-panel-pins] bridge register failed for "' + candidate.sectionId + '":', error)
            } catch (ignored) {
              /* console unavailable */
            }
          }
        })
      } catch (error) {
        /* sync must never throw into the caller (refreshAll passes) */
      } finally {
        bridgeSettings.syncing = false
      }
    }

    /**
     * Subscribe to the settings.section registry. `subscribe` is trustworthy
     * only once the slot is DECLARED — pins may apply before the bridged
     * plugin does, and an early subscription observes nothing forever. The
     * declaration-callback retry (this runs again from inside the slot's
     * inject thunk, which the host calls when the slot is declared) plus the
     * boot rescan schedule cover both orders.
     */
    function watchSettingsSection() {
      if (bridgeSettings.unsub) return
      if (!ctxSlots || typeof ctxSlots.subscribe !== 'function') return
      try {
        const dispose = ctxSlots.subscribe(SLOT_SETTINGS, function () {
          scheduleBridgeSync()
        })
        bridgeSettings.unsub = typeof dispose === 'function' ? dispose : null
      } catch (error) {
        /* not declared yet; rescan schedule retries */
      }
    }

    function unwatchSettingsSection() {
      try {
        if (typeof bridgeSettings.unsub === 'function') bridgeSettings.unsub()
      } catch (error) {
        /* ignore */
      }
      bridgeSettings.unsub = null
    }

    function scheduleBridgeSync() {
      if (bridgeSettings.timer) clearTimeout(bridgeSettings.timer)
      bridgeSettings.timer = setTimeout(function () {
        bridgeSettings.timer = null
        syncBridgeSettings()
      }, 120)
    }

    /** Boot rescan: plugins apply in any order, so a declared-later section
     * must still be caught within ~1s of its registration. */
    function scheduleBridgeRescans() {
      bridgeSettings.timers = bridgeSettings.timers || []
      BRIDGE_RESCAN_SCHEDULE.forEach(function (ms) {
        bridgeSettings.timers.push(
          setTimeout(function () {
            syncBridgeSettings()
          }, ms),
        )
      })
    }

    function teardownBridgeTimers() {
      if (bridgeSettings.timer) clearTimeout(bridgeSettings.timer)
      bridgeSettings.timer = null
      ;(bridgeSettings.timers || []).forEach(function (t) {
        clearTimeout(t)
      })
      bridgeSettings.timers = []
    }

    function disposeAllBridges() {
      Array.from(bridgeSettings.entries.keys()).forEach(function (bridgeId) {
        disposeBridgeEntry(bridgeId)
      })
    }

    // Test hook: the jsdom regression drives identification, paired
    // registration, toggle retraction and the back-to-conversation path
    // directly against a fake ctx.
    try {
      window.__dppBridge = {
        readBridge: readBridge,
        writeBridge: writeBridge,
        bridgeCandidates: bridgeCandidates,
        syncBridgeSettings: syncBridgeSettings,
        disposeAllBridges: disposeAllBridges,
        teardownBridgeTimers: teardownBridgeTimers,
        unwatchSettingsSection: unwatchSettingsSection,
        bridgeBackToConversation: bridgeBackToConversation,
        state: bridgeSettings,
      }
    } catch (error) {
      /* non-window context */
    }


    // ---------------------------------------------------- row order (v1.2.2)
    // User-defined sidebar row order via negative CSS `order` on nav rows —
    // same no-DOM-surgery approach as top pins, but for ALL rows. Stored as a
    // label array (locale drift is mitigated by the label-id map reverse
    // lookup, same tradeoff as the v1 hidden stores). Rows not listed keep
    // their host order (partial authority: only reordered rows get a style).
    const ROW_ORDER_KEY = 'dsh-panel-pins:row-order'

    function readRowOrder() {
      try {
        const raw = window.localStorage.getItem(ROW_ORDER_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            return parsed.filter(function (x) { return typeof x === 'string' && x })
          }
        }
      } catch (error) {
        /* fall through to the default */
      }
      return []
    }

    function writeRowOrder(arr) {
      try {
        const clean = (Array.isArray(arr) ? arr : []).filter(function (x) {
          return typeof x === 'string' && x
        })
        window.localStorage.setItem(ROW_ORDER_KEY, JSON.stringify(clean))
        try {
          window.dispatchEvent(new CustomEvent('dpp:store-changed', { detail: { key: 'row-order' } }))
        } catch (error) {
          /* listener optional */
        }
      } catch (error) {
        /* storage unavailable */
      }
    }

    /** Move one row (by its current visible label) to a new index in the
     * stored order array, compacting to "known labels first". Returns the
     * updated array. Used by drag-drop and the context-menu "to front". */
    function moveRowInOrder(label, toIndex) {
      const order = readRowOrder()
      const cur = order.indexOf(label)
      if (cur !== -1) order.splice(cur, 1)
      const at = Math.max(0, Math.min(toIndex, order.length))
      order.splice(at, 0, label)
      writeRowOrder(order)
      return order
    }

    /** idHint (registration id, when the caller knows it) lets the toggle
     * match the entry across locale switches instead of trusting the label. */
    function toggleRowHidden(label, idHint) {
      const idMap = readLabelIdMap()
      const entries = readHiddenEntries()
      const matchId = idHint || idMap[label] || null
      let idx = -1
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]
        if ((matchId && e.id && e.id === matchId) || resolveEntryLabel(e, idMap) === label) {
          idx = i
          break
        }
      }
      if (idx === -1) entries.push({ id: matchId || null, label: label })
      else entries.splice(idx, 1)
      writeHiddenEntries(entries)
      return idx === -1
    }

    /**
     * Collapsible group header: a button row (chevron + title + count).
     * Clicking toggles the group body via inline display; the state persists
     * in FOLD_GROUPS_KEY. The search filter FORCE-SHOWS every item and head
     * while a query is active (applyFilter handles that), so folding and
     * filtering never fight.
     */
    function makeGroupHead(box, groupKey, title, countText) {
      const head = document.createElement('button')
      head.type = 'button'
      head.className = 'dpp-ov-head dpp-ov-ghead'
      head.setAttribute('aria-expanded', 'true')
      // v1.7.1 ARIA: inside the listbox the head is chrome, not an option —
      // keep it focusable (it toggles the fold) but read as its own button
      // instead of polluting the option list.
      head.setAttribute('role', 'presentation')
      head.setAttribute('aria-label', title)
      head.setAttribute('data-dpp-group', groupKey)
      const chev = document.createElement('span')
      chev.className = 'dpp-ov-gchev'
      chev.appendChild(iconSvgPath(ICON_CHEVRON_DOWN, 12))
      head.appendChild(chev)
      const ttl = document.createElement('span')
      ttl.textContent = title
      head.appendChild(ttl)
      const cnt = document.createElement('span')
      cnt.textContent = countText ? ' · ' + countText : ''
      cnt.style.opacity = '.8'
      head.appendChild(cnt)
      box.appendChild(head)
      const folds = readGroupFolds()
      const collapsed = folds[groupKey] === true
      function apply(collapse) {
        head.setAttribute('aria-expanded', collapse ? 'false' : 'true')
        // Rotate the PATH, not the svg root (chev.firstChild): a root
        // transform is interpreted in the parent coordinate system and
        // displaces the 12px glyph out of view.
        const chevPath = chev.querySelector('path')
        if (chevPath) chevPath.setAttribute('transform', collapse ? 'rotate(-90 10 10)' : '')
        let node = head.nextElementSibling
        while (node && !node.classList.contains('dpp-ov-ghead')) {
          if (node.classList.contains('dpp-ov-item') || node.classList.contains('dpp-ov-head')) {
            node.style.display = collapse ? 'none' : ''
          }
          node = node.nextElementSibling
        }
      }
      head.addEventListener('click', function () {
        const next = head.getAttribute('aria-expanded') !== 'false'
        const folds2 = readGroupFolds()
        folds2[groupKey] = next
        writeGroupFolds(folds2)
        apply(next)
      })
      if (collapsed) apply(true)
      return head
    }


    let toastEl = null
    let toastTimer = null

    /**
     * One-shot transient notice, bottom-center. Fully defensive: toast is an
     * optional UX sugar and must never throw into a caller.
     */
    function showToast(message) {
      try {
        if (typeof document === 'undefined') return
        if (toastTimer) clearTimeout(toastTimer)
        if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl)
        const el = document.createElement('div')
        el.className = 'dpp-toast'
        el.setAttribute('role', 'status')
        el.textContent = String(message || '')
        document.body.appendChild(el)
        toastEl = el
        toastTimer = setTimeout(function () {
          try {
            if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl)
          } catch (error) {
            /* ignore */
          }
          toastEl = null
          toastTimer = null
        }, 2600)
      } catch (error) {
        /* ignore */
      }
    }

    /** Hover actions for one overlay panel line: pin/unpin + top. */
    function buildOverlayActs(entry, launcherRef) {
      const acts = document.createElement('span')
      acts.className = 'dpp-ov-acts'
      const pinBtn = document.createElement('button')
      pinBtn.type = 'button'
      pinBtn.className = 'dpp-ov-act'
      pinBtn.appendChild(iconSvgPath(entry.pinned ? ICON_PIN_ALT : ICON_PIN, 14))
      pinBtn.title = entry.pinned ? LABEL.unpin : LABEL.pin
      pinBtn.setAttribute('aria-label', pinBtn.title)
      if (!entry.idKnown) {
        pinBtn.disabled = true
        pinBtn.title = LABEL.setPinNeedMenu
      }
      pinBtn.addEventListener('click', function (event) {
        event.stopPropagation()
        const unpinned = readUnpinned()
        if (entry.pinned) unpinned.add(entry.id)
        else unpinned.delete(entry.id)
        writeUnpinned(unpinned)
        try {
          if (typeof bridge.onPinnedChange === 'function') {
            bridge.onPinnedChange(entry.id, !entry.pinned)
          }
        } catch (error) {
          /* store still holds the state */
        }
        refreshAll()
        openOverlay(launcherRef)
      })
      acts.appendChild(pinBtn)
      const topBtn = document.createElement('button')
      topBtn.type = 'button'
      topBtn.className = 'dpp-ov-act'
      topBtn.appendChild(iconSvgPath(ICON_CHEVRON_UP, 14))
      topBtn.title = entry.top ? LABEL.setTopOff : LABEL.setTop
      topBtn.setAttribute('aria-label', topBtn.title)
      topBtn.setAttribute('data-active', entry.top ? '1' : '0')
      if (!entry.idKnown || !entry.pinned) {
        topBtn.disabled = true
        topBtn.title = !entry.idKnown ? LABEL.setPinNeedMenu : LABEL.setTopNeedPin
      }
      topBtn.addEventListener('click', function (event) {
        event.stopPropagation()
        toggleTopPinStore(entry.id, entry.label)
        applyTopPins()
        openOverlay(launcherRef)
      })
      acts.appendChild(topBtn)
      return acts
    }

    /**
     * v1.5.0 (b95): panels registered in the root `main` keyed slot.
     *
     * The host's main slot holds every full-page panel in the app: the
     * conversation column, the pages our settings bridge registers, and any
     * panel a third-party plugin registers itself. A plugin that ships a
     * full page but NO sidebar row was installed and unreachable — exactly
     * the "装了就摸不到" case this plugin exists for.
     *
     * The host enumerates that slot itself with ctx.slots.entries('main')
     * (see ui-layout's retainMainPanels), so we read the same public slot.
     * Opening is layout.selectPanel(key) — the same call the settings bridge
     * already makes for bridged pages.
     */
    function readMainPanels() {
      if (!ctxSlots) return []
      let entries = []
      try {
        if (typeof ctxSlots.entries === 'function') entries = ctxSlots.entries(SLOT_MAIN) || []
        else if (typeof ctxSlots.entriesOfSlot === 'function') {
          entries = ctxSlots.entriesOfSlot(SLOT_MAIN) || []
        }
      } catch (error) {
        return []
      }
      if (!Array.isArray(entries)) return []
      const out = []
      entries.forEach(function (entry) {
        const options = (entry && entry.options) || {}
        const key = options.key
        if (typeof key !== 'string' || !key) return
        if (key === 'conversation') return // the host's own column
        if (key.indexOf(BRIDGE_PREFIX) === 0) return // already in the bridge group
        const label =
          typeof options.label === 'string' && options.label
            ? options.label
            : typeof options.title === 'string' && options.title
              ? options.title
              : key
        out.push({ key: key, label: label })
      })
      return out
    }

    /**
     * v1.6.0: the host's RIGHT sidebar tab types.
     *
     * The host keeps a registry of right-sidebar tab types
     * (ctx.sidebarRightTabs) plus a navigation controller
     * (ctx.sidebarRight). A tab type is either a PAGE type — no `patterns`,
     * opened by kind — or a RESOURCE type, which declares `patterns` over
     * `dsh-resource://` addresses and is opened by ADDRESS.
     *
     * openTab() only ever synthesizes the page address `sidebar://<kind>`
     * (ui-sidebar-right/src/client/service.ts:482, contract/seed.ts:45-47);
     * it does not consult `patterns`. Opening a RESOURCE kind by name would
     * therefore mount a body that throws on a non-resource address
     * (documentpreview src/client/code/CodeBody.tsx:17). So we list PAGE
     * TYPES ONLY — the resource types have no address we could derive from a
     * type listing anyway (there is no "enumerate the addresses of a type"
     * API).
     *
     * The registry's entries() already returns only the definitions that are
     * IN FORCE — a builtin shadowed by an extension is absent — so we never
     * reason about the extension/builtin priority ourselves
     * (tab-registry.ts:313-315, :407-408).
     */
    function readRightSidebarTabs() {
      let registry = null
      try {
        registry = optionalService('sidebarRightTabs')
      } catch (error) {
        return []
      }
      if (!registry || typeof registry.entries !== 'function') return []
      let entries = []
      try {
        entries = registry.entries() || []
      } catch (error) {
        return []
      }
      if (!Array.isArray(entries)) return []
      const out = []
      entries.forEach(function (def) {
        if (!def || typeof def.kind !== 'string' || !def.kind) return
        const patterns = def.patterns
        if (Array.isArray(patterns) && patterns.length > 0) return // resource type
        if (RIGHT_TAB_BLOCKED[def.kind]) return // needs navigation params we cannot supply
        out.push({ kind: def.kind, label: rightTabLabel(def) })
      })
      return out
    }

    /**
     * Kinds that cannot be opened by name alone. `scheduleTask` is opened with
     * params ({sessionId, id}) that a type listing cannot supply; the params
     * map is a type-level declaration only and does not exist at runtime
     * (ui-sidebar-right/src/client/contract/params.ts:38-40), so this list
     * is maintained by hand.
     */
    const RIGHT_TAB_BLOCKED = {
      scheduleTask: true,
    }

    /** The tab chip text. `title` is a required FUNCTION of an address. */
    function rightTabLabel(def) {
      try {
        // Page types receive the synthesized page address `sidebar://<kind>`
        // (contract/seed.ts:45-47). pageAddress() itself is NOT a public
        // export, so we compose the same string.
        const title = typeof def.title === 'function' ? def.title('sidebar://' + def.kind) : ''
        if (typeof title === 'string' && title) return title
      } catch (error) {
        /* a third-party title() may throw — fall back to the kind */
      }
      return def.kind
    }

    /**
     * Whether the right sidebar can be driven right now. The host throws
     * "no session surface is mounted" before it even looks the kind up
     * (ui-sidebar-right/src/client/service.ts:391, :854-864), so with no
     * session on screen the whole group would be dead rows.
     */
    function rightSidebarAvailable() {
      try {
        const right = optionalService('sidebarRight')
        if (!right || typeof right.openTab !== 'function') return false
        const mounted = right.mounted
        if (mounted && typeof mounted.getSnapshot === 'function') {
          return mounted.getSnapshot() !== undefined
        }
        return true
      } catch (error) {
        return false
      }
    }

    /** Open a right-sidebar tab type by kind, with the host's own guards. */
    function openRightSidebarTab(kind) {
      try {
        const registry = optionalService('sidebarRightTabs')
        // The type may have been unloaded between opening the menu and the
        // click — the host throws for an unregistered kind
        // (service.ts:481), so re-check before asking it to open anything.
        if (registry && typeof registry.get === 'function' && registry.get(kind) === undefined) {
          return false
        }
        const right = optionalService('sidebarRight')
        if (!right || typeof right.openTab !== 'function') return false
        right.openTab(kind)
        return true
      } catch (error) {
        return false
      }
    }

    /** Build the floating menu that lists every panel and plugin entry. */
    function openOverlay(launcher) {
      closeOverlay()
      const nav = findPanelListNav()
      // Palette mode passes launcher=null (centered positioning) — only bail
      // when there is genuinely nothing to show.
      if (!nav && !paletteMode) return
      if (!nav && paletteMode === false && !launcher) return
      const liveRows = nav ? findPanelRows(nav) : []
      const famRows = findFamilyRows().filter(function (row) {
        if (isRowHidden(rowLabel(row))) return false // v1.1.0 hidden rows
        return !isWhitelistedLabelOrMapped(rowLabel(row))
      })
      // b76: opt-in footer entries (kanban etc.) join the family group —
      // collected or not, the menu is where they stay reachable from the
      // top of the sidebar.
      findFooterRows().forEach(function (row) {
        if (isRowHidden(rowLabel(row))) return
        if (isWhitelistedLabelOrMapped(rowLabel(row))) return
        famRows.push(row)
      })
      // Merged FULL panel inventory (visible rows + unpinned store + host-fed
      // entries): the menu becomes the single place to reach any panel, even
      // unpinned ones. Whitelisted entries stay in the sidebar — not listed.
      // v1.1.0: user-hidden rows are excluded here too (Settings restores).
      const allPanels = readPanelList().filter(function (entry) {
        if (isRowHidden(entry.label)) return false
        return !isWhitelisted(entry.label, entry.idKnown ? entry.id : undefined)
      })
      // v1.6.0: the host's right-sidebar tab types. Enumerated here (before
      // the empty-menu guard) so a session whose ONLY reachable surfaces are
      // right-sidebar tabs still gets a menu.
      const rightTabs = rightSidebarAvailable() ? readRightSidebarTabs() : []
      if (allPanels.length === 0 && famRows.length === 0 && rightTabs.length === 0 && !paletteMode && bridgeSettings.entries.size === 0) return

      const box = document.createElement('div')
      box.className = paletteMode ? 'dpp-overlay dpp-palette' : 'dpp-overlay'
      // v1.7.1 ARIA: the overlay is a non-modal dialog that CONTAINS a
      // listbox — role="menu" was invalid here (an editable search input is
      // not a menu item) and left the rows' options without a proper owner.
      box.setAttribute('role', 'dialog')
      box.setAttribute('aria-label', paletteMode ? LABEL.ovPalette : LABEL.ovMenu)
      box.dataset.plugin = 'dsh-panel-pins'

      // v0.10.7: middle scroll region. Every list child (group heads, items,
      // empty state) appends here; the search input stays above it and the
      // footer rows + Ctrl+K hint stay below it — neither ever scrolls away
      // nor gets clipped by --dpp-overlay-max.
      const body = document.createElement('div')
      body.className = 'dpp-ov-body'
      body.setAttribute('role', 'listbox')
      body.setAttribute('id', 'dpp-ov-list')
      box.appendChild(body)

      // Searchable registry of every row the menu renders. Built while the
      // groups are appended; drives the filter box and ↑↓ navigation below.
      const menuItems = []

      // v1.0.0 b40: preset NAME-MODE state at openOverlay scope. The palette
      // cmd block assigns enterPresetNameMode later (it needs `search`,
      // declared further down); the keydown handler near the search input
      // reads both. Declaring them here keeps one scope for flag + function.
      let presetNameMode = false
      let enterPresetNameMode = null

      // Palette mode: quick-commands group first (toggle actions that
      // otherwise live at the overlay's bottom or deep in Settings).
      if (paletteMode) {
        makeGroupHead(body, 'cmd', LABEL.cmdTitle, '')
        function cmdItem(iconD, text, action) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(iconSvgPath(iconD, 16))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = text
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            // v1.0.0 b40: preset naming needs the overlay to STAY OPEN (the
            // search input becomes the name field), so the save command opts
            // out of the auto-close. Every other command keeps the original
            // close-then-run behavior.
            const keepOpen = text === LABEL.cmdPresetSave
            if (!keepOpen) closeOverlay()
            try {
              action()
            } catch (error) {
              /* ignore */
            }
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: text, group: 'cmd' })
        }
        cmdItem(ICON_CHEVRON_DOWN, readRowsHidden() ? LABEL.cmdShowRows : LABEL.cmdHideRows, function () {
          writeRowsHidden(!readRowsHidden())
          applyFold()
          ensureLauncher()
          adviseIfNoRows()
        })
        cmdItem(ICON_STACK, LABEL.cmdToggleFamily, function () {
          writeFamily(!readFamily())
          applyFamily()
        })
        cmdItem(ICON_GRID, LABEL.setIconOnly, function () {
          writeFlag(ICONONLY_KEY, !readIconOnly())
          applyIconOnly()
        })
        cmdItem(ICON_COMPACT, LABEL.cmdToggleTidy, function () {
          writeTidy(!readTidy())
          applyTidy()
        })
        // v1.3.3: palette feedback command. Opens the settings card's home
        // channels: the GitHub issue (primary) — the survey/diagnostics stay
        // on the card where the user can read the privacy note before acting.
        cmdItem(ICON_FEEDBACK, LABEL.cmdFeedback, function () {
          openFeedbackIssue()
        })
        // v1.1.0 b60: palette "Open Settings" command removed — the host
        // ignores every synthetic path (keyboard/mouse/React fiber) because
        // Electron requires isTrusted events and the trigger div is not
        // React-rendered (b59 diagnostics: "DIV fired=N").
        // v1.0.0 layout presets: one "save" command + one switch command per
        // stored preset. window.prompt is NOT available in Electron renderer
        // ("prompt() is and will not be supported"), so the save path reuses
        // the search input as a name field. The name-mode wiring itself lives
        // right after the search input is created (see PRESET NAME MODE
        // below) — it must attach listeners there because `search` is a
        // later const; touching it here would be a TDZ ReferenceError.
        // v1.0.0 b40 scope fix: the flag itself also lives at openOverlay
        // scope (declared near the top of this function) so the name-mode
        // keydown handler attached further down can see it — this if-block
        // closes before `search` exists.
        enterPresetNameMode = function () {
          presetNameMode = true
          search.value = ''
          search.placeholder = LABEL.cmdPresetSavePrompt
          applyFilter()
          try {
            search.focus()
          } catch (error) {
            /* ignore */
          }
        }
        cmdItem(ICON_PIN, LABEL.cmdPresetSave, function () {
          enterPresetNameMode()
        })
        const presetNames = Object.keys(readPresets())
        if (presetNames.length === 0) {
          cmdItem(ICON_PIN, LABEL.cmdPresetNone, function () {
            showToast(LABEL.presetEmptyHint)
          })
        } else {
          presetNames.forEach(function (pn) {
            cmdItem(ICON_PIN, LABEL.cmdPresetPrefix + pn, function () {
              try {
                if (applyPreset(pn)) {
                  showToast(LABEL.presetApplied.replace('NAME', pn))
                  return
                }
              } catch (error) {
                /* fall through to the fallback */
              }
              showToast(LABEL.presetApplyFailed.replace('NAME', pn))
            })
          })
        }
      }

      // C1 (v0.13.0): Recent group — MRU panel opens, rendered before the
      // full panel group in BOTH modes (palette and overlay). Only labels
      // that still resolve to an inventory entry are shown; every click
      // re-records (newest first). Search, keyboard nav, Alt+N and fold
      // memory all work automatically because the rows go through the same
      // menuItems/group-head machinery.
      const recentLabels = readRecent().filter(function (rl) {
        return allPanels.some(function (e) { return (e.label || '') === rl })
      })
      if (recentLabels.length > 1 || (recentLabels.length === 1 && allPanels.length > 1)) {
        makeGroupHead(body, 'recent', LABEL.recentTitle, '')
        recentLabels.forEach(function (rl) {
          const entry = allPanels.filter(function (e) { return (e.label || '') === rl })[0]
          if (!entry) return
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')

          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          const row = rowForEntry(entry, liveRows)
          const svg = row ? svgClone(row, 16) : null
          if (svg) ico.appendChild(svg)
          else ico.appendChild(letterBadge(rl))
          item.appendChild(ico)

          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = rl
          item.appendChild(lbl)

          if (row && row.getAttribute('aria-current') === 'page') {
            const dot = document.createElement('span')
            dot.className = 'dpp-ov-dot'
            item.appendChild(dot)
          }

          item.addEventListener('click', function () {
            closeOverlay()
            openPanelEntry(entry, row) // openPanelEntry records the recency
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: rl, group: 'recent' })
        })
      }

      // v1.0.0 custom groups: entries assigned to a user group are pulled out
      // of the global list and rendered under their own group heads (inserted
      // right after the global group). One shared row builder keeps every
      // group's items identical (icon, dot, hover actions, click behavior).
      const cgAssigned = customGroupedLabels()
      const globalPanels = []
      const cgRows = {} // gid -> [{entry, label}]
      allPanels.forEach(function (entry) {
        const label = entry.label || LABEL.unnamed
        if (cgAssigned[label]) {
          Object.keys(readCustomGroups()).forEach(function (gid) {
            const g = readCustomGroups()[gid]
            if (g && Array.isArray(g.labels) && g.labels.indexOf(label) !== -1) {
              if (!cgRows[gid]) cgRows[gid] = []
              cgRows[gid].push({ entry: entry, label: label })
            }
          })
        } else {
          globalPanels.push(entry)
        }
      })

      // b74: the menu must agree with the sidebar's VISUAL order. The
      // sidebar paints top pins (-20000..) first, then drag-reordered rows
      // (row-order store, -15000..), then the host default. The merged
      // inventory arrives in host DOM order, so without a sort the menu
      // listed rows in an order the sidebar no longer showed.
      const roLabels = readRowOrder()
      const tpins = readTopPins()
      const lmap = readLabelIdMap()
      const menuRank = globalPanels.map(function (entry, i) {
        const label = entry.label || ''
        const ti = topPinIndexFor(label, lmap, tpins)
        if (ti !== -1) return { entry: entry, i: i, rank: 0, idx: ti }
        const ri = roLabels.indexOf(label)
        if (ri !== -1) return { entry: entry, i: i, rank: 1, idx: ri }
        return { entry: entry, i: i, rank: 2, idx: 0 }
      })
      menuRank.sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank
        if (a.rank === 2) return a.i - b.i // unordered rows keep host order
        if (a.idx !== b.idx) return a.idx - b.idx
        return a.i - b.i
      })
      globalPanels.length = 0
      menuRank.forEach(function (x) { globalPanels.push(x.entry) })

      // Global group head: badge must count what this group actually RENDERS
      // (globalPanels), not the merged inventory — assigned entries moved to
      // their own groups would otherwise inflate the number by one each.
      // Hidden entirely when every panel lives in a custom group (non-palette
      // keeps the head for parity with the old always-show behavior only when
      // no custom groups claim anything).
      let cgRowCount = 0
      Object.keys(cgRows).forEach(function (gid) {
        cgRowCount += cgRows[gid].length
      })
      if (globalPanels.length > 0 || (cgRowCount === 0 && paletteMode === false)) {
        makeGroupHead(body, 'panel', LABEL.groupPanels, globalPanels.length > 0 ? String(globalPanels.length) : '')
      }

      function buildPanelItem(entry, label) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'dpp-ov-item'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', 'false')

        const ico = document.createElement('span')
        ico.className = 'dpp-ov-ico'
        const row = rowForEntry(entry, liveRows)
        const svg = row ? svgClone(row, 16) : null
        if (svg) ico.appendChild(svg)
        else ico.appendChild(letterBadge(label))
        item.appendChild(ico)

        const lbl = document.createElement('span')
        lbl.className = 'dpp-ov-lbl'
        lbl.textContent = displayNameFor(label)
        item.appendChild(lbl)

        if (!entry.pinned) {
          item.classList.add('dpp-ov-unpinned')
        }

        if (row && row.getAttribute('aria-current') === 'page') {
          const dot = document.createElement('span')
          dot.className = 'dpp-ov-dot'
          item.appendChild(dot)
        }

        // Hover actions: pin/unpin + to-top (desktop pointer only; CSS shows
        // them on hover, buttons remain keyboard-reachable via tab order).
        if (entry.idKnown) {
          item.appendChild(buildOverlayActs(entry, launcher))
        }

        item.addEventListener('click', function () {
          closeOverlay()
          openPanelEntry(entry, row)
        })
        return item
      }

      // Panel items come from the MERGED inventory (visible + unpinned),
      // minus the ones a custom group claims. Unpinned entries open via
      // temporary-pin "peek" (openPanelEntry). v1.1.0: hidden rows are
      // excluded (they live in Settings' restore list until unhidden).
      globalPanels.forEach(function (entry) {
        const label = entry.label || LABEL.unnamed
        if (isRowHidden(label)) return
        const item = buildPanelItem(entry, label)
        body.appendChild(item)
        menuItems.push({ el: item, text: label, group: 'panel' })
      })

      // v1.5.0 (b95): third-party panels registered in the root `main` slot.
      // They have no sidebar row of their own, so without this group they
      // are unreachable from the launcher. The group only appears when the
      // layout service can actually open a panel.
      const mainPanels = readMainPanels()
      if (mainPanels.length > 0 && (function () {
        try {
          const layout = optionalService('layout')
          return !!(layout && typeof layout.selectPanel === 'function')
        } catch (error) {
          return false
        }
      })()) {
        makeGroupHead(body, 'main', LABEL.groupMain, String(mainPanels.length))
        mainPanels.forEach(function (entry) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(entry.label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = entry.label
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            try {
              const layout = optionalService('layout')
              if (layout && typeof layout.selectPanel === 'function') {
                layout.selectPanel(entry.key)
                return
              }
            } catch (error) {
              showToast(
                zh ? '这个面板已不可用' : 'That panel is no longer available',
              )
              return
            }
            showToast(zh ? '宿主未提供面板切换能力' : 'The host cannot switch panels')
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: entry.label, group: 'main' })
        })
      }

      // v1.6.0: the host's right-sidebar tab types (page types only). They
      // live in the right column, not the sidebar, but they are the same kind
      // of thing the launcher exists for: a panel you cannot reach by
      // clicking around. The group only appears when the host can actually
      // open a tab right now.
      if (rightTabs.length > 0) {
        makeGroupHead(body, 'right', LABEL.groupRight, String(rightTabs.length))
        rightTabs.forEach(function (entry) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(entry.label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = entry.label
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            if (openRightSidebarTab(entry.kind)) return
            showToast(zh ? '这个标签页已不可用' : 'That tab is no longer available')
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: entry.label, group: 'right' })
        })
      }

      // Custom group heads + their items, after the global group.
      const groups = readCustomGroups()
      Object.keys(groups).forEach(function (gid) {
        const rows = cgRows[gid]
        if (!rows || rows.length === 0) return // empty groups stay hidden
        makeGroupHead(body, 'cg:' + gid, groups[gid].name || gid, String(rows.length))
        rows.forEach(function (pair) {
          const item = buildPanelItem(pair.entry, pair.label)
          body.appendChild(item)
          menuItems.push({ el: item, text: pair.label, group: 'cg:' + gid })
        })
      })

      // v1.4.0: bridged settings pages — one group, only while entries exist
      // and the toggle is ON. Clicking selects the bridge panel (no sidebar
      // row exists to click through); the layout service is mandatory here,
      // so without it the whole group hides (no dead rows).
      if (readBridge() && bridgeSettings.entries.size > 0 && (function () {
        try {
          const layout = optionalService('layout')
          return !!(layout && typeof layout.selectPanel === 'function')
        } catch (error) {
          return false
        }
      })()) {
        makeGroupHead(body, 'bridge', LABEL.bridgeGroup, String(bridgeSettings.entries.size))
        bridgeSettings.entries.forEach(function (record, bridgeId) {
          const label = record.label || record.sectionId
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item dpp-ov-unpinned'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          item.dataset.dppBridge = bridgeId
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = label
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            try {
              const layout = optionalService('layout')
              if (layout && typeof layout.selectPanel === 'function') {
                layout.selectPanel(bridgeId)
              }
            } catch (error) {
              /* selectPanel throws for unregistered keys (rc.5 contract) —
                 the bridge row is gone but the overlay closed cleanly */
            }
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: label, group: 'bridge' })
        })
      }

      // Plugin entry rows (family rows), grouped separately. Clicking an item
      // fires the ORIGINAL control; bottom entries are never listed here.
      // (Rows stay listed even while collected/hidden — that's where to find
      // them: hidden ≠ gone.)
      if (famRows.length > 0) {
        makeGroupHead(body, 'family', LABEL.groupFamily, String(famRows.length))
        famRows.forEach(function (row) {
          const label = rowLabel(row) || LABEL.unnamed
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')

          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          const svg = rowIcon(row)
          if (svg) ico.appendChild(svg)
          else ico.appendChild(letterBadge(label))
          item.appendChild(ico)

          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = displayNameFor(label)
          item.appendChild(lbl)

          const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
          if (btn && btn.getAttribute('aria-current') === 'page') {
            const dot = document.createElement('span')
            dot.className = 'dpp-ov-dot'
            item.appendChild(dot)
          }

          item.addEventListener('click', function () {
            closeOverlay()
            triggerRow(row)
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: label, group: 'family' })
        })
      }

      // v1.1.1 (b67): hidden rows finally have a reachable restore surface.
      // A display:none row can never receive a right-click, so the ctx
      // menu's own "Unhide" item is dead UI once the hide took effect —
      // this group (alongside the Settings card) is the always-reachable
      // way back. Click = restore (writes + toast + refreshAll).
      const hiddenEntries = readHiddenEntries()
      if (hiddenEntries.length > 0) {
        makeGroupHead(body, 'hidden', LABEL.groupHidden, String(hiddenEntries.length))
        const hidMap = readLabelIdMap()
        hiddenEntries.forEach(function (entry) {
          const label = resolveEntryLabel(entry, hidMap) || entry.label
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item dpp-ov-unpinned'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = displayNameFor(label)
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            const rows = readHiddenRows()
            const idx = rows.indexOf(label)
            if (idx !== -1) rows.splice(idx, 1)
            writeHiddenRows(rows)
            showToast((zh ? '已恢复显示「NAME」' : 'Restored "NAME"').replace('NAME', displayNameFor(label)))
            refreshAll()
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: label, group: 'hidden' })
        })
      }

      // Filter + keyboard navigation. The search input sits ABOVE the
      // scrollable body (flex row pinned at the top); typing hides
      // non-matching items (and a group head with no visible children); ↑↓
      // move a highlight, Enter activates, Esc closes.
      const search = document.createElement('input')
      search.type = 'text'
      search.className = 'dpp-ov-search'
      search.placeholder = paletteMode ? LABEL.searchPh : LABEL.searchPh
      search.setAttribute('aria-label', LABEL.searchPh)
      // v1.7.1 ARIA: combobox pattern — the input owns the listbox below it
      // and exposes the keyboard highlight via aria-activedescendant.
      search.setAttribute('role', 'combobox')
      search.setAttribute('aria-expanded', 'true')
      search.setAttribute('aria-haspopup', 'listbox')
      search.setAttribute('aria-autocomplete', 'list')
      search.setAttribute('aria-controls', 'dpp-ov-list')
      search.setAttribute('autocomplete', 'off')
      search.setAttribute('spellcheck', 'false')
      box.insertBefore(search, body)

      const empty = document.createElement('div')
      empty.className = 'dpp-ov-empty'
      empty.textContent = LABEL.searchEmpty
      empty.setAttribute('role', 'status')
      empty.style.display = 'none'
      body.appendChild(empty)

      // C3 (v0.12.0): search hit highlight. Splits the row label around the
      // query and wraps matches in <mark class="dpp-mark">; rebuilding is
      // cheap (only the label span changes) and keeps the icon, dot and
      // hover-action cluster untouched. Escaping is unnecessary — the label
      // never enters innerHTML; every fragment goes through textContent.
      function applyMark(mi, q) {
        const lbl = mi.el.querySelector('.dpp-ov-lbl')
        if (!lbl) return
        const text = mi.display || mi.text
        if (!q) {
          // Restore the plain label and drop the query cache, or a repeat of
          // the same query would early-return below and skip the re-mark.
          if (lbl.firstChild && lbl.childNodes.length !== 1) {
            lbl.textContent = text
          } else if (lbl.textContent !== text) {
            lbl.textContent = text
          }
          lbl.removeAttribute('data-dpp-mark-q')
          return
        }
        const lower = text.toLowerCase()
        const idx = lower.indexOf(q)
        if (idx < 0) {
          if (lbl.textContent !== text) lbl.textContent = text
          return
        }
        if (lbl.getAttribute('data-dpp-mark-q') === q) return // already marked for this query
        lbl.textContent = ''
        lbl.setAttribute('data-dpp-mark-q', q)
        if (idx > 0) lbl.appendChild(document.createTextNode(text.slice(0, idx)))
        const mark = document.createElement('mark')
        mark.className = 'dpp-mark'
        mark.textContent = text.slice(idx, idx + q.length)
        lbl.appendChild(mark)
        if (idx + q.length < text.length) {
          lbl.appendChild(document.createTextNode(text.slice(idx + q.length)))
        }
      }

      let kbIndex = -1
      /** Which group a head belongs to: reads the group key we stamped on it. */
      function groupKeyOfHead(h) {
        return h.getAttribute('data-dpp-group') || ''
      }
      /**
       * Replay persisted fold states onto the built overlay: chevron, aria
       * AND the group body items. forceExpand=true shows everything (search
       * mode). This must run AFTER all groups/items are appended —
       * makeGroupHead's inline apply collapses an empty body and is lost as
       * items arrive later.
       */
      function replayGroupFolds(forceExpand) {
        const folds = forceExpand ? {} : readGroupFolds()
        for (const el of body.children) {
          if (!el.classList || !el.classList.contains('dpp-ov-ghead')) continue
          const key = el.getAttribute('data-dpp-group')
          const collapse = folds[key] === true
          el.setAttribute('aria-expanded', collapse ? 'false' : 'true')
          // Rotate the PATH (as makeGroupHead.apply does) — a transform on
          // the root <svg> is interpreted in the parent coordinate system
          // and throws the 12px glyph out of view.
          const chev = el.querySelector('.dpp-ov-gchev svg path')
          if (chev) chev.setAttribute('transform', collapse ? 'rotate(-90 10 10)' : '')
          let node = el.nextElementSibling
          while (node && !node.classList.contains('dpp-ov-ghead')) {
            if (node.classList.contains('dpp-ov-item')) {
              node.style.display = collapse ? 'none' : ''
            }
            node = node.nextElementSibling
          }
        }
      }
      /**
       * Rank the hits INSIDE each group. The group order never changes, so a
       * folded group keeps its place and the group heads stay adjacent to
       * their rows (replayGroupFolds walks head -> next sibling).
       *
       * With no query the original build order is restored — a previous
       * ranked search moved DOM nodes around, and clearing the box must put
       * everything back where the user left it.
       */
      function reorderGroups(scores, ranked) {
        const groups = new Map()
        menuItems.forEach(function (mi) {
          const key = mi.group || ''
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key).push(mi)
        })
        groups.forEach(function (list) {
          if (list.length < 2) return
          let ordered = list
          if (ranked) {
            // Array.prototype.sort is stable: equal scores keep the original
            // order, so the ranking never shuffles equal rows.
            ordered = list.slice().sort(function (a, b) {
              return (scores.get(b.el) || 0) - (scores.get(a.el) || 0)
            })
          }
          const parent = list[0].el.parentNode
          if (!parent) return
          const anchor = list[0].el
          // Inserting each element right before the anchor keeps the sorted
          // order (the first insert lands closest to the anchor's old slot).
          ordered.forEach(function (mi) {
            try {
              parent.insertBefore(mi.el, anchor)
            } catch (error) {
              /* a detached row must not break the filter */
            }
          })
        })
      }
      function applyFilter() {
        const q = search.value.trim().toLowerCase()
        const heads = []
        for (const el of body.children) {
          if (el.classList && el.classList.contains('dpp-ov-head')) heads.push(el)
        }
        // While searching, fold states lose: every matching item must show.
        // replayGroupFolds(true) must run BEFORE the filter pass — it resets
        // item display wholesale, so running it after the filter resurrects
        // rows the filter just hid (b29 regression the v0.12.0 walkthrough
        // caught: search looked like it did nothing at all).
        if (q.length > 0) replayGroupFolds(true)
        let visibleCount = 0
        const scores = new Map()
        menuItems.forEach(function (mi) {
          // Match the DISPLAY name, not the raw label: a renamed row is what
          // the user sees, and the pinyin forms come from it too.
          mi.display = displayNameFor(mi.text)
          const match =
            q.length === 0 ? { hit: true, score: 0, mark: -1 } : matchLabel(mi.display, q)
          mi.el.style.display = match.hit ? '' : 'none'
          // Only a literal hit has a substring to highlight — sound hits
          // (pinyin) have no contiguous span in the label.
          applyMark(mi, match.mark >= 0 ? q : '')
          scores.set(mi.el, match.score)
          if (match.hit) visibleCount++
        })
        reorderGroups(scores, q.length > 0)
        if (q.length > 0) {
          heads.forEach(function (h) {
            h.style.display = ''
          })
        } else {
          // Restore persisted folds; then hide heads whose whole group is
          // folded OR fully filtered out.
          replayGroupFolds(false)
          heads.forEach(function (h) {
            let any = false
            let node = h.nextElementSibling
            while (node && !node.classList.contains('dpp-ov-head')) {
              if (node.style.display !== 'none') {
                any = true
                break
              }
              node = node.nextElementSibling
            }
            const folded = h.classList.contains('dpp-ov-ghead') &&
              h.getAttribute('aria-expanded') === 'false'
            h.style.display = any && !folded ? '' : 'none'
          })
        }
        empty.style.display = visibleCount === 0 ? '' : 'none'
        kbIndex = -1
        clearKb()
      }
      function visibleItems() {
        return menuItems.filter(function (mi) {
          return mi.el.style.display !== 'none'
        })
      }
      function clearKb() {
        for (const mi of menuItems) {
          mi.el.classList.remove('dpp-kb')
          mi.el.setAttribute('aria-selected', 'false')
        }
        try {
          search.removeAttribute('aria-activedescendant')
        } catch (error) {
          /* ignore */
        }
      }
      // v1.7.1 ARIA: options need stable ids for aria-activedescendant.
      let kbOptSeq = 0
      function setKb(idx) {
        const vis = visibleItems()
        if (vis.length === 0) return
        kbIndex = ((idx % vis.length) + vis.length) % vis.length
        clearKb()
        const target = vis[kbIndex]
        target.el.classList.add('dpp-kb')
        target.el.setAttribute('aria-selected', 'true')
        try {
          if (!target.el.id) target.el.id = 'dpp-ov-opt-' + String(++kbOptSeq)
          search.setAttribute('aria-activedescendant', target.el.id)
        } catch (error) {
          /* ignore */
        }
        try {
          target.el.scrollIntoView({ block: 'nearest' })
        } catch (error) {
          /* older engines without options */
        }
      }
      search.addEventListener('input', applyFilter)
      search.addEventListener('keydown', function (event) {
        // v1.5.0 (b95): the host's shortcut resolver passes in editable
        // regions, and our own search box IS an editable region — so the
        // palette closes here instead of through the host binding.
        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
          event.preventDefault()
          event.stopPropagation()
          closeOverlay()
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          event.stopPropagation()
          setKb(kbIndex + 1)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          event.stopPropagation()
          setKb(kbIndex - 1)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          const vis = visibleItems()
          if (kbIndex >= 0 && kbIndex < vis.length) vis[kbIndex].el.click()
          else if (vis.length === 1) vis[0].el.click()
        }
      })
      // PRESET NAME MODE (v1.0.0 b40): while entering a preset name the
      // search input is repurposed — Enter commits, Escape cancels. This
      // handler runs after the navigation handler above; in name mode Enter
      // is consumed here (stopPropagation) so keyboard activation cannot
      // fire while naming. presetNameMode/enterPresetNameMode are shared
      // with the palette cmd block via openOverlay scope.
      search.addEventListener('keydown', function (event) {
        if (!presetNameMode) return
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          const n = search.value.trim()
          presetNameMode = false
          search.placeholder = LABEL.searchPh
          search.value = ''
          applyFilter()
          if (!n) {
            showToast(LABEL.presetNameRequired)
            return
          }
          try {
            if (savePreset(n)) showToast(LABEL.presetSavedAs.replace('NAME', n))
          } catch (error) {
            /* ignore */
          }
        } else if (event.key === 'Escape') {
          // Leave name mode without saving (Esc also closes the overlay via
          // the document handler; stopping here keeps the box clean).
          presetNameMode = false
          search.placeholder = LABEL.searchPh
          search.value = ''
          applyFilter()
        }
      })

      // Bottom toggle rows: skipped in palette mode (quick-commands already
      // cover them, and the palette searches those too).
      if (!paletteMode) {
        const foot = document.createElement('button')
        foot.type = 'button'
        foot.className = 'dpp-ov-item dpp-ov-foot'
        const footIco = document.createElement('span')
        footIco.className = 'dpp-ov-ico'
        foot.appendChild(footIco)
        const footLbl = document.createElement('span')
        footLbl.className = 'dpp-ov-lbl'
        footLbl.textContent = readRowsHidden() ? LABEL.showRows : LABEL.hideRows
        foot.appendChild(footLbl)
        foot.addEventListener('click', function () {
          closeOverlay()
          writeRowsHidden(!readRowsHidden())
          applyFold()
          ensureLauncher()
          adviseIfNoRows()
        })
        box.appendChild(foot)

        // Plugin-rows toggle: fold/unfold the third-party entry rows between
        // the new-session anchor and the panel list. Bottom entries stay put.
        const fam = document.createElement('button')
        fam.type = 'button'
        fam.className = 'dpp-ov-item'
        const famIco = document.createElement('span')
        famIco.className = 'dpp-ov-ico'
        const famSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        famSvg.setAttribute('width', '16')
        famSvg.setAttribute('height', '16')
        famSvg.setAttribute('viewBox', '0 0 20 20')
        famSvg.setAttribute('fill', 'none')
        famSvg.setAttribute('stroke', 'currentColor')
        famSvg.setAttribute('stroke-width', '1.4')
        famSvg.setAttribute('stroke-linecap', 'round')
        famSvg.setAttribute('stroke-linejoin', 'round')
        const famPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        famPath.setAttribute('d', ICON_STACK)
        famSvg.appendChild(famPath)
        famIco.appendChild(famSvg)
        fam.appendChild(famIco)
        const famLbl = document.createElement('span')
        famLbl.className = 'dpp-ov-lbl'
        famLbl.textContent = readFamily() ? LABEL.familyOff : LABEL.familyOn
        fam.appendChild(famLbl)
        fam.addEventListener('click', function () {
          closeOverlay()
          writeFamily(!readFamily())
          applyFamily()
        })
        box.appendChild(fam)


        // Compact-footer toggle. Only the container is capped/scrolled — the
        // footer entries themselves never move into this menu.
        const tidy = document.createElement('button')
        tidy.type = 'button'
        tidy.className = 'dpp-ov-item'
        const tidyIco = document.createElement('span')
        tidyIco.className = 'dpp-ov-ico'
        const tidySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        tidySvg.setAttribute('width', '16')
        tidySvg.setAttribute('height', '16')
        tidySvg.setAttribute('viewBox', '0 0 20 20')
        tidySvg.setAttribute('fill', 'none')
        tidySvg.setAttribute('stroke', 'currentColor')
        tidySvg.setAttribute('stroke-width', '1.4')
        tidySvg.setAttribute('stroke-linecap', 'round')
        tidySvg.setAttribute('stroke-linejoin', 'round')
        const tidyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        tidyPath.setAttribute('d', ICON_COMPACT)
        tidySvg.appendChild(tidyPath)
        tidyIco.appendChild(tidySvg)
        tidy.appendChild(tidyIco)
        const tidyLbl = document.createElement('span')
        tidyLbl.className = 'dpp-ov-lbl'
        tidyLbl.textContent = readTidy() ? LABEL.tidyOn : LABEL.tidyOff
        tidy.appendChild(tidyLbl)
        tidy.addEventListener('click', function () {
          closeOverlay()
          writeTidy(!readTidy())
          applyTidy()
        })
        box.appendChild(tidy)

        // Shortcut discoverability: one muted hint line at the very bottom.
        // v1.2.1: documents the full keyboard surface (search/Enter/Esc/Alt+N),
        // not just Ctrl+K — the exclusive features deserve findability.
        // v1.2.2: documents row drag, since a hover-less gesture is invisible
        // without a written hint.
        const hint = document.createElement('div')
        hint.className = 'dpp-ov-hint'
        hint.textContent = zh
          ? '输入即搜 · Enter 打开 · Esc 关闭 · Alt+数字直达 · Ctrl+K 快速命令 · 按住侧栏行可拖动排序'
          : 'Type to search · Enter opens · Esc closes · Alt+N jumps · Ctrl+K quick commands · drag sidebar rows to reorder'
        box.appendChild(hint)
      }

      document.body.appendChild(box)
      overlay = box
      positionOverlay(launcher)

      const onDown = function (event) {
        if (!overlay) return
        const target = event.target
        if (overlay.contains(target)) return
        if (launcher && launcher.contains(target)) return
        closeOverlay()
      }
      const onKey = function (event) {
        if (!event) return
        if (event.key === 'Escape') {
          closeOverlay()
          return
        }
        // C2 (v0.12.0): Alt+1..9 activates the Nth visible item directly.
        // Runs BEFORE the search-input guard on purpose — the palette opens
        // with the search box focused, and this shortcut must work from
        // there. Digits match by event.code too (layout-stable, covers
        // numpad); Ctrl/Meta combos are left to the host.
        if (
          event.altKey && !event.ctrlKey && !event.metaKey &&
          (/^[1-9]$/.test(event.key) || /^Digit[1-9]$/.test(event.code) || /^Numpad[1-9]$/.test(event.code))
        ) {
          const n = Number((/^Digit|^Numpad/.test(event.code) ? event.code.slice(-1) : event.key)) - 1
          const vis = visibleItems()
          if (vis[n]) {
            event.preventDefault()
            event.stopPropagation()
            vis[n].el.click()
            return
          }
          // Out of range: fall through (don't swallow host shortcuts).
        }
        if (event.target === search) return // the input handles its own keys
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setKb(kbIndex + 1)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setKb(kbIndex - 1)
        } else if (event.key === 'Enter') {
          const vis = visibleItems()
          if (kbIndex >= 0 && kbIndex < vis.length) {
            event.preventDefault()
            vis[kbIndex].el.click()
          }
        }
      }
      document.addEventListener('pointerdown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      overlayCleanup = function () {
        document.removeEventListener('pointerdown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
      }
      // Re-apply persisted group folds AFTER every group and item exists.
      // makeGroupHead's initial apply(true) runs while its group body is still
      // empty (items are appended after the head), so it collapses nothing —
      // the folded state must be replayed here or re-opens lose the memory.
      try {
        replayGroupFolds()
      } catch (error) {
        /* fold memory is cosmetic */
      }
      // Focus the search box so typing filters immediately (re-open keeps
      // this behavior — the box is rebuilt every open).
      try {
        search.focus()
      } catch (error) {
        /* focus can fail on hidden containers */
      }
    }

    // ------------------------------------------------------------ row context menu

    let ctxMenuEl = null
    let ctxMenuCleanup = null

    function closeCtxMenu() {
      if (ctxMenuEl && ctxMenuEl.parentNode) ctxMenuEl.parentNode.removeChild(ctxMenuEl)
      ctxMenuEl = null
      if (ctxMenuCleanup) {
        try {
          ctxMenuCleanup()
        } catch (error) {
          /* ignore */
        }
        ctxMenuCleanup = null
      }
    }

    /**
     * v1.1.1 b69 display rename: an inline text editor rendered as a
     * BODY-LEVEL float anchored below the row's label element — NOT a node
     * inserted into the row. The row subtree is host React territory:
     * live-counter ticks re-render it constantly and any foreign node (plus
     * the b52 data-dpp-renaming guard) gets ripped out within milliseconds
     * (b68 walk evidence: editor vanished before the first keystroke, zero
     * DOM/storage effect). A body-level float survives host reconciliation.
     *
     * b69 contract:
     * - anchor  label.getBoundingClientRect(): left = rect.left,
     *           top = rect.bottom + 4, width = clamp(rect.width, 220, 300)
     * - rAF-merged reposition on resize / scroll / sidebar geometry changes
     *           (ResizeObserver on the panel nav); bottom flip when the
     *           viewport is short, everything clamped to an 8px safety band
     * - row detached or label rect collapsed to zero -> cancel dispose,
     *           no orphan nodes, no dangling listeners
     * - GLOBAL SINGLETON: re-triggering disposes the previous instance first
     * - every exit funnels through one dispose(): listeners off, guard
     *           interval off, focus handed back to the row
     * - commit never touches the row DOM — the next refreshAll/applyFold
     *           pass rewrites the label text from the rename store
     * Enter/blur commits (empty = reset), Escape cancels.
     */
    let renameFloat = null

    function disposeRenameFloat(commit, reason) {
      const st = renameFloat
      if (!st) return
      renameFloat = null
      if (st.raf) window.cancelAnimationFrame(st.raf)
      if (st.guard) clearInterval(st.guard)
      if (st.ro) {
        try {
          st.ro.disconnect()
        } catch (error) {
          /* ignore */
        }
      }
      window.removeEventListener('resize', st.schedule)
      window.removeEventListener('scroll', st.schedule, true)
      try {
        st.wrap.remove()
      } catch (error) {
        /* ignore */
      }
      // b69 evidence stub (kept from b68's CDP取证桩 — regression reads it).
      try {
        document.title = 'dpp-rename:DONE reason=' + reason + (commit ? ' commit=1' : ' commit=0')
      } catch (error) {
        /* ignore */
      }
      if (commit) {
        try {
          const map = readRenames()
          const value = st.editor.value.trim()
          if (!value || value === st.original) delete map[st.original]
          else map[st.original] = value
          writeRenames(map)
        } catch (error) {
          /* session-only */
        }
        // applyFold rewrites the row text on this pass — never edit row DOM here.
        refreshAll()
      }
      // Hand focus back to the originating row (any exit). Rows are plain
      // divs most of the time — focus() is a no-op there, never an error.
      if (st.row && st.row.isConnected) {
        try {
          st.row.focus({ preventScroll: true })
        } catch (error) {
          /* non-focusable row */
        }
      }
    }

    function beginRowRename(row, kind) {
      const entered = '' + (row && row.tagName) + '/' + (row && row.isConnected)
      const original = kind === 'family' ? rowLabel(row) : (row.getAttribute('aria-label') || rowLabel(row) || '').trim()
      if (!original) {
        document.title = 'dpp-rename:ENTERED ' + entered + ' label=EMPTY'
        return
      }
      if (!row.isConnected) {
        const fresh = findRowByLabel(original, kind)
        document.title = 'dpp-rename:ENTERED ' + entered + ' detached label=' + original + ' fresh=' + (fresh ? 'FOUND' : 'NULL')
        if (fresh) row = fresh
      } else {
        document.title = 'dpp-rename:ENTERED ' + entered + ' label=' + original
      }
      if (!row.isConnected) return
      // NOTE: the rename store is keyed by the ORIGINAL label, so rows that
      // genuinely share a label rename together — by design (the label is
      // the stable handle). findRowByLabel already prefers the first
      // connected row in DOM order, so the editor always anchors a live row.
      const renames = readRenames()
      const current = typeof renames[original] === 'string' && renames[original].trim() ? renames[original].trim() : original
      const nameEl = row.querySelector('[class$="_label"], .dpp-label') || row
      // b69: global singleton — a second trigger revokes the live instance
      // (cancel, not commit) before its own float exists.
      if (renameFloat) disposeRenameFloat(false, 'superseded')
      const wrap = document.createElement('div')
      wrap.className = 'dpp-rename-float'
      wrap.style.zIndex = '2147482000'
      const editor = document.createElement('input')
      editor.type = 'text'
      editor.value = current
      editor.className = 'dpp-row-rename'
      editor.setAttribute('aria-label', LABEL.renamePrompt)
      wrap.appendChild(editor)
      document.body.appendChild(wrap)
      // b69: the state object is registered as the global singleton BEFORE
      // the first reposition — a row-gone/rect-zero on that first pass must
      // find a live state to dispose, or the wrap + guard interval would
      // leak as orphans.
      const st = { wrap: wrap, editor: editor, row: row, original: original, schedule: null, raf: 0, guard: 0, ro: null }
      renameFloat = st
      let done = false
      let rafPending = false
      st.guard = setInterval(function () {
        // Low-rate liveness sweep (the plugin already runs one for the rest
        // of its DOM asserts): catches row removal / rect collapse with no
        // resize/scroll/RO trigger, so the float never outlives its row.
        schedule()
      }, 1000)
      const finish = function (commit, reason) {
        // Identity guard: a late blur from a JUST-SUPERSEDED instance must
        // not commit (and kill) the NEW float — only the instance the global
        // still points at may funnel into dispose.
        if (done || renameFloat !== st) return
        done = true
        disposeRenameFloat(commit, reason)
      }
      const reposition = function () {
        if (done) return
        try {
          // Row left the DOM (host re-render, hide, filter) -> cancel.
          if (!row.isConnected) {
            finish(false, 'row-gone')
            return
          }
          const q = nameEl.getBoundingClientRect()
          // Rect collapsed to zero (display:none ancestor, folded away) -> cancel.
          if (!q || (!q.width && !q.height)) {
            finish(false, 'rect-zero')
            return
          }
          const vw = window.innerWidth || 1280
          const vh = window.innerHeight || 800
          const w = Math.min(300, Math.max(220, Math.round(q.width)))
          const h = wrap.offsetHeight || 40
          // Anchor below the label; flip above when the bottom band is short.
          const below = q.bottom + 4
          const above = q.top - h - 4
          let top = below
          if (below + h > vh - 8 && above >= 8) top = above
          // 8px safety band on both axes.
          top = Math.min(Math.max(Math.round(top), 8), Math.max(8, vh - h - 8))
          const left = Math.min(Math.max(Math.round(q.left), 8), Math.max(8, vw - w - 8))
          wrap.style.left = left + 'px'
          wrap.style.top = top + 'px'
          wrap.style.width = w + 'px'
        } catch (error) {
          finish(false, 'measure-error')
        }
      }
      const schedule = function () {
        // rAF merge: bursts of resize/scroll/RO events collapse into one
        // reposition per frame.
        if (rafPending || done) return
        rafPending = true
        st.raf = window.requestAnimationFrame(function () {
          rafPending = false
          reposition()
        })
      }
      st.schedule = schedule
      // First paint position (after append, so offsetHeight is real).
      reposition()
      // Instant-cancel path (row gone / rect zero on first measure): the
      // dispose already ran — do NOT attach window listeners or focus an
      // editor inside a removed wrap (they would leak past this function).
      if (done || renameFloat !== st) return
      try {
        document.title = 'dpp-rename:FLOAT label=' + original + ' inDoc=' + editor.isConnected
      } catch (error) {
        /* ignore */
      }
      try {
        editor.focus()
        editor.select()
      } catch (error) {
        /* ignore */
      }
      // Sidebar geometry: folds and row removals change the nav's box.
      try {
        const nav = findPanelListNav()
        if (nav && typeof ResizeObserver === 'function') {
          st.ro = new ResizeObserver(schedule)
          st.ro.observe(nav)
        }
      } catch (error) {
        /* RO unavailable — scroll/resize/guard still cover it */
      }
      window.addEventListener('resize', schedule)
      window.addEventListener('scroll', schedule, true)
      editor.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          finish(true, 'enter')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          finish(false, 'escape')
        }
      })
      editor.addEventListener('blur', function () {
        finish(true, 'blur')
      })
      editor.addEventListener('click', function (e) {
        e.stopPropagation()
      })
    }
    /** One context-menu line; reuses the overlay row metrics (.dpp-row). */
    function ctxRow(parent, iconPath, label, onClick, opts) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'dpp-row'
      btn.setAttribute('role', 'menuitem')
      const ico = document.createElement('span')
      ico.className = 'dpp-icon'
      ico.appendChild(iconSvgPath(iconPath, 14))
      btn.appendChild(ico)
      const lbl = document.createElement('span')
      lbl.className = 'dpp-label'
      lbl.textContent = label
      btn.appendChild(lbl)
      btn.addEventListener('click', function (event) {
        event.stopPropagation()
        closeCtxMenu()
        try {
          onClick()
        } catch (error) {
          // b69: never swallow silently — a thrown action (e.g. beginRowRename)
          // used to vanish without any observable signal. Surface it on the
          // console AND on the b68-style CDP title stub the regression reads.
          const msg = (error && error.message) || String(error)
          try {
            document.title = 'dpp-ctx-error: ' + msg
          } catch (titleError) {
            /* ignore */
          }
          try {
            console.error('[dsh-panel-pins] context action failed:', error)
          } catch (consoleError) {
            /* console unavailable */
          }
        }
      })
      if (opts && opts.title) {
        btn.title = opts.title
      }
      if (opts && opts.disabled) {
        btn.disabled = true
        if (!opts.title) btn.title = ''
      }
      parent.appendChild(btn)
      return btn
    }

    /**
     * Right-click menu on any sidebar row (panel row or plugin entry row):
     * open / pin-unpin / to-top / whitelist / collect-this-row. The whitelist
     * action stores the panel id when one resolves (locale-safe, v0.8.0).
     */
    function openCtxMenu(event, row, kind) {
      closeCtxMenu()
      const label = kind === 'family' ? rowLabel(row) : (row.getAttribute('aria-label') || rowLabel(row) || '').trim()
      if (!label) return
      const map = readLabelIdMap()
      const id = kind === 'family' ? null : map[label] || null

      const menu = document.createElement('div')
      menu.className = 'dpp-ctx'
      menu.setAttribute('role', 'menu')
      menu.dataset.plugin = 'dsh-panel-pins'
      const title = document.createElement('div')
      title.className = 'dpp-ctx-title'
      title.textContent = label
      menu.appendChild(title)

      // Open: click the original control (family rows unwrap; panel rows click).
      ctxRow(menu, ICON_CHEVRON_DOWN, LABEL.ctxOpen, function () {
        if (kind === 'family') triggerRow(row)
        else {
          try {
            row.click()
          } catch (error) {
            /* ignore */
          }
        }
      })

      // Pin management: only for panel rows with a resolvable id.
      if (id) {
        const unpinned = readUnpinned()
        const isPinned = !unpinned.has(id)
        ctxRow(menu, isPinned ? ICON_PIN_ALT : ICON_PIN, isPinned ? LABEL.ctxUnpin : LABEL.ctxPin, function () {
          const store = readUnpinned()
          if (isPinned) store.add(id)
          else store.delete(id)
          writeUnpinned(store)
          try {
            if (typeof bridge.onPinnedChange === 'function') bridge.onPinnedChange(id, !isPinned)
          } catch (error) {
            /* store still holds the state */
          }
          refreshAll()
        })
        const topPins = readTopPins()
        const isTop = topPins.some(function (e) {
          return e.id === id
        })
        if (isPinned) {
          ctxRow(menu, ICON_CHEVRON_UP, isTop ? LABEL.ctxTopOff : LABEL.ctxTop, function () {
            toggleTopPinStore(id, label)
            applyTopPins()
          })
        }
      }

      // Whitelist ("keep in sidebar"): toggle id-first, label fallback.
      const whitelisted = id ? isWhitelisted(label, id) : isWhitelistedLabelOrMapped(label)
      ctxRow(menu, ICON_PIN, whitelisted ? LABEL.ctxWhitelistOff : LABEL.ctxWhitelist, function () {
        toggleWhitelistEntryGlobal(label, id)
      })

      // v1.1.0: rename (display layer) — swaps the row into an inline input;
      // Enter/blur commits, Escape cancels. Original label stays the storage
      // key, so pins/groups/whitelist are unaffected.
      ctxRow(menu, ICON_EDIT, LABEL.ctxRename, function () {
        // b68: close the menu BEFORE inserting the editor. The editor grabs
        // focus; when the menu is torn down afterwards (its own outside-
        // interaction cleanup), the focus shuffle blurs the editor and the
        // blur-commit races the first keystroke — the editor vanished without
        // ever showing a caret (b67 walk111/walk112 evidence). Closing first
        // keeps editor.focus() the LAST focus operation.
        closeCtxMenu()
        beginRowRename(row, kind)
      })

      // v1.1.0: hide this row from the sidebar (restore from Settings).
      const isHidden = isRowHidden(label)
      ctxRow(menu, ICON_EYE_OFF, isHidden ? LABEL.ctxUnhide : LABEL.ctxHide, function () {
        const stillHidden = toggleRowHidden(label, id)
        showToast(
          stillHidden
            ? (zh ? '已隐藏「NAME」' : 'Hidden "NAME"').replace('NAME', displayNameFor(label))
            : (zh ? '已恢复显示「NAME」' : 'Restored "NAME"').replace('NAME', displayNameFor(label)),
        )
        refreshAll()
      })

      // v1.2.2: move to front — the touch/no-HTML5-DnD fallback for row
      // ordering (mirrors dsh-panel-layout's "move to top" arrow). Works for
      // every panel row regardless of pin state.
      ctxRow(menu, ICON_CHEVRON_UP, LABEL.ctxToFront, function () {
        try {
          moveRowInOrder(label, 0)
          showToast((zh ? '「NAME」已移到最前' : '"NAME" moved to front').replace('NAME', displayNameFor(label)))
          refreshAll()
        } catch (error) {
          /* storage unavailable */
        }
      }, { title: zh
        ? '把该行排到面板列表顶部（也可直接按住行拖动排序）'
        : 'Put this row at the top of the panel list (you can also drag rows to reorder)' })

      document.body.appendChild(menu)
      ctxMenuEl = menu
      // Position at the cursor, clamped to the viewport.
      const mw = menu.offsetWidth
      const mh = menu.offsetHeight
      const vw = window.innerWidth || 1280
      const vh = window.innerHeight || 800
      let left = event.clientX + 2
      let top = event.clientY + 2
      if (left + mw > vw - 8) left = Math.max(8, event.clientX - mw - 2)
      if (top + mh > vh - 8) top = Math.max(8, event.clientY - mh - 2)
      menu.style.left = left + 'px'
      menu.style.top = top + 'px'

      // Keyboard reachability (v0.11.0): focus lands on the first enabled
      // item; ↑↓ move between items, Home/End jump, Enter activates (native),
      // Esc/Tab close. Disabled rows are skipped (they are unfocusable).
      const items = function () {
        return Array.prototype.filter.call(
          menu.querySelectorAll('button.dpp-row'),
          function (b) {
            return !b.disabled
          },
        )
      }
      const focusAt = function (idx) {
        const list = items()
        if (list.length === 0) return
        const target = list[((idx % list.length) + list.length) % list.length]
        try {
          target.focus()
        } catch (error) {
          /* ignore */
        }
      }
      const firstIdx = items().indexOf(document.activeElement)
      if (firstIdx < 0) focusAt(0)
      menu.addEventListener('keydown', function (e) {
        const list = items()
        const cur = list.indexOf(document.activeElement)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(cur < 0 ? 0 : cur + 1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(cur < 0 ? list.length - 1 : cur - 1)
        } else if (e.key === 'Home') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(list.length - 1)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          e.stopPropagation()
          closeCtxMenu()
        }
      })
      // Focus the first enabled item once the listeners are attached. The
      // focusAt call above may run before this menu is in the a11y tree —
      // repeat after paint for reliability.
      setTimeout(function () {
        if (ctxMenuEl === menu && !menu.contains(document.activeElement)) focusAt(0)
      }, 0)

      const onDown = function (e) {
        if (!ctxMenuEl) return
        if (ctxMenuEl.contains(e.target)) return
        closeCtxMenu()
      }
      const onKey = function (e) {
        if (e && e.key === 'Escape') closeCtxMenu()
      }
      const onScrollOrResize = function () {
        closeCtxMenu()
      }
      document.addEventListener('pointerdown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      window.addEventListener('scroll', onScrollOrResize, true)
      window.addEventListener('resize', onScrollOrResize)
      ctxMenuCleanup = function () {
        document.removeEventListener('pointerdown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
        window.removeEventListener('scroll', onScrollOrResize, true)
        window.removeEventListener('resize', onScrollOrResize)
      }
    }

    /** Module-level whitelist toggle for the context menu (settings page has
     * its own React-bound copy). Falls back to label when id is unknown. */
    function toggleWhitelistEntryGlobal(label, id) {
      const list = readWhitelist()
      const l = String(label || '').toLowerCase()
      const idx = list.findIndex(function (n) {
        if (id && n === id) return true
        if (l && n.toLowerCase() === l) return true
        if (id) {
          const mapped = readLabelIdMap()[n]
          if (mapped && mapped === id) return true
        }
        return false
      })
      if (idx >= 0) list.splice(idx, 1)
      else list.push(id || label)
      writeWhitelist(list)
      refreshAll()
    }

    /** b65: re-resolve a LIVE sidebar row by its original aria-label right
     * before an action mutates it (rename editor insertion). The row the
     * context menu captured may have been replaced by a host re-render while
     * the menu sat open. kind: 'panel' | 'family' — same matchers as
     * handleContext. Returns null when no connected row matches. */
    function findRowByLabel(label, kind) {
      if (typeof document === 'undefined' || !label) return null
      try {
        if (kind !== 'family') {
          const nav = findPanelListNav()
          if (nav) {
            for (const row of findPanelRows(nav)) {
              const l = (row.getAttribute('aria-label') || row.textContent || '').trim()
              if (l === label && row.isConnected) return row
            }
          }
        }
        for (const fam of findFamilyRows()) {
          const l = (fam.getAttribute('aria-label') || rowLabel(fam) || '').trim()
          if (l === label && fam.isConnected) return fam
        }
      } catch (error) {
        /* fall through */
      }
      return null
    }

    /** Global contextmenu listener: match sidebar rows via structural checks
     * (panel rows are buttons inside the panel-list nav; family rows via the
     * anchor-nav span). Non-matching right-clicks are ignored entirely. */
    function handleContext(event) {
      if (typeof document === 'undefined') return
      try {
        const nav = findPanelListNav()
        if (nav) {
          const panelRows = findPanelRows(nav)
          for (const row of panelRows) {
            if (row.contains(event.target)) {
              openCtxMenu(event, row, 'panel')
              return
            }
          }
        }
        for (const fam of findFamilyRows()) {
          if (fam.contains(event.target)) {
            openCtxMenu(event, fam, 'family')
            return
          }
        }
      } catch (error) {
        /* never break the host's own context menu on internal errors */
      }
    }

    // ---------------------------------------------------------- command palette

    // ---------------------------------------------------------- recent queue

    /** MRU queue of recently opened panel labels (C1, v0.13.0). */
    function readRecent() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]')
        if (!Array.isArray(parsed)) return []
        const seen = {}
        const out = []
        for (const item of parsed) {
          if (typeof item !== 'string' || !item || seen[item]) continue
          seen[item] = true
          out.push(item)
        }
        return out.slice(0, RECENT_CAP)
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeRecent(arr) {
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_CAP)))
      } catch (error) {
        /* session-only */
      }
    }

    /** Record a panel open: newest first, deduped, capped. Empty labels skip. */
    function recordRecent(label) {
      if (typeof label !== 'string' || !label.trim()) return
      const next = [label].concat(readRecent().filter(function (l) {
        return l !== label
      }))
      writeRecent(next)
    }

    // v1.1.0 b60: the entire "open host Settings" machinery
    // (openSettingsPage / domProbeOpenSettings / fiber / avatar / synthetic
    // event paths) was REMOVED. Every synthetic route is ignored by the
    // Electron host (isTrusted enforcement) and the settings trigger div is
    // not React-rendered (b59 diagnostics: "DIV fired=N" — no __reactProps$
    // key). The palette "Open Settings" command is gone with it.
    // scheduleSectionClick (settings-left-nav row clicker) was removed too:
    // with openSettingsPage gone it has no callers.

    /**
     * Ctrl+K command palette: the panels overlay in a centered palette shell
     * plus a quick-commands group. Reuses openOverlay's whole render path —
     * we flip a mode flag before calling it, and the shared builder appends
     * the command group and the centered class when the flag is set.
     */
    let paletteMode = false

    function openPalette() {
      closeCtxMenu()
      paletteMode = true
      try {
        openOverlay(null) // no launcher: palette positions centered
      } finally {
        paletteMode = false
      }
    }

    /** Toggle via host layout API when present, else fail soft with a toast. */
    function openPaletteSafe() {
      try {
        const nav = findPanelListNav()
        const famRows = findFamilyRows()
        if (!nav && famRows.length === 0) {
          showToast(zh ? '侧栏尚未就绪，稍后再试' : 'Sidebar is not ready yet — try again shortly')
          return
        }
        openPalette()
      } catch (error) {
        try {
          console.error('[dsh-panel-pins] palette failed:', error)
        } catch (ignored) {
          /* ignore */
        }
      }
    }

    // ---------------------------------------------------------------------
    // v1.5.0 (b95): host-level shortcut registration.
    //
    // The host ships a first-class shortcut service (ctx.shortcuts): a
    // binding is declared per runtime/platform, the host computes the focus
    // region for us (input / textarea / contenteditable / terminal / shadow
    // root), arbitrates against open modals, detects conflicts with its own
    // commands, and the user can rebind the key in Settings -> Shortcuts.
    //
    // Until now Ctrl+K was a raw document keydown listener plus our own
    // "is the user typing?" sniffing — which is exactly what the host's
    // resolver exists for. Registering is therefore both a UX win (the key
    // becomes rebindable and shows up in the host's shortcut catalog) and a
    // correctness win (the region decision comes from the host).
    //
    // Registration can fail: hosts before 0.2.2 have no such service, and a
    // host that already binds Ctrl+K rejects an overlapping default. In both
    // cases we keep the legacy listener — the fallback is the contract, not
    // an error path.
    // ---------------------------------------------------------------------
    let hostShortcutDispose = null
    let hostShortcutActive = false

    /** Open the palette, or close it when it is already open. */
    function togglePalette() {
      try {
        if (overlay) closeOverlay()
        else openPaletteSafe()
      } catch (error) {
        /* never break the host keyboard handling */
      }
    }

    /**
     * Register Ctrl+K with the host. Returns true when the host took over
     * the binding.
     *
     * Note the resolver does its own region/modal check: on Desktop the host
     * runs native bindings with priority and does NOT apply `regions`/
     * `modals` itself (only the Web path does), so the guard has to live
     * here or Ctrl+K would steal the key from the chat box.
     */
    function registerHostPaletteShortcut() {
      const shortcuts = optionalService('shortcuts')
      if (!shortcuts || typeof shortcuts.register !== 'function') return false
      try {
        const dispose = shortcuts.register({
          id: 'dsh-panel-pins.palette',
          label: function () {
            return zh ? '打开面板启动器' : 'Open panel launcher'
          },
          aliases: ['panel', 'launcher', 'palette', 'dpp', '面板'],
          defaults: {
            'desktop:macos': { code: 'KeyK', modifiers: ['primary'] },
            'desktop:windows': { code: 'KeyK', modifiers: ['primary'] },
            'desktop:linux': { code: 'KeyK', modifiers: ['primary'] },
            'web:macos': { code: 'KeyK', modifiers: ['primary'] },
            'web:windows': { code: 'KeyK', modifiers: ['primary'] },
            'web:linux': { code: 'KeyK', modifiers: ['primary'] },
          },
          regions: ['page'],
          modals: [],
          resolve: function (context) {
            const region = context && context.region
            const modal = context && context.modal
            // The host computed the region — trust it instead of sniffing
            // the event target ourselves.
            if (region === 'editable' || region === 'terminal') {
              return { status: 'pass' }
            }
            if (modal !== null && modal !== undefined) {
              return { status: 'pass' }
            }
            return { status: 'handled', run: togglePalette }
          },
        })
        hostShortcutDispose = typeof dispose === 'function' ? dispose : null
        hostShortcutActive = true
        return true
      } catch (error) {
        try {
          console.warn('[dsh-panel-pins] host shortcut registration failed:', error)
        } catch (ignored) {
          /* console unavailable */
        }
        return false
      }
    }

    /** Global Ctrl+K capture. Registered once in apply(), inside the
     * defensive DOM block; capture phase so host shortcuts lose the race.
     *
     * v1.5.0: when the host owns the binding (ctx.shortcuts available), this
     * listener stands down for Ctrl+K — the host dispatches it, and a second
     * handler would toggle the palette twice. The palette's own search box
     * handles Ctrl+K locally instead (the host passes in editable regions).
     */
    function handleGlobalKey(event) {
      try {
        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
          // Don't hijack Ctrl+K inside text inputs that belong to the HOST
          // (chat box etc.) — only fire when the focus is not an editable
          // field, or when our own palette/overlay is already open (Esc-like
          // re-press closes it).
          const t = event.target
          const editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.isContentEditable === true))
          const inOurUi = overlay && t && overlay.contains(t)
          if (inOurUi) {
            event.preventDefault()
            event.stopPropagation()
            closeOverlay()
            return
          }
          // The host owns Ctrl+K now — leave it alone.
          if (hostShortcutActive) return
          if (editable) return
          event.preventDefault()
          event.stopPropagation()
          if (overlay) closeOverlay()
          else openPaletteSafe()
        }
      } catch (error) {
        /* never break host keyboard handling */
      }
    }

    function positionOverlay(launcher) {
      if (!overlay) return
      // Palette mode (launcher=null): centered via CSS class, nothing to do.
      if (!launcher) return
      const rect = launcher.getBoundingClientRect()
      overlay.style.visibility = 'hidden'
      const pw = overlay.offsetWidth
      const ph = overlay.offsetHeight
      const vw = window.innerWidth || 1280
      const vh = window.innerHeight || 800
      let top = rect.bottom + 6
      if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 6)
      let left = rect.left
      if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8)
      overlay.style.left = left + 'px'
      overlay.style.top = top + 'px'
      overlay.style.visibility = ''
    }

    /**
     * Create (or refresh) the launcher row inside the panel list nav.
     *
     * It is appended as the LAST DOM child and pulled to the top with CSS
     * `order: -1`. Appending (rather than inserting first) is deliberate: the
     * host renderer appends new panel rows at the end of the nav, so an
     * appended foreign node keeps a stable relative position and never causes
     * the host to reorder or drop one of its own rows.
     */
    /**
     * b81: rc.3 wheel interception workaround. The host binds a wheel handler
     * on _scrollArea (bindViewportRef) that calls preventDefault() and scrolls
     * its shared viewport manually — native wheel scrolling of ANY child
     * scroller, including our capped panel list, is suppressed (mechanical
     * scrollTop still works; real wheels do nothing). Drive the list scroll
     * ourselves from a capture-phase listener and stop the host handler from
     * also scrolling the shared viewport (double input).
     */
    function installNavWheelScroll(nav) {
      if (!nav || nav.__dppWheelScroll) return
      nav.__dppWheelScroll = true
      nav.addEventListener('wheel', function (event) {
        // Pixel deltas only; line/page modes stay native.
        let dy = event.deltaY
        if (event.deltaMode === 1) dy *= 16
        else if (event.deltaMode !== 0) return
        const max = nav.scrollHeight - nav.clientHeight
        if (max <= 0) return // nothing to scroll: let the event pass
        event.preventDefault()
        event.stopPropagation()
        nav.scrollTop = Math.max(0, Math.min(max, nav.scrollTop + dy))
      }, { capture: true, passive: false })
    }

    /**
     * v1.4.8: LITE nav-wheel driver for the rc.5 hand-off contract. The rc.5
     * viewport handler (scroll-handoff.ts) preventDefaults EVERY wheel event
     * over the sidebar nav and drives only the viewport, so the capped panel
     * list can never scroll ITSELF (v1.4.4 user report: 工作区可以滑动、列表
     * 滑动不了). The contract-safe way to fix it:
     *   - a step the capped list can absorb (not at its boundary in the
     *     gesture direction): preventDefault + drive the LIST. The host
     *     hand-off handler returns early on event.defaultPrevented, so it
     *     never double-drives.
     *   - a step AT the list boundary (end reached going down / top reached
     *     going up): pass through completely — no preventDefault, no
     *     stopPropagation, no viewport writes. The host hand-off observes
     *     the untouched event and runs its own gesture transition (nav
     *     scrolls away → workspace takes over; workspace returns to top →
     *     nav unrolls), exactly as designed.
     * v1.4.5's failure is precisely avoided: it stopPropagation'd AND
     * hand-wrote viewport.scrollTop, desynchronizing the host's gesture
     * state so the workspace seat never took the hand-off. Event ordering
     * makes this work without touching the host: this listener is CAPTURE on
     * the nav (fires first), the host's is a bubble listener on the viewport
     * ancestor (fires after) and exits on defaultPrevented.
     */
    function installNavWheelLite(nav) {
      if (!nav || nav.__dppWheelScroll) return
      nav.__dppWheelScroll = true
      nav.addEventListener('wheel', function (event) {
        // Pixel deltas only; line mode scales like the host, page/odd modes
        // stay native (the host driver translates them itself).
        let dy = event.deltaY
        if (event.deltaMode === 1) dy *= 16
        else if (event.deltaMode !== 0) return
        if (event.ctrlKey) return // pinch-zoom stays native
        const listMax = nav.scrollHeight - nav.clientHeight
        if (listMax <= 0) return // list fits: nothing to absorb; host handles it
        const atBottom = nav.scrollTop >= listMax - 1
        const atTop = nav.scrollTop <= 1
        const absorbing = (dy > 0 && !atBottom) || (dy < 0 && !atTop)
        if (!absorbing) return // boundary step: untouched pass-through, host hand-off runs
        event.preventDefault()
        // NO stopPropagation (v1.4.5's workspace killer): the host handler
        // still sees the event and exits on defaultPrevented.
        nav.scrollTop = Math.max(0, Math.min(listMax, nav.scrollTop + dy))
      }, { capture: true, passive: false })
    }

    function ensureLauncher() {
      if (typeof document === 'undefined') return null
      const nav = findPanelListNav()
      if (!nav) return null
      // b81/v1.4.8: keep the wheel driver attached to the live nav node,
      // dispatched by the detected scroll contract:
      //   rc3 (shared viewport): original capture-phase hijack — the host
      //     handler would double-scroll, so the event is fully consumed.
      //   rc5 (hand-off): LITE driver — absorb list-capable steps only,
      //     pass boundary steps through untouched so the host hand-off
      //     keeps its gesture state and drives the viewport/workspace.
      //   legacy/null: no driver — native scrolling everywhere.
      const htmlEl = document.documentElement
      if (htmlEl && htmlEl.classList.contains(RC3_CLASS)) {
        try {
          installNavWheelScroll(nav)
        } catch (error) {
          /* wheel drive stays unavailable; everything else unaffected */
        }
      } else if (htmlEl && htmlEl.classList.contains(RC5_CLASS)) {
        try {
          installNavWheelLite(nav)
        } catch (error) {
          /* lite driver stays unavailable; native hand-off remains */
        }
      }
      let launcher = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      if (!launcher) {
        launcher = document.createElement('button')
        launcher.type = 'button'
        launcher.setAttribute(LAUNCHER_ATTR, '')
        launcher.className = 'dpp-launcher'
        launcher.setAttribute('aria-haspopup', 'menu')
        launcher.setAttribute('aria-label', LABEL.panelsMenu)
        const glyph = document.createElement('span')
        glyph.className = 'dpp-icon'
        glyph.setAttribute('aria-hidden', 'true')
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '18')
        svg.setAttribute('height', '18')
        svg.setAttribute('viewBox', '0 0 20 20')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '1.4')
        svg.setAttribute('stroke-linejoin', 'round')
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', ICON_GRID)
        svg.appendChild(path)
        glyph.appendChild(svg)
        launcher.appendChild(glyph)
        const text = document.createElement('span')
        text.className = 'dpp-launcher-label'
        text.textContent = LABEL.panels
        launcher.appendChild(text)
        const badge = document.createElement('span')
        badge.className = 'dpp-launcher-badge'
        launcher.appendChild(badge)
        launcher.addEventListener('click', function (event) {
          event.stopPropagation()
          if (overlay) closeOverlay()
          else openOverlay(launcher)
        })
        nav.appendChild(launcher)
      }
      // Keep the badge in sync with the live row count and the rail mode.
      // The badge advertises EVERYTHING the menu holds — the merged panel
      // inventory (pinned + unpinned) AND collected plugin entry rows — so
      // nothing is silently "lost". Whitelisted entries stay in the sidebar
      // and don't count.
      // CRITICAL: only write when the value actually changed. The refresh
      // pass is driven by a MutationObserver — an unconditional textContent
      // write here would mutate the DOM every pass and feed back into the
      // observer, looping forever at the debounce rate.
      const allPanels = readPanelList().filter(function (entry) {
        // b63: mirror the menu's filter exactly (openOverlay 2796-2799) —
        // user-hidden rows must not be advertised by the badge either, or
        // the badge shows N while the menu shows N-3 and users read it as
        // "lost panels". Backfill guards inside readPanelList are not
        // enough: a hidden row's stored label may differ slightly from the
        // backfilled entry label, so filter here by the same rule.
        if (isRowHidden(entry.label)) return false
        return !isWhitelisted(entry.label, entry.idKnown ? entry.id : undefined)
      })
      const famCount = findFamilyRows().concat(findFooterRows()).filter(function (row) {
        if (isRowHidden(rowLabel(row))) return false // b61: hidden rows don't count
        return !isWhitelistedLabelOrMapped(rowLabel(row))
      }).length
      const badge = launcher.querySelector('.dpp-launcher-badge')
      const total = allPanels.length + famCount
      const badgeText = total > 0 ? String(total) : ''
      const rail = nav.getBoundingClientRect().width < 120
      const sig = badgeText + '|' + String(rail)
      if (launcher.__dppBadgeSig !== sig) {
        launcher.__dppBadgeSig = sig
        if (badge) badge.textContent = badgeText
        if (badge) {
          badge.setAttribute(
            'aria-label',
            LABEL.panels + ' ' + allPanels.length + ' · ' + LABEL.groupFamily + ' ' + famCount,
          )
        }
        launcher.classList.toggle('dpp-rail', rail)
      }
      return launcher
    }

    // ---------------------------------------------------------------- menu rows

    // -------------------------------------------------------------------
    // v1.8.0 (P1-5): collapsed-sidebar toggle badge. Counts what the plugin
    // has folded OUT of the visible sidebar while it is collapsed — the
    // collected panel rows (rows-hidden) plus the collected plugin-entry
    // rows (family). 0 renders nothing, so hosts/users with everything
    // visible see no badge at all. The count is cheap to recompute and the
    // store keys are plain localStorage, so a short poll catches every
    // mutation path (menu toggles, presets, imports) without subscribing to
    // each one.
    // -------------------------------------------------------------------
    const BADGE_SLOT = 'sidebar.toggle.badge'

    function foldedBadgeCount() {
      let n = 0
      try {
        if (readRowsHidden()) n += readPanelList().length
      } catch (error) {
        /* sidebar not ready */
      }
      try {
        if (readFamily()) n += findFamilyRows().length
      } catch (error) {
        /* sidebar not ready */
      }
      return n
    }

    function ToggleBadgeRows() {
      const [count, setCount] = React.useState(function () { return foldedBadgeCount() })
      React.useEffect(function () {
        const timer = setInterval(function () {
          try {
            const next = foldedBadgeCount()
            setCount(function (prev) { return prev === next ? prev : next })
          } catch (error) {
            /* ignore */
          }
        }, 1500)
        return function () { clearInterval(timer) }
      }, [])
      if (!count) return null
      const title = LABEL.badgeTitle.replace('N', String(count))
      return h('span', { className: 'dpp-badge', title: title, 'aria-label': title }, String(count))
    }

    function PinMenuRows({ entries, onOpen, onPinnedChange, onDismiss }) {
      const [hidden, setHidden] = React.useState(readRowsHidden())
      // v1.7: with the host's native pin controls present we hide our own
      // per-entry pin rows (the host owns the interaction; we persist).
      const [nativePin, setNativePin] = React.useState(nativePinSeen)

      React.useEffect(function () {
        bridge.entries = Array.isArray(entries) ? entries : []
        bridge.onPinnedChange = onPinnedChange
        try {
          // Seed the persisted label→id map so the Settings pin manager works
          // even before this slot (the More menu) renders on a fresh session.
          if (Array.isArray(entries) && entries.length > 0) {
            mergeLabelIdMap(
              entries.map(function (entry) {
                return { id: entry && entry.id, label: entry && entry.label }
              }),
            )
          }
        } catch (error) {
          /* ignore */
        }
        // v1.7: probe for the host's native pin controls and pick the sync
        // mode. The probe re-runs on every mount of this slot, so a renderer
        // that was too slow on boot gets caught on the next menu open.
        if (!nativePinSeen && probeNativePinControls()) {
          nativePinSeen = true
          setNativePin(true)
        }
        if (nativePinSeen) {
          if (!mirrorArmed) {
            mirrorAdoptAndRestore(entries, onPinnedChange)
            mirrorArmed = true
          } else {
            mirrorFromHost(entries)
          }
        } else {
          syncIntoHost(entries, onPinnedChange)
        }
        // Late probe: sidebar rows may render after this effect on a cold
        // boot. One delayed re-check, then the next mount takes over anyway.
        if (!nativePinSeen) {
          window.setTimeout(function () {
            if (nativePinSeen) return
            try {
              if (probeNativePinControls()) {
                nativePinSeen = true
                setNativePin(true)
                if (
                  !mirrorArmed &&
                  typeof bridge.onPinnedChange === 'function' &&
                  Array.isArray(bridge.entries) &&
                  bridge.entries.length > 0
                ) {
                  mirrorAdoptAndRestore(bridge.entries, bridge.onPinnedChange)
                  mirrorArmed = true
                }
              }
            } catch (error) {
              /* cosmetic */
            }
          }, 300)
        }
      }, [entries, onPinnedChange])

      const toggleFold = function () {
        const next = !readRowsHidden()
        writeRowsHidden(next)
        applyFold()
        ensureLauncher()
        setHidden(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const [tidy, setTidy] = React.useState(readTidy())
      const toggleTidy = function () {
        const next = !readTidy()
        writeTidy(next)
        applyTidy()
        setTidy(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const [family, setFamily] = React.useState(readFamily())
      const toggleFamily = function () {
        const next = !readFamily()
        writeFamily(next)
        applyFamily()
        setFamily(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const list = Array.isArray(entries) ? entries : []
      const rows = list.filter(function (entry) {
        return entry && entry.id !== 'plugins'
      })

      return h(
        React.Fragment,
        null,
        h(
          MenuRow,
          {
            key: '__fold__',
            icon: h(SvgIcon, { d: hidden ? ICON_CHEVRON_DOWN : ICON_CHEVRON_UP }),
            label: hidden ? LABEL.unfold : LABEL.fold,
            onSelect: toggleFold,
          },
        ),
        h(
          MenuRow,
          {
            key: '__tidy__',
            icon: h(SvgIcon, { d: ICON_COMPACT }),
            label: tidy ? LABEL.tidyOn : LABEL.tidyOff,
            detail: tidy ? 'ON' : 'OFF',
            onSelect: toggleTidy,
          },
        ),
        h(
          MenuRow,
          {
            key: '__family__',
            icon: h(SvgIcon, { d: ICON_STACK }),
            label: family ? LABEL.familyOff : LABEL.familyOn,
            detail: family ? 'ON' : 'OFF',
            onSelect: toggleFamily,
          },
        ),
        // v1.7: with the host's native pin controls on the sidebar rows (and
        // its own pin action in this very menu), our per-entry pin rows were a
        // second, conflicting control surface — hide them and let the mirror
        // own persistence. Fold/tidy/family rows are unrelated features and
        // stay. On hosts without native controls this renders unchanged.
        !nativePin &&
        rows.map(function (entry) {
          const pinned = entry.pinned !== false
          return h(MenuRow, {
            key: entry.id,
            icon: h(SvgIcon, { d: pinned ? ICON_PIN : ICON_PIN_ALT }),
            label: pinned ? LABEL.unpin : LABEL.pin,
            detail: entry.label,
            onSelect: function () {
              const unpinned = readUnpinned()
              if (pinned) unpinned.add(entry.id)
              else unpinned.delete(entry.id)
              writeUnpinned(unpinned)
              try {
                if (typeof onDismiss === 'function') onDismiss()
              } catch (error) {
                /* ignore */
              }
              try {
                onPinnedChange(entry.id, !pinned)
              } catch (error) {
                /* ignore */
              }
            },
          })
        }),
      )
    }

    /**
     * One menu row. Markup mirrors the host's MenuItemButton (icon column +
     * label + trailing detail) and its hover/selected treatment comes from the
     * injected stylesheet, so it stays theme-aware without any primitive import.
     */
    function MenuRow({ icon, label, detail, onSelect }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dpp-row',
          onClick: onSelect,
        },
        icon,
        h('span', { className: 'dpp-label' }, label),
        detail ? h('span', { className: 'dpp-detail' }, detail) : null,
      )
    }

    // ------------------------------------------------------------ settings page

    /**
     * Top-pin ordering. The host panel list is a flex column, so a negative
     * CSS `order` lifts a row to the top WITHOUT touching DOM structure —
     * React re-renders don't fight it, and the interval replay re-asserts it
     * after the host replaces nodes. Stored pins are panel ids (same universe
     * as the pin store); sidebar rows are matched by label through the
     * persisted label→id map. The two launchers (ours, host More) get fixed
     * orders so top-pinned rows slot between the launcher and the rest.
     */
    const ORDER_LAUNCHER = '-30000'
    /**
     * Apply top-pin ordering to one panel-list nav; returns {stored, matched}.
     * Matching needs no map indirection in the common case (the stored label
     * IS the row's aria-label — captured at toggle time from the same source).
     */
    function applyTopPinsToNav(nav) {
      const map = readLabelIdMap()
      const topPins = readTopPins()
      let matched = 0
      // Our launcher always stays first (visual anchor; never jumps).
      const launcher = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      if (launcher && launcher.style.order !== ORDER_LAUNCHER) launcher.style.order = ORDER_LAUNCHER
      // b75: sweep row UNITS (rc.3 wrapper divs, legacy row buttons). The
      // host More anchor is skipped inside forEachRowUnit; pre-rc.3 hosts
      // keep the More button outside the nav entirely.
      forEachRowUnit(nav, function (unit, btn, label) {
        const idx = label ? topPinIndexFor(label, map, topPins) : -1
        if (idx !== -1) {
          matched++
          if (unit.getAttribute('data-dpp-top') !== '1') unit.setAttribute('data-dpp-top', '1')
          // -20000, -19999, …: stored order wins among top-pinned rows.
          const want = String(-(20000 - idx))
          if (unit.style.order !== want) unit.style.order = want
        } else if (unit.getAttribute('data-dpp-top') === '1') {
          unit.removeAttribute('data-dpp-top')
          unit.style.removeProperty('order')
        }
      })
      return { stored: topPins.length, matched: matched }
    }
    function applyTopPins() {
      if (typeof document === 'undefined') return
      let nav = null
      try {
        nav = findPanelListNav()
      } catch (error) {
        return
      }
      if (!nav) return
      applyTopPinsToNav(nav)
    }

    // ---------------------------------------------------- row drag reorder
    // v1.2.2: HTML5 drag-and-drop on the sidebar panel rows themselves —
    // the one capability every competing panel manager ships and we deferred
    // since v1.2.0. Document-level delegation (rows are host-rendered React
    // nodes; we never attach per-row listeners that re-render would orphan).
    // Drop writes ROW_ORDER_KEY; applyRowOrderToNav turns it into CSS order.
    const DROP_LINE_ID = 'dsh-panel-pins-drop-line'

    function ensureDropLine() {
      let line = document.getElementById(DROP_LINE_ID)
      if (!line) {
        line = document.createElement('div')
        line.id = DROP_LINE_ID
        line.style.cssText =
          'position:fixed;height:2px;left:0;right:0;z-index:2147483000;pointer-events:none;' +
          'background:var(--dsw-alias-brand-primary,#4d6bfe);border-radius:1px;display:none;'
        document.body.appendChild(line)
      }
      return line
    }

    function showDropLine(nav, row, before) {
      try {
        const line = ensureDropLine()
        const r = row.getBoundingClientRect()
        if (!r || (!r.height && !r.top)) return
        const nr = nav.getBoundingClientRect()
        line.style.display = 'block'
        line.style.left = nr.left + 'px'
        line.style.width = nr.width + 'px'
        line.style.top = (before ? r.top : r.bottom) + 'px'
      } catch (error) {
        /* layout not ready */
      }
    }

    function hideDropLine() {
      try {
        const line = document.getElementById(DROP_LINE_ID)
        if (line) line.style.display = 'none'
      } catch (error) {
        /* ignore */
      }
    }

    /**
     * v1.8.0: shared drop commit for BOTH input paths — the mouse's HTML5
     * DnD (drop handler below) and the touch/pen long-press drag. dst is the
     * target row unit; dropping on the upper half inserts before, the lower
     * half after (mirrors dsh-panel-layout).
     */
    function commitRowDrop(src, dst, before) {
      if (!src || !dst || src === dst) return
      const srcLabel = rowLabel(src).trim()
      const dstLabel = rowLabel(dst).trim()
      if (!srcLabel || !dstLabel) return
      // Row order semantics follow the row-order array (known labels first).
      const order = readRowOrder()
      let idx = order.indexOf(dstLabel)
      if (idx === -1) {
        // Unordered target: build the array from current DOM order so the
        // first drag does not jump rows to arbitrary positions.
        const nav = findPanelListNav()
        const domLabels = []
        forEachRowUnit(nav, function (unit, btn, label) {
          if (label) domLabels.push(label)
        })
        const di = domLabels.indexOf(dstLabel)
        order.length = 0
        Array.prototype.push.apply(order, domLabels)
        idx = di
        if (!before) idx += 1
        const si = order.indexOf(srcLabel)
        if (si !== -1) order.splice(si, 1)
        if (idx > si) idx -= 1
        order.splice(Math.max(0, Math.min(idx, order.length)), 0, srcLabel)
        writeRowOrder(order)
      } else {
        if (!before) idx += 1
        moveRowInOrder(srcLabel, idx)
      }
      applyRowOrder()
      refreshAll()
    }

    function panelRowFromEventTarget(target) {
      // Walk up from the event target to the nav-row BUTTON (drag images and
      // text selection can make the target a child node).
      let el = target
      while (el && el.tagName !== 'BUTTON') el = el.parentNode
      if (!el || !el.getAttribute) return null
      // b74: the host More button is not a panel row — never a drag source
      // or drop target (b73 marked it draggable via the refresh sweep).
      if (el.getAttribute('aria-haspopup') === 'menu') return null
      if (!isRowButton(el)) return null
      const nav = findPanelListNav()
      if (!nav) return null
      // b75: rc.3 wraps row buttons in DIV._panelEntry flex children — the
      // drag identity is the UNIT (flex child); the label lives on the button.
      return rowUnitOf(nav, el)
    }

    function applyRowOrderToNav(nav) {
      const map = readLabelIdMap()
      const order = readRowOrder()
      // NOTE: no early return when `order` is empty — that would leak the
      // previous inline order/marker on every nav row after the user clears
      // the store. Empty array must still sweep the cleanup branch below.
      forEachRowUnit(nav, function (unit, btn, label) {
        // b73: HTML5 DnD needs draggable=true BEFORE the gesture starts —
        // mark the row BUTTON proactively during refresh (the drag source).
        if (!btn.draggable) btn.setAttribute('draggable', 'true')
        // b74: top pins stay authoritative. applyTopPinsToNav ran earlier in
        // this refresh pass and set -20000..; the b73 code fell through and
        // overwrote that with the -15000 band, visibly demoting top-pinned
        // rows under non-pinned ones (the 1.2.2 "rows shuffled" regression).
        // Skip: keep the top-pin order untouched. The row may still carry a
        // row-order entry for the day its top pin is removed.
        if (unit.getAttribute('data-dpp-top') === '1') return
        const idx = label ? order.indexOf(label) : -1
        if (idx !== -1) {
          // -15000.. : above host default order (0), below top pins
          // (-20000..). Rows that are BOTH top-pinned and user-ordered keep
          // the top-pin placement (handled by the skip above).
          const want = String(-(15000 - idx))
          if (unit.style.order !== want) unit.style.order = want
          if (unit.getAttribute('data-dpp-roworder') !== '1') unit.setAttribute('data-dpp-roworder', '1')
        } else if (unit.getAttribute('data-dpp-roworder') === '1') {
          unit.removeAttribute('data-dpp-roworder')
          unit.style.removeProperty('order')
        }
      })
    }

    function applyRowOrder() {
      if (typeof document === 'undefined') return
      let nav = null
      try {
        nav = findPanelListNav()
      } catch (error) {
        return
      }
      if (!nav) return
      applyRowOrderToNav(nav)
    }

    function installRowDrag() {
      if (typeof document === 'undefined') return
      if (document.__dppRowDragInstalled) return
      document.__dppRowDragInstalled = true

      // HTML5 DnD only fires dragstart on elements already marked
      // draggable=true at the time the gesture starts. Host rows are plain
      // React buttons without the attribute, so setting it inside dragstart
      // (the b72 approach) was always too late — the gesture never began.
      // Fix (b73): proactively mark rows during refresh, plus a pointerdown
      // belt-and-suspenders pass right before a potential gesture.
      const markDraggable = function (row) {
        // b75: mark the row BUTTON (the drag source); in rc.3 the row is a
        // wrapper unit and the button lives one level down.
        const btn = row && row.tagName === 'BUTTON' ? row : rowBtnOf(row)
        if (btn && btn.getAttribute('aria-haspopup') !== 'menu' && !btn.draggable) {
          btn.setAttribute('draggable', 'true')
        }
      }

      document.addEventListener('dragstart', function (event) {
        try {
          const row = panelRowFromEventTarget(event.target)
          if (!row) return
          row.setAttribute('data-dpp-dragging', '1')
          try {
            event.dataTransfer.setData('text/plain', rowLabel(row) || '')
            event.dataTransfer.effectAllowed = 'move'
          } catch (error) {
            /* dataTransfer unavailable in some synthetic events */
          }
        } catch (error) {
          /* ignore */
        }
      }, true)

      document.addEventListener('pointerdown', function (event) {
        // User intent signal: a press on a panel row. Marking here guarantees
        // draggable is set before the browser's drag-threshold fires, even on
        // the very first drag after a host re-render (refreshAll pass may not
        // have run yet for a freshly mounted row).
        try {
          const row = panelRowFromEventTarget(event.target)
          if (row) markDraggable(row)
        } catch (error) {
          /* ignore */
        }
      }, true)

      document.addEventListener('dragover', function (event) {
        try {
          if (!readRowOrder().length && !document.querySelector('[data-dpp-dragging="1"]')) return
          const row = panelRowFromEventTarget(event.target)
          if (!row) {
            hideDropLine()
            return
          }
          event.preventDefault()
          const r = row.getBoundingClientRect()
          const before = (event.clientY - r.top) < r.height / 2
          showDropLine(findPanelListNav(), row, before)
          row.__dppDropBefore = before
          row.__dppDropTarget = true
        } catch (error) {
          /* ignore */
        }
      }, true)

    document.addEventListener('drop', function (event) {
      try {
        const src = document.querySelector('[data-dpp-dragging="1"]')
        hideDropLine()
        if (!src) return
        const row = panelRowFromEventTarget(event.target)
        if (row && row !== src) {
          event.preventDefault()
          commitRowDrop(src, row, row.__dppDropBefore !== false)
        }
      } catch (error) {
        /* ignore */
      }
    }, true)

      document.addEventListener('dragend', function () {
        try {
          const src = document.querySelector('[data-dpp-dragging="1"]')
          if (src) src.removeAttribute('data-dpp-dragging')
          hideDropLine()
        } catch (error) {
          /* ignore */
        }
      }, true)
    }

    // -------------------------------------------------------------------
    // v1.8.0 (P1-2): touch/pen LONG-PRESS drag. The mouse keeps the native
    // HTML5 DnD path above (identical feel, zero regression); touch never
    // fires DnD, so rows were previously immovable on phones/tablets.
    //
    // Gesture (mirrors dsh-panel-tidy's long-press model):
    //   press a row -> 500ms hold ARMS it (haptic tick where available);
    //   moving >8px while armed engages the drag (blue insertion line, live,
    //   page scroll suppressed via preventDefault on touchmove);
    //   releasing armed-but-not-moved opens the SAME row context menu a
    //   mouse right-click opens (a synthetic contextmenu on the row button);
    //   moving >10px BEFORE the timer cancels everything — the sidebar
    //   scroll wins, exactly like a plain swipe.
    // Native long-press contextmenus (and the tap-click after a long press)
    // are suppressed while one of our gestures is armed, so the menu opens
    // exactly once.
    // -------------------------------------------------------------------
    const TOUCH_HOLD_MS = 500
    const TOUCH_CANCEL_PX = 10
    const TOUCH_DRAG_PX = 8
    let touchGesture = null
    let touchSuppressClickUntil = 0

    function endTouchGesture() {
      if (!touchGesture) return
      try {
        if (touchGesture.timer) clearTimeout(touchGesture.timer)
      } catch (error) {
        /* ignore */
      }
      try {
        if (touchGesture.dragging && touchGesture.src.getAttribute('data-dpp-dragging') === '1') {
          touchGesture.src.removeAttribute('data-dpp-dragging')
        }
      } catch (error) {
        /* ignore */
      }
      hideDropLine()
      try {
        window.removeEventListener('touchmove', onTouchMove, { passive: false })
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
        window.removeEventListener('touchcancel', onTouchCancel)
      } catch (error) {
        /* ignore */
      }
      touchGesture = null
    }

    function updateTouchDragPoint(x, y) {
      const el = document.elementFromPoint(x, y)
      const row = panelRowFromEventTarget(el)
      if (!row || row === touchGesture.src) {
        hideDropLine()
        return
      }
      const r = row.getBoundingClientRect()
      const before = (y - r.top) < r.height / 2
      showDropLine(findPanelListNav(), row, before)
      row.__dppDropTarget = true
      touchGesture.dst = row
      touchGesture.dstBefore = before
    }

    function onTouchStart(event) {
      try {
        if (touchGesture) endTouchGesture()
        if (!event.touches || event.touches.length !== 1) return
        const src = panelRowFromEventTarget(event.target)
        if (!src) return
        const t = event.touches[0]
        touchGesture = {
          src: src,
          startX: t.clientX,
          startY: t.clientY,
          armed: false,
          dragging: false,
          dst: null,
          dstBefore: false,
          timer: setTimeout(function () {
            if (!touchGesture) return
            touchGesture.armed = true
            try {
              if (navigator.vibrate) navigator.vibrate(30)
            } catch (error) {
              /* no haptics */
            }
          }, TOUCH_HOLD_MS),
        }
        // Non-passive listeners live on the window ONLY while a gesture is
        // running (removed in endTouchGesture) — normal scrolling elsewhere
        // keeps its compositor fast path.
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', onTouchEnd, { passive: false })
        window.addEventListener('touchcancel', onTouchCancel, { passive: false })
      } catch (error) {
        touchGesture = null
      }
    }

    function onTouchMove(event) {
      try {
        if (!touchGesture) return
        const t = event.touches && event.touches[0]
        if (!t) return
        const dx = t.clientX - touchGesture.startX
        const dy = t.clientY - touchGesture.startY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (!touchGesture.armed) {
          // Not armed yet: a real swipe cancels the pending hold — the
          // sidebar scroll wins untouched.
          if (dist > TOUCH_CANCEL_PX) endTouchGesture()
          return
        }
        // Armed: the gesture is ours — stop the page from scrolling.
        event.preventDefault()
        if (!touchGesture.dragging) {
          if (dist < TOUCH_DRAG_PX) return
          touchGesture.dragging = true
          touchGesture.src.setAttribute('data-dpp-dragging', '1')
        }
        updateTouchDragPoint(t.clientX, t.clientY)
      } catch (error) {
        /* ignore */
      }
    }

    function onTouchEnd(event) {
      try {
        if (!touchGesture) return
        const t = event.changedTouches && event.changedTouches[0]
        if (touchGesture.dragging) {
          const dst = touchGesture.dst
          const before = touchGesture.dstBefore
          const src = touchGesture.src
          endTouchGesture()
          if (dst) commitRowDrop(src, dst, before)
          return
        }
        if (touchGesture.armed) {
          // Long-press without moving: the same menu a mouse right-click
          // opens. Dispatched AFTER the gesture is torn down so the global
          // contextmenu handler processes it normally.
          const btn = rowBtnOf(touchGesture.src) || touchGesture.src
          const r = btn.getBoundingClientRect()
          const cx = t ? t.clientX : r.left + r.width / 2
          const cy = t ? t.clientY : r.top + r.height / 2
          endTouchGesture()
          touchSuppressClickUntil = Date.now() + 400
          const ev = new window.MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
          })
          btn.dispatchEvent(ev)
          return
        }
        endTouchGesture()
      } catch (error) {
        endTouchGesture()
      }
    }

    function onTouchCancel() {
      endTouchGesture()
    }

    // Native long-press contextmenus must not stack with our synthetic one.
    document.addEventListener('contextmenu', function (event) {
      try {
        if (touchGesture && touchGesture.armed) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      } catch (error) {
        /* ignore */
      }
    }, true)

    // A long-press release must not ALSO click the row open.
    document.addEventListener('click', function (event) {
      try {
        if (Date.now() < touchSuppressClickUntil) {
          touchSuppressClickUntil = 0
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      } catch (error) {
        /* ignore */
      }
    }, true)

    document.addEventListener('touchstart', onTouchStart, { passive: true })

    /** Host-style switch, pure CSS (`.dpp-set-switch`), no primitives import. */
    function SettingsSwitch({ on, onToggle, label }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': !!on,
        'aria-label': label,
        className: 'dpp-set-switch',
        'data-on': on ? 'true' : 'false',
        onClick: onToggle,
      })
    }

    /** One "label + range slider + value" row; onChange fires per input event. */
    function SettingsSliderRow({ label, value, min, max, onChange, unit }) {
      return h(
        'div',
        { className: 'dpp-set-row' },
        h('span', { className: 'dpp-set-label' }, label),
        h('input', {
          type: 'range',
          min: min,
          max: max,
          step: 1,
          value: value,
          'aria-label': label,
          onInput: function (event) {
            const n = Number(event.target.value)
            if (Number.isFinite(n)) onChange(n)
          },
        }),
        h('span', { className: 'dpp-set-val' }, value + (unit || '')),
      )
    }

    /**
     * The Settings page section body. Registered into `settings.section`
     * (same contract as the official ui-settings-* packages): the host shows
     * it as its own column in the Settings navigation. Every control writes
     * straight to localStorage and re-applies live.
     */
    function PanelPinsSettingsSection() {
      const [rowsHid, setRowsHid] = React.useState(readRowsHidden())
      const [family, setFamily] = React.useState(readFamily())
      const [iconOnly, setIconOnly] = React.useState(readIconOnly())
      const [tidy, setTidy] = React.useState(readTidy())
      const [tidyQr, setTidyQr] = React.useState(readTidyQr())
      const [tidyBrand, setTidyBrand] = React.useState(readTidyBrand())
      const [tidyMeter, setTidyMeter] = React.useState(readTidyMeter())
      const [panelMax, setPanelMax] = React.useState(readPanelMax())
      const [footMax, setFootMax] = React.useState(readFootMax())
      const [overlayMax, setOverlayMax] = React.useState(readOverlayMax())
      const [qrSize, setQrSize] = React.useState(readQrSize())
      const [whitelist, setWhitelist] = React.useState(readWhitelist())
      const [available] = React.useState(readAvailableEntries())
      const [panelList, setPanelList] = React.useState(readPanelList())
      // v1.0.0: layout presets + custom panel groups (own cards below).
      const [presets, setPresets] = React.useState(function () {
        try {
          return readPresets()
        } catch (error) {
          return {}
        }
      })
      const [cgroups, setCgroups] = React.useState(function () {
        try {
          return readCustomGroups()
        } catch (error) {
          return {}
        }
      })
      // v1.1.0: user-hidden rows (restore list) + display renames (reset list).
      const [hiddenRows, setHiddenRows] = React.useState(function () {
        try {
          return readHiddenRows()
        } catch (error) {
          return []
        }
      })
      const [renames, setRenames] = React.useState(function () {
        try {
          return readRenames()
        } catch (error) {
          return {}
        }
      })
      // v1.2.2: custom row order — the card shows itself only while non-empty.
      const [rowOrder, setRowOrder] = React.useState(function () {
        try {
          return readRowOrder()
        } catch (error) {
          return []
        }
      })
      // v1.4.0: settings-page bridge toggle.
      const [bridgeOn, setBridgeOn] = React.useState(readBridge())
      // v1.6.0: follow a host language change while this section stays open.
      // The section's own copy lives in the plugin's LABEL table, which
      // refreshLocale() rebuilds in place; this state bump is what makes
      // React re-render the section against the new labels.
      const [, setLocaleRev] = React.useState(0)
      React.useEffect(function () {
        return onLocaleChange(function () {
          setLocaleRev(function (rev) {
            return rev + 1
          })
        })
      }, [])
      // b67: these two cards used to snapshot localStorage ONCE at mount and
      // never hear about writes made elsewhere (ctx menu hide/rename, overlay
      // restore) — the "card says empty but the store has data" bug. The DOM
      // `storage` event does not fire in the writing document, so writers
      // dispatch 'dpp:store-changed' instead (see notifyStoreChange).
      React.useEffect(function () {
        const handler = function (event) {
          try {
            const key = event && event.detail && event.detail.key
            if (key === 'hidden') setHiddenRows(readHiddenRows())
            else if (key === 'renames') setRenames(readRenames())
            else if (key === 'row-order') setRowOrder(readRowOrder())
          } catch (error) {
            /* React guard */
          }
        }
        window.addEventListener('dpp:store-changed', handler)
        return function () { window.removeEventListener('dpp:store-changed', handler) }
      }, [])
      // Self-diagnosis for top pins: how many stored pins matched sidebar rows.
      let topStats = { stored: 0, matched: 0 }
      try {
        const topNav = findPanelListNav()
        if (topNav) topStats = applyTopPinsToNav(topNav)
      } catch (error) {
        /* sidebar not ready */
      }

      function refreshAfterWhitelist() {
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        ensureLauncher()
      }
      function toggleRows() {
        const next = !readRowsHidden()
        writeRowsHidden(next)
        applyFold()
        ensureLauncher()
        setRowsHid(next)
      }
      function toggleFamily() {
        const next = !readFamily()
        writeFamily(next)
        applyFamily()
        ensureLauncher()
        setFamily(next)
      }
      function toggleTidy() {
        const next = !readTidy()
        writeTidy(next)
        applyTidy()
        setTidy(next)
      }
      // v1.4.0: bridge toggle — retracts or rebuilds every bridged page on
      // flip; the overlay group follows the same store on its next open.
      function toggleBridge() {
        const next = !readBridge()
        writeBridge(next)
        syncBridgeSettings()
        setBridgeOn(next)
      }
      function toggleIconOnly() {
        const next = !readIconOnly()
        writeFlag(ICONONLY_KEY, next)
        applyIconOnly()
        setIconOnly(next)
      }
      function toggleTidyQr() {
        const next = !readTidyQr()
        writeFlag(TIDY_QR_KEY, next)
        applyTidy()
        setTidyQr(next)
      }
      function toggleTidyBrand() {
        const next = !readTidyBrand()
        writeFlag(TIDY_BRAND_KEY, next)
        applyTidy()
        setTidyBrand(next)
      }
      function toggleTidyMeter() {
        const next = !readTidyMeter()
        writeFlag(TIDY_METER_KEY, next)
        applyTidy()
        setTidyMeter(next)
      }
      function changePanelMax(v) {
        writePanelMax(v)
        applyConfig()
        setPanelMax(v)
      }
      function changeFootMax(v) {
        writeFootMax(v)
        applyConfig()
        setFootMax(v)
      }
      function changeOverlayMax(v) {
        writeOverlayMax(v)
        applyConfig()
        setOverlayMax(v)
      }
      function changeQrSize(v) {
        writeQrSize(v)
        applyConfig()
        setQrSize(v)
      }
      function toggleWhitelistEntry(label, id) {
        // Store the ID when known (stable across UI-language switches); fall
        // back to the label for entries with no resolvable id yet. Toggling
        // removes ANY matching entry (id, label, or legacy label now mapped
        // to this id) so duplicates never accumulate across locale switches.
        const list = readWhitelist()
        const l = String(label || '').toLowerCase()
        const key = id || null
        const idx = list.findIndex(function (n) {
          if (key && n === key) return true
          if (l && n.toLowerCase() === l) return true
          if (key) {
            const mapped = readLabelIdMap()[n]
            if (mapped && mapped === key) return true
          }
          return false
        })
        if (idx >= 0) list.splice(idx, 1)
        else list.push(key || label)
        writeWhitelist(list)
        setWhitelist(readWhitelist())
        refreshAfterWhitelist()
      }
      function togglePin(id, currentlyPinned) {
        const unpinned = readUnpinned()
        if (currentlyPinned) unpinned.add(id)
        else unpinned.delete(id)
        writeUnpinned(unpinned)
        try {
          if (typeof bridge.onPinnedChange === 'function') bridge.onPinnedChange(id, !currentlyPinned)
        } catch (error) {
          /* host callback absent: the store still holds the state */
        }
        setPanelList(readPanelList())
      }

      // ------- v1.0.0 layout presets (settings-page card) -------
      function savePresetFromInput() {
        try {
          const input = document.getElementById('dpp-preset-name')
          const n = input ? String(input.value || '').trim() : ''
          if (!n) {
            showToast(LABEL.presetNameRequired)
            return
          }
          if (savePreset(n)) {
            if (input) input.value = ''
            setPresets(readPresets())
            showToast(LABEL.presetSavedAs.replace('NAME', n))
          }
        } catch (error) {
          /* React guard */
        }
      }
      function applyPresetFromCard(name) {
        try {
          if (applyPreset(name)) {
            setPresets(readPresets())
            showToast(LABEL.presetApplied.replace('NAME', name))
          }
        } catch (error) {
          /* React guard */
        }
      }
      function deletePresetFromCard(name) {
        try {
          if (deletePreset(name)) {
            setPresets(readPresets())
            showToast(LABEL.presetDeleted.replace('NAME', name))
          }
        } catch (error) {
          /* React guard */
        }
      }

      // ------- v1.0.0 custom panel groups (settings-page card) -------
      function addGroupFromInput() {
        try {
          const input = document.getElementById('dpp-cg-name')
          const n = input ? String(input.value || '').trim() : ''
          if (!n) {
            showToast(LABEL.presetNameRequired)
            return
          }
          const groups = readCustomGroups()
          const gid = 'cg-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36)
          groups[gid] = { name: n, labels: [] }
          writeCustomGroups(groups)
          if (input) input.value = ''
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      /**
       * Inline rename (v1.0.0 b39): window.prompt is not available in the
       * Electron renderer ("prompt() is and will not be supported"), so the
       * group title swaps to a text input in place; Enter commits, blur or
       * Escape cancels. Renaming state is tracked per group id.
       */
      const [renamingGid, setRenamingGid] = React.useState('')
      function renameGroup(gid) {
        setRenamingGid(gid)
      }
      function commitRename(gid, value) {
        const n = String(value || '').trim()
        setRenamingGid('')
        if (!n) return
        try {
          const groups = readCustomGroups()
          if (!groups[gid]) return
          groups[gid].name = n
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      function deleteGroup(gid) {
        try {
          const groups = readCustomGroups()
          if (!groups[gid]) return
          delete groups[gid]
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgDeleted)
        } catch (error) {
          /* React guard */
        }
      }
      function addPanelToGroup(gid, label) {
        try {
          if (!label) return
          const groups = readCustomGroups()
          if (!groups[gid] || !Array.isArray(groups[gid].labels)) return
          if (groups[gid].labels.indexOf(label) !== -1) return
          groups[gid].labels.push(label)
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      function removePanelFromGroup(gid, label) {
        try {
          const groups = readCustomGroups()
          if (!groups[gid] || !Array.isArray(groups[gid].labels)) return
          const idx = groups[gid].labels.indexOf(label)
          if (idx === -1) return
          groups[gid].labels.splice(idx, 1)
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      /** Panels not yet claimed by ANY group — the add-panel dropdown source. */
      function ungroupedPanels() {
        try {
          const assigned = customGroupedLabels()
          return readPanelList().filter(function (p) {
            return !assigned[p.label]
          })
        } catch (error) {
          return []
        }
      }
      function toggleTopPin(id, label) {
        toggleTopPinStore(id, label)
        applyTopPins()
        setPanelList(readPanelList())
      }
      function reorderTopPins(srcId, dstId) {
        // Reorder TOP_KEY so srcId takes dstId's slot: remove src, insert
        // before dst. Then re-apply the CSS order replay. Both ids must be
        // top-pinned; anything else is a no-op.
        const list = readTopPins()
        const srcIdx = list.findIndex(function (e) {
          return e.id === srcId
        })
        const dstIdx = list.findIndex(function (e) {
          return e.id === dstId
        })
        if (srcIdx < 0 || dstIdx < 0) return
        const moved = list.splice(srcIdx, 1)[0]
        const newDstIdx = list.findIndex(function (e) {
          return e.id === dstId
        })
        list.splice(newDstIdx, 0, moved)
        writeTopPins(list)
        applyTopPins()
        setPanelList(readPanelList())
      }
      function reset() {
        // Layout reset only: toggles + sliders back to defaults. Pin and
        // whitelist DATA is deliberately kept — clearing it silently destroyed
        // the user's pin list, which read like a bug ("reset did not reset"
        // the other way: it reset too much). Use "Clear pins & whitelist"
        // below to wipe data explicitly.
        writeRowsHidden(true)
        writeFamily(true)
        writeFlag(ICONONLY_KEY, false)
        writeTidy(true)
        writeFlag(TIDY_QR_KEY, true)
        writeFlag(TIDY_BRAND_KEY, true)
        writeFlag(TIDY_METER_KEY, true)
        writePanelMax(PANEL_MAX_DEFAULT)
        writeFootMax(FOOT_MAX_DEFAULT)
        writeOverlayMax(OVERLAY_MAX_DEFAULT)
        writeQrSize(QR_SIZE_DEFAULT)
        applyFold()
        ensureLauncher()
        applyFamily()
        applyIconOnly()
        applyTidy()
        applyConfig()
        setRowsHid(true)
        setFamily(true)
        setIconOnly(false)
        setTidy(true)
        setTidyQr(true)
        setTidyBrand(true)
        setTidyMeter(true)
        setPanelMax(PANEL_MAX_DEFAULT)
        setFootMax(FOOT_MAX_DEFAULT)
        setOverlayMax(OVERLAY_MAX_DEFAULT)
        setQrSize(QR_SIZE_DEFAULT)
      }

      function clearData() {
        // Explicit data wipe: unpinned store, top pins and whitelist. Also
        // re-asserts pins into the host's memory-only store so panels come
        // back in the sidebar immediately.
        writeUnpinned(new Set())
        writeTopPins([])
        writeWhitelist([])
        try {
          const nav = findPanelListNav()
          if (nav) {
            Array.prototype.forEach.call(nav.children, function (el) {
              if (!el.getAttribute) return
              if (el.getAttribute('data-dpp-top') === '1') {
                el.removeAttribute('data-dpp-top')
                el.style.removeProperty('order')
              }
            })
          }
        } catch (error) {
          /* sidebar not ready */
        }
        Array.prototype.forEach.call(document.querySelectorAll('[data-dpp-hidden="1"]'), function (el) {
          el.style.display = ''
          delete el.dataset.dppHidden
        })
        if (typeof bridge.onPinnedChange === 'function' && Array.isArray(bridge.entries)) {
          bridge.entries.forEach(function (entry) {
            if (!entry || !entry.id || entry.id === 'plugins') return
            try {
              bridge.onPinnedChange(entry.id, true)
            } catch (error) {
              /* ignore */
            }
          })
        }
        setWhitelist([])
        setPanelList(readPanelList())
      }

      function refreshSettingsState() {
        // Re-read every persisted value into React state after a full import
        // (clipboard or file), so an open Settings page shows the imported
        // layout immediately.
        setRowsHid(readRowsHidden())
        setFamily(readFamily())
        setIconOnly(readIconOnly())
        setTidy(readTidy())
        setTidyQr(readTidyQr())
        setTidyBrand(readTidyBrand())
        setTidyMeter(readTidyMeter())
        setPanelMax(readPanelMax())
        setFootMax(readFootMax())
        setOverlayMax(readOverlayMax())
        setQrSize(readQrSize())
        setWhitelist(readWhitelist())
        setPanelList(readPanelList())
        // v1.2.2: row-order card follows imports and drag edits too.
        try {
          setRowOrder(readRowOrder())
        } catch (error) {
          /* card state is cosmetic */
        }
        // v1.0.0: refresh the preset/group cards after a full import.
        try {
          setPresets(readPresets())
          setCgroups(readCustomGroups())
        } catch (error) {
          /* card state is cosmetic */
        }
      }

      function exportSettings() {
        exportSettingsToClipboard()
      }

      function exportSettingsFile() {
        // v1.2.0: download the dump as a JSON file (factory-level).
        exportSettingsToFile()
      }

      function applyImportedDump(dump) {
        // Thin wrapper: factory-level replay (localStorage write + appliers),
        // then refresh the open Settings page's own React state.
        const ok = applyImportedDumpShared(dump)
        if (ok) refreshSettingsState()
        return ok
      }

      function importSettings() {
        // Read the clipboard, validate, write every key back, re-apply all.
        importSettingsFromClipboard()
      }

      function importSettingsFile() {
        // v1.2.0: pick a previously exported settings JSON file (factory-level
        // importSettingsFromFile opens the one-shot input).
        importSettingsFromFile()
      }

      function switchRow(label, detail, on, onToggle, extraClass) {
        return h(
          'div',
          { className: 'dpp-set-row' + (extraClass ? ' ' + extraClass : '') },
          h(
            'div',
            { className: 'dpp-set-texts' },
            h('div', { className: 'dpp-set-label' }, label),
            detail ? h('div', { className: 'dpp-set-detail' }, detail) : null,
          ),
          h(SettingsSwitch, { on: on, onToggle: onToggle, label: label }),
        )
      }

      // v1.2.1: drag a settings JSON file onto the section to import it —
      // same sentinel validation and replay chain as the file-picker channel.
      // All handlers are defensive: drag UX must never throw into React.
      const dropHandlers = {
        onDragOver: function (event) {
          try {
            if (event && event.dataTransfer && Array.prototype.indexOf.call((event.dataTransfer.types || []), 'Files') !== -1) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          } catch (error) {
            /* ignore */
          }
        },
        onDrop: function (event) {
          try {
            const dt = event && event.dataTransfer
            if (!dt) return
            const file = dt.files && dt.files[0]
            if (!file) return
            event.preventDefault()
            const reader = new FileReader()
            reader.onload = function () {
              const ok = importSettingsFromText(String(reader.result || ''), 'file')
              if (ok) refreshSettingsState()
            }
            reader.onerror = function () {
              showToast(zh ? '导入失败' : 'Import failed')
            }
            try {
              reader.readAsText(file)
            } catch (error) {
              showToast(zh ? '导入失败' : 'Import failed')
            }
          } catch (error) {
            /* ignore */
          }
        },
      }

      return h(
        'div',
        Object.assign({ className: 'dpp-set' }, dropHandlers),
        h('h2', { className: 'dpp-set-title' }, LABEL.setTitle),
        h('p', { className: 'dpp-set-intro' }, LABEL.setIntro),
        h(
          'div',
          { className: 'dpp-set-card' },
          switchRow(LABEL.setRows, LABEL.setRowsDetail, rowsHid, toggleRows),
          switchRow(LABEL.setFamily, LABEL.setFamilyDetail, family, toggleFamily),
          switchRow(LABEL.setIconOnly, LABEL.setIconOnlyDetail, iconOnly, toggleIconOnly),
          switchRow(LABEL.setTidy, LABEL.setTidyDetail, tidy, toggleTidy),
          switchRow(LABEL.bridgeTitle, LABEL.bridgeDetail, bridgeOn, toggleBridge),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h('div', { className: 'dpp-set-note' }, LABEL.setSubNote),
          switchRow(LABEL.setSubQr, null, tidyQr, toggleTidyQr, 'dpp-set-subrow'),
          switchRow(LABEL.setSubBrand, null, tidyBrand, toggleTidyBrand, 'dpp-set-subrow'),
          switchRow(LABEL.setSubMeter, null, tidyMeter, toggleTidyMeter, 'dpp-set-subrow'),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h(SettingsSliderRow, {
            label: LABEL.setPanelMax,
            value: panelMax,
            min: 8,
            max: 80, // keep in sync with readPanelMax/writePanelMax clamp (8–80)
            onChange: changePanelMax,
            unit: 'vh',
          }),
          h(SettingsSliderRow, {
            label: LABEL.setFootMax,
            value: footMax,
            min: 5,
            max: 40,
            onChange: changeFootMax,
            unit: 'vh',
          }),
          h(SettingsSliderRow, {
            label: LABEL.setOverlayMax,
            value: overlayMax,
            min: 30,
            max: 90,
            onChange: changeOverlayMax,
            unit: 'vh',
          }),
          h(SettingsSliderRow, {
            label: LABEL.setQrSize,
            value: qrSize,
            min: 80,
            max: 256,
            onChange: changeQrSize,
            unit: 'px',
          }),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.setWhitelist),
              h('div', { className: 'dpp-set-detail' }, LABEL.setWhitelistDetail),
            ),
          ),
          available.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.setPickEmpty)
            : available.map(function (avail) {
                const rowId = avail.id || null
                return switchRow(
                  avail.label,
                  null,
                  isWhitelisted(avail.label, rowId),
                  function () {
                    toggleWhitelistEntry(avail.label, rowId)
                  },
                  'dpp-set-subrow',
                )
              }),
        ),
        // v1.0.0: layout presets card.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.presetTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.presetDetail),
            ),
          ),
          h(
            'div',
            { className: 'dpp-set-inputrow' },
            h('input', {
              id: 'dpp-preset-name',
              type: 'text',
              className: 'dpp-set-input',
              placeholder: LABEL.presetNamePh,
              onKeyDown: function (event) {
                if (event && event.key === 'Enter') {
                  event.preventDefault()
                  savePresetFromInput()
                }
              },
            }),
            h('button', { type: 'button', className: 'dpp-set-add', onClick: savePresetFromInput }, LABEL.presetSave),
          ),
          Object.keys(presets).length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.presetEmpty)
            : Object.keys(presets).map(function (name) {
                const active = readActivePreset() === name
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'preset-' + name },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    h('div', { className: 'dpp-set-label' }, name + (active ? LABEL.presetActiveFlag : '')),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      disabled: active,
                      title: active ? LABEL.presetActiveFlag : LABEL.presetApply,
                      onClick: function () {
                        applyPresetFromCard(name)
                      },
                    },
                    LABEL.presetApply,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x dpp-set-danger',
                      title: LABEL.presetDeleteTitle,
                      onClick: function (event) {
                        // Two-step confirm: first click arms, second deletes.
                        const btn = event.currentTarget
                        if (btn.getAttribute('data-dpp-armed') === '1') {
                          deletePresetFromCard(name)
                          return
                        }
                        btn.setAttribute('data-dpp-armed', '1')
                        btn.textContent = LABEL.presetDeleteConfirm
                        setTimeout(function () {
                          if (btn.isConnected) {
                            btn.removeAttribute('data-dpp-armed')
                            btn.textContent = LABEL.presetDelete
                          }
                        }, 3000)
                      },
                    },
                    LABEL.presetDelete,
                  ),
                )
              }),
        ),
        // v1.0.0: custom panel groups card.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.cgTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.cgDetail),
            ),
          ),
          h(
            'div',
            { className: 'dpp-set-inputrow' },
            h('input', {
              id: 'dpp-cg-name',
              type: 'text',
              className: 'dpp-set-input',
              placeholder: LABEL.cgNamePh,
              onKeyDown: function (event) {
                if (event && event.key === 'Enter') {
                  event.preventDefault()
                  addGroupFromInput()
                }
              },
            }),
            h('button', { type: 'button', className: 'dpp-set-add', onClick: addGroupFromInput }, LABEL.cgAdd),
          ),
          Object.keys(cgroups).length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.cgEmpty)
            : Object.keys(cgroups).map(function (gid) {
                const g = cgroups[gid] || { name: gid, labels: [] }
                const labels = Array.isArray(g.labels) ? g.labels : []
                const free = ungroupedPanels()
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'cg-' + gid },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    renamingGid === gid
                      ? h('input', {
                          type: 'text',
                          className: 'dpp-set-input',
                          defaultValue: g.name || gid,
                          placeholder: LABEL.cgNamePh,
                          autoFocus: true,
                          onKeyDown: function (event) {
                            if (event && event.key === 'Enter') {
                              event.preventDefault()
                              commitRename(gid, event.target.value)
                            } else if (event && event.key === 'Escape') {
                              event.preventDefault()
                              setRenamingGid('')
                            }
                          },
                          onBlur: function (event) {
                            commitRename(gid, event.target.value)
                          },
                        })
                      : h('div', { className: 'dpp-set-label' }, g.name || gid),
                    labels.length === 0
                      ? h('div', { className: 'dpp-set-detail' }, LABEL.cgNoMembers)
                      : h(
                          'div',
                          { style: { marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' } },
                          labels.map(function (l) {
                            return h(
                              'span',
                              { className: 'dpp-set-chip', key: 'cg-chip-' + l },
                              h('span', { className: 'dpp-set-label' }, l),
                              h('span', {
                                className: 'dpp-set-x',
                                title: LABEL.cgRemovePanel,
                                onClick: function () {
                                  removePanelFromGroup(gid, l)
                                },
                              }, '×'),
                            )
                          }),
                        ),
                  ),
                  labels.length > 0 || free.length > 0
                    ? h(
                        'select',
                        {
                          className: 'dpp-set-input',
                          style: { maxWidth: '45%', flex: 'none', alignSelf: 'center' },
                          value: '',
                          onChange: function (event) {
                            addPanelToGroup(gid, event.target.value)
                            event.target.value = ''
                          },
                        },
                        h('option', { value: '' }, LABEL.cgAddPanel),
                        free.map(function (p) {
                          return h('option', { value: p.label, key: 'opt-' + p.id }, p.label)
                        }),
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      title: LABEL.cgRename,
                      onClick: function () {
                        renameGroup(gid)
                      },
                    },
                    LABEL.cgRename,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x dpp-set-danger',
                      title: LABEL.cgDeleteTitle,
                      onClick: function (event) {
                        const btn = event.currentTarget
                        if (btn.getAttribute('data-dpp-armed') === '1') {
                          deleteGroup(gid)
                          return
                        }
                        btn.setAttribute('data-dpp-armed', '1')
                        btn.textContent = LABEL.presetDeleteConfirm
                        setTimeout(function () {
                          if (btn.isConnected) {
                            btn.removeAttribute('data-dpp-armed')
                            btn.textContent = LABEL.cgDelete
                          }
                        }, 3000)
                      },
                    },
                    LABEL.cgDelete,
                  ),
                )
              }),
          Object.keys(cgroups).length > 0
            ? h('div', { className: 'dpp-set-note' }, LABEL.cgAssignedNote)
            : null,
        ),
        // v1.1.0: hidden rows card — restore entries hidden from the context
        // menu. Shows the display name with the original label as detail.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.hiddenTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.hiddenDetail),
            ),
          ),
          hiddenRows.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.hiddenEmpty)
            : hiddenRows.length >= 2
              ? h(
                  'div',
                  { className: 'dpp-set-row' },
                  h('div', { className: 'dpp-set-texts' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      onClick: function () {
                        try {
                          writeHiddenRows([])
                          setHiddenRows([])
                          showToast(LABEL.hiddenRestoreAllDone)
                          refreshAll()
                        } catch (error) {
                          /* React guard */
                        }
                      },
                    },
                    LABEL.hiddenRestoreAll,
                  ),
                )
              : null,
          hiddenRows.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.hiddenEmpty)
            : hiddenRows.map(function (label) {
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'hid-' + label },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    h('div', { className: 'dpp-set-label' }, displayNameFor(label)),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      onClick: function () {
                        try {
                          const rows = readHiddenRows()
                          const idx = rows.indexOf(label)
                          if (idx !== -1) rows.splice(idx, 1)
                          writeHiddenRows(rows)
                          setHiddenRows(rows.slice())
                          showToast((zh ? '已恢复显示「NAME」' : 'Restored "NAME"').replace('NAME', displayNameFor(label)))
                          refreshAll()
                        } catch (error) {
                          /* React guard */
                        }
                      },
                    },
                    LABEL.hiddenRestore,
                  ),
                )
              }),
        ),
        // v1.1.0: renamed rows card — reset display names back to originals.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.renamesTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.renamesDetail),
            ),
          ),
          Object.keys(renames).length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.renamesEmpty)
            : Object.keys(renames).map(function (label) {
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'ren-' + label },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    h('div', { className: 'dpp-set-label' }, renames[label]),
                    h('div', { className: 'dpp-set-detail' }, label),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      onClick: function () {
                        try {
                          const map = readRenames()
                          delete map[label]
                          writeRenames(map)
                          setRenames(readRenames())
                          showToast((zh ? '已恢复「NAME」原名' : 'Reset "NAME"').replace('NAME', label))
                          refreshAll()
                        } catch (error) {
                          /* React guard */
                        }
                      },
                    },
                    LABEL.renamesReset,
                  ),
                )
              }),
        ),
        // v1.2.2: custom row order management — visible only while a custom
        // order exists, so it never nags users who never reordered.
        rowOrder.length > 0
          ? h(
              'div',
              { className: 'dpp-set-card' },
              h(
                'div',
                { className: 'dpp-set-row' },
                h(
                  'div',
                  { className: 'dpp-set-texts' },
                  h('div', { className: 'dpp-set-label' }, LABEL.rowOrderTitle),
                  h(
                    'div',
                    { className: 'dpp-set-detail' },
                    LABEL.rowOrderDetail,
                    h('br'),
                    (zh ? '已自定义 ' : '') + rowOrder.length + (zh ? ' 行的顺序' : ' rows reordered'),
                  ),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpp-set-x',
                    title: LABEL.rowOrderDetail,
                    onClick: function () {
                      try {
                        writeRowOrder([])
                        setRowOrder([])
                        showToast(LABEL.rowOrderResetDone)
                        refreshAll()
                      } catch (error) {
                        /* React guard */
                      }
                    },
                  },
                  LABEL.rowOrderReset,
                ),
              ),
            )
          : null,
        // v1.3.3: feedback card — issue / survey / manual diagnostics copy.
        // All click-triggered; the diagnostics copy is explicit because the
        // dump contains the user's panel labels and renames.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.fbTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.fbDetail),
            ),
          ),
          h(
            'div',
            { className: 'dpp-set-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-set-reset',
                title: LABEL.fbIssueTitle,
                onClick: function () {
                  try {
                    openFeedbackIssue()
                  } catch (error) {
                    /* React guard */
                  }
                },
              },
              LABEL.fbIssue,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-set-reset',
                title: LABEL.fbSurveyTitle,
                onClick: function () {
                  try {
                    openFeedbackSurvey()
                  } catch (error) {
                    /* React guard */
                  }
                },
              },
              LABEL.fbSurvey,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-set-reset',
                title: LABEL.fbDiagTitle,
                onClick: function () {
                  try {
                    copyFeedbackDiagnostics()
                  } catch (error) {
                    /* React guard */
                  }
                },
              },
              LABEL.fbDiag,
            ),
          ),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.setPinManage),
              h('div', { className: 'dpp-set-detail' }, LABEL.setPinManageDetail),
            ),
          ),
          panelList.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.setPinEmpty)
            : panelList.map(function (panel) {
                // Drag-to-reorder top pins (v0.10.0): drag a top-pinned row
                // onto another top-pinned row to reorder TOP_KEY. HTML5 DnD,
                // guarded — the pin manager must never throw into React.
                const draggable = panel.top && panel.idKnown
                return h(
                  'div',
                  {
                    className: 'dpp-set-chip' + (draggable ? ' dpp-draggable' : ''),
                    key: panel.id,
                    draggable: draggable ? 'true' : 'false',
                    'data-dpp-topid': draggable ? panel.id : undefined,
                    title: draggable ? LABEL.setDragHint : undefined,
                    onDragStart: draggable
                      ? function (event) {
                          try {
                            event.dataTransfer.setData('text/plain', panel.id)
                            event.dataTransfer.effectAllowed = 'move'
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDragOver: draggable
                      ? function (event) {
                          try {
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDrop: draggable
                      ? function (event) {
                          try {
                            event.preventDefault()
                            event.currentTarget.classList.remove('dpp-droptarget')
                            const srcId = event.dataTransfer.getData('text/plain')
                            if (!srcId || srcId === panel.id) return
                            reorderTopPins(srcId, panel.id)
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDragEnter: draggable
                      ? function (event) {
                          try {
                            event.preventDefault()
                            event.currentTarget.classList.add('dpp-droptarget')
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDragLeave: draggable
                      ? function (event) {
                          try {
                            event.currentTarget.classList.remove('dpp-droptarget')
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                  },
                  h(
                    'span',
                    { className: 'dpp-set-label' },
                    panel.top ? panel.label + LABEL.topFlag : panel.label,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      disabled: !panel.idKnown || !panel.pinned,
                      title: !panel.idKnown
                        ? LABEL.setPinNeedMenu
                        : !panel.pinned
                          ? LABEL.setTopNeedPin
                          : undefined,
                      onClick: function () {
                        toggleTopPin(panel.id, panel.label)
                      },
                    },
                    panel.top ? LABEL.setTopOff : LABEL.setTop,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      disabled: !panel.idKnown,
                      title: panel.idKnown ? undefined : LABEL.setPinNeedMenu,
                      onClick: function () {
                        togglePin(panel.id, panel.pinned)
                      },
                    },
                    panel.pinned ? LABEL.setPinUnpin : LABEL.setPinRestore,
                  ),
                )
              }),
        topStats.stored > 0 && topStats.matched === 0
          ? h('div', { className: 'dpp-set-empty' }, LABEL.setTopNoMatch)
          : null,
        ),
        h(
          'div',
          { className: 'dpp-set-actions' },
          h('button', { type: 'button', className: 'dpp-set-reset', onClick: reset }, LABEL.setReset),
          h(
            'button',
            {
              type: 'button',
              className: 'dpp-set-reset dpp-set-danger',
              title: LABEL.setResetDataTitle,
              onClick: clearData,
            },
            LABEL.setResetData,
          ),
          h('button', { type: 'button', className: 'dpp-set-reset', onClick: exportSettings }, LABEL.setExport),
          h(
            'button',
            {
              type: 'button',
              className: 'dpp-set-reset',
              title: LABEL.setImportTitle,
              onClick: importSettings,
            },
            LABEL.setImport,
          ),
          h('button', { type: 'button', className: 'dpp-set-reset', onClick: exportSettingsFile }, LABEL.setExportFile),
          h(
            'button',
            {
              type: 'button',
              className: 'dpp-set-reset',
              title: LABEL.setImportFileTitle,
              onClick: importSettingsFile,
            },
            LABEL.setImportFile,
          ),
        ),
        h(
          'p',
          { className: 'dpp-set-intro dpp-set-version' },
          // v1.4.2: build tag is internal-only — the footnote shows the plain
          // version (official installs carry exactly one build per version).
          // The ?dppdebug overlay still carries the full BUILD line for
          // troubleshooting (local-vs-registry divergence diagnosis).
          'dsh-panel-pins v' + VERSION,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Slot registrations first (they must survive even if the DOM layer
        // below fails).
        ctxSlots = ctx.slots
        // v1.3.2: archive the whole ctx for optionalService() reads (layout
        // panelInfo). Deliberately NOT added to `inject` — see the header
        // note: a missing declared service parks the fiber; a read of an
        // absent one just throws and degrades to "no exemption".
        ctxRef = ctx || null
        ctx.slots.inject(SLOT, function () {
          return ctx.slots.register({ name: SLOT, id: SLOT_ID, order: 900 }, PinMenuRows)
        })
        // v1.8.0 (P1-5): collapsed-sidebar toggle badge. The host renders
        // this occupant while collapsed (SidebarRoot.tsx:302, slot declared
        // 'single'/root in index.ts:99). Hosts without the slot simply never
        // render it — injecting an unknown slot name is inert, and the
        // try/catch keeps even a hostile slots shape from breaking activate.
        try {
          ctx.slots.inject(BADGE_SLOT, function () {
            return ctx.slots.register(
              { name: BADGE_SLOT, id: SLOT_ID + '-badge', order: 900 },
              ToggleBadgeRows,
            )
          })
        } catch (error) {
          /* slot unavailable on this host: the badge is sugar, skip it */
        }
        // Settings page column (see header item 8). The label thunk avoids
        // any locale-service dependency; copy inside the section uses the
        // plugin's own zh/en LABEL dict.
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register(
            {
              name: 'settings.section',
              id: SLOT_ID,
              order: 90,
              label: function () {
                return zh ? '面板收纳' : 'Panel Pins'
              },
            },
            PanelPinsSettingsSection,
          )
        })
        // DOM layer (style, visibility, launcher, observers, timers). Fully
        // defensive: this plugin is decorative — ANY activation-phase error
        // here must degrade to "no DOM extras" (b20 behavior), never break
        // the host's web boot (b21 regression: one thrown error during apply
        // fails the whole entry).
        if (typeof document !== 'undefined') {
          try {
            refreshAll()
          // v1.4.0: boot rescans — the plugin may apply before the plugins it
          // bridges; the subscription cannot observe pre-declaration
          // registrations, so a bounded rescan schedule reconciles once the
          // rest of the boot has applied.
          try {
            scheduleBridgeRescans()
          } catch (error) {
            /* rescan is best-effort */
          }
          let refreshTimer = null
          const scheduleRefresh = function () {
            if (refreshTimer) return
            refreshTimer = setTimeout(function () {
              refreshTimer = null
              refreshAll()
            }, 120)
          }
          let observer = null
          try {
            observer = mutationObserverFor(scheduleRefresh)
            const sidebarRoot = findPanelListNav() && findPanelListNav().parentNode
            if (sidebarRoot) {
              observer.observe(sidebarRoot, { childList: true, subtree: true })
              observer.__dppRoot = sidebarRoot
            } else {
              // Sidebar not mounted yet (early apply): watch <body> briefly so
              // the first render is caught; the anchor timer below re-anchors
              // the observer to the real sidebar root once the nav exists.
              observer.observe(document.body, { childList: true, subtree: true })
              observer.__dppOnBody = true
            }
          } catch (error) {
            observer = null
          }
          // Safety net at a humane rate: replaces the old 1.5s full sweep.
          const fallback = setInterval(refreshAll, 5000)
          // v1.3.2 active-row exemption: switching panels does not touch the
          // sidebar DOM, so the MutationObserver cannot see it. Subscribe to
          // the host layout observable (panelInfo) and schedule a refresh on
          // every flip; the 5s fallback interval remains the net if the
          // service or subscribe channel is absent. Best-effort by design:
          // any throw here degrades to interval-driven exemption updates.
          let panelSubDispose = null
          // v1.5.0 (b95): pending retry for the host shortcut registration.
          let shortcutRetry = null
          try {
            const layout = optionalService('layout')
            const info = layout && layout.panelInfo
            if (info && typeof info.subscribe === 'function') {
              const off = info.subscribe(function () {
                scheduleRefresh()
              })
              panelSubDispose = typeof off === 'function' ? off : null
            }
          } catch (error) {
            panelSubDispose = null
          }
          // Theme probe. The host applies its palette by writing <html>.style,
          // <html>[data-ds-theme-source] and <body>[data-ds-dark-theme]
          // (dsh-client-ui-layout/src/client/theme-presenter.ts:69-76) — never
          // a class on <html> — so the old class-only filter could not fire on
          // a theme switch. Observe the real attributes AND take the host's own
          // 'theme/change' event when the theme service is present; the DOM
          // watch stays as the fallback for hosts without that service.
          let attrObserver = null
          try {
            attrObserver = mutationObserverFor(applyTheme)
            if (!attrObserver) throw new Error('no MutationObserver available')
            attrObserver.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class', 'style', 'data-ds-theme-source'],
            })
            if (document.body) {
              attrObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['data-ds-dark-theme'],
              })
            }
          } catch (error) {
            attrObserver = null
          }
          // v1.6.0: the host publishes every theme change as 'theme/change'
          // with a snapshot carrying `active.colorScheme` (ui-theme
          // src/client/index.ts:144/438). Prefer it — instant, public, no DOM
          // sniffing. The event fires on ctx regardless of service ordering,
          // so a late-provided theme service still reaches us.
          let themeEventOff = null
          try {
            const ctx = ctxRef
            if (ctx && typeof ctx.on === 'function') {
              themeEventOff = ctx.on('theme/change', function (snapshot) {
                const active = snapshot && (snapshot.active || snapshot)
                const scheme = active && (active.colorScheme || active.scheme)
                if (scheme !== 'dark' && scheme !== 'light') return
                hostColorScheme = scheme
                applyTheme()
              })
            }
          } catch (error) {
            themeEventOff = null
          }
          // v1.6.0: follow the host's language. The host's locale runtime
          // publishes 'locale/change' when the effective language moves
          // (dsh-client-locale/src/client/index.ts:88-99, :506) and also
          // offers a store-style subscribe() (index.ts:239-242). The event is
          // primary; the store is a second channel for hosts that ship one
          // without the other. refreshLocale() is a no-op unless the
          // effective language actually moved, so a duplicate signal is free.
          let localeEventOff = null
          let localeStoreOff = null
          try {
            const ctx = ctxRef
            if (ctx && typeof ctx.on === 'function') {
              localeEventOff = ctx.on('locale/change', function () {
                refreshLocale()
              })
            }
            const locale = optionalService('locale')
            if (locale && typeof locale.subscribe === 'function') {
              localeStoreOff = locale.subscribe(function () {
                refreshLocale()
              })
            }
          } catch (error) {
            /* no locale service or no event channel: the plugin keeps the
               language it detected at mount */
          }
          // The module-level LABEL table was built BEFORE ctx existed, so it
          // could only see navigator.language. Now that the host locale
          // service is reachable, re-evaluate: a host set to 中文 while the
          // browser reports en-US must render Chinese.
          refreshLocale()
          // Re-anchor: upgrade from the <body> watch to the real sidebar root
          // once it exists, and re-anchor again whenever React replaces the
          // whole sidebar root. One querySelector per 2s is negligible.
          const anchorTimer = setInterval(function () {
            try {
              if (!observer) {
                clearInterval(anchorTimer)
                return
              }
              const nav = findPanelListNav()
              const root = nav && nav.parentNode
              if (root && observer.__dppRoot !== root) {
                observer.disconnect()
                observer.observe(root, { childList: true, subtree: true })
                observer.__dppRoot = root
                observer.__dppOnBody = false
              }
            } catch (error) {
              /* keep the fallback interval as the net */
            }
          }, 2000)
          // Row context menu: capture-phase listener on document.
          try {
            document.addEventListener('contextmenu', handleContext, true)
            document.addEventListener('keydown', handleGlobalKey, true)
          } catch (error) {
            /* listener registration is best-effort */
          }
          // v1.5.0 (b95): hand Ctrl+K to the host's shortcut service when it
          // exists — the binding becomes rebindable in Settings -> Shortcuts
          // and the host decides whether the key may fire. The service can be
          // provided a tick after our fiber starts, so retry once before we
          // settle for the legacy document listener.
          const tryRegisterHostShortcut = function () {
            if (hostShortcutActive) return
            if (registerHostPaletteShortcut()) return
            if (!shortcutRetry) {
              shortcutRetry = setTimeout(function () {
                shortcutRetry = null
                tryRegisterHostShortcut()
              }, 1500)
            }
          }
          tryRegisterHostShortcut()
          // Row drag reorder (v1.2.2): document-level delegation, installed
          // once per page.
          try {
            installRowDrag()
          } catch (error) {
            /* drag stays unavailable; everything else unaffected */
          }
          // Dispose: cordis teardown must not leave timers, observers, the
          // style tag or the launcher button behind. Everything the plugin
          // inserted is removable; row inline styles are cleared so the host
          // reclaims its rows untouched. Registered through whichever dispose
          // channel this cordis fork exposes (ctx.dispose callback or the
          // 'dispose' event); if neither exists the behavior matches old
          // builds (cleanup on restart only) — no regression.
          const disposeCleanup = function () {
            clearInterval(fallback)
            clearInterval(anchorTimer)
            if (refreshTimer) clearTimeout(refreshTimer)
            // v1.4.0: bridged settings pages — paired dispose of every main
            // key + child slot, subscription and rescan timers, so the host
            // never keeps ghost panels selectable.
            try {
              disposeAllBridges()
            } catch (error) {
              /* ignore */
            }
            try {
              unwatchSettingsSection()
            } catch (error) {
              /* ignore */
            }
            try {
              teardownBridgeTimers()
            } catch (error) {
              /* ignore */
            }
            // v1.3.2: unsubscribe the panelInfo listener (declared service or
            // not, a live subscription must not outlive the plugin).
            try {
              if (typeof panelSubDispose === 'function') panelSubDispose()
            } catch (error) {
              /* ignore */
            }
            panelSubDispose = null
            // v1.6.0: the 'theme/change' subscription must not outlive the
            // plugin either — a live listener keeps re-toggling a class on a
            // document the plugin no longer owns.
            try {
              if (typeof themeEventOff === 'function') themeEventOff()
            } catch (error) {
              /* ignore */
            }
            themeEventOff = null
            // v1.6.0: same for the locale channels.
            try {
              if (typeof localeEventOff === 'function') localeEventOff()
            } catch (error) {
              /* ignore */
            }
            localeEventOff = null
            try {
              if (typeof localeStoreOff === 'function') localeStoreOff()
            } catch (error) {
              /* ignore */
            }
            localeStoreOff = null
            // v1.5.0 (b95): the host shortcut registration must not outlive
            // the plugin — an orphan binding would keep Ctrl+K reserved.
            try {
              if (shortcutRetry) clearTimeout(shortcutRetry)
              shortcutRetry = null
            } catch (error) {
              /* ignore */
            }
            try {
              if (typeof hostShortcutDispose === 'function') hostShortcutDispose()
              hostShortcutDispose = null
              hostShortcutActive = false
            } catch (error) {
              /* ignore */
            }
            try {
              if (observer) observer.disconnect()
              if (attrObserver) attrObserver.disconnect()
            } catch (error) {
              /* ignore */
            }
            try {
              document.removeEventListener('contextmenu', handleContext, true)
              document.removeEventListener('keydown', handleGlobalKey, true)
            } catch (error) {
              /* ignore */
            }
            try {
              closeCtxMenu()
            } catch (error) {
              /* ignore */
            }
            try {
              if (overlay) closeOverlay()
            } catch (error) {
              /* ignore */
            }
            try {
              const tag = document.getElementById(STYLE_ID)
              if (tag) tag.remove()
            } catch (error) {
              /* ignore */
            }
            try {
              const launcher = document.querySelector('[' + LAUNCHER_ATTR + ']')
              if (launcher) launcher.remove()
            } catch (error) {
              /* ignore */
            }
            try {
              const line = document.getElementById(DROP_LINE_ID)
              if (line) line.remove()
              document.querySelectorAll('[data-dpp-dragging="1"]').forEach(function (el) {
                el.removeAttribute('data-dpp-dragging')
              })
              document.querySelectorAll('[data-dpp-roworder="1"]').forEach(function (el) {
                el.removeAttribute('data-dpp-roworder')
                el.style.removeProperty('order')
              })
            } catch (error) {
              /* ignore */
            }
            try {
              document.querySelectorAll('[data-dpp-hidden="1"]').forEach(function (el) {
                el.style.display = ''
                delete el.dataset.dppHidden
              })
              document.querySelectorAll('[data-dpp-top="1"]').forEach(function (el) {
                el.removeAttribute('data-dpp-top')
                el.style.removeProperty('order')
              })
            } catch (error) {
              /* ignore */
            }
          }
          // Lifecycle cleanup registration. CORRECT cordis API: the 'dispose'
          // EVENT (ctx.on) fires on teardown. NEVER call ctx.dispose(cb) —
          // that is the immediate-teardown COMMAND (it unloads the plugin on
          // the spot); calling it during apply() self-destructs the plugin
          // mid-activation and the host reports "entry did not activate"
          // (regression b21, fixed in b22). Best-effort only: if the event
          // channel is absent, cleanup falls back to restart-time — the b20
          // behavior — instead of risking activation.
          try {
            if (typeof ctx.on === 'function') ctx.on('dispose', disposeCleanup)
          } catch (error) {
            /* event channel unavailable: cleanup on restart only */
          }
        } catch (error) {
          // Swallow but surface: the debug overlay (if ?dppdebug) and the
          // console remain the only trace. Activation still counts as OK.
          try {
            console.error('[dsh-panel-pins] DOM layer failed to initialize:', error)
          } catch (ignored) {
            /* ignore */
          }
        }
        }
      },
    }
  },
})
