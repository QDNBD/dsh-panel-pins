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
    const BUILD = 'b102'
    // Keep in sync with package.json — shown on the Settings page so an
    // installed build can be identified at a glance (verify-install aid).
    const VERSION = '1.9.1'
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
      // v1.9.0 (P1-1): the single slash-menu command row. Copy is read on
      // every candidate pass (contract guarantee), so a locale switch is
      // picked up on the next menu open with no re-registration.
      cmdLauncher: zh ? '打开面板启动器' : 'Open panel launcher',
      cmdLauncherDesc: zh ? '搜索并打开侧栏面板（Ctrl+K，支持拼音）' : 'Search & open sidebar panels (Ctrl+K, pinyin supported)',
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

