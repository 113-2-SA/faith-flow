require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

// panoramaHeading：Street View 初始鏡頭方位角（度數）
//   0 = 朝北、90 = 朝東、180 = 朝南、270 = 朝西
// 設定依據：從教堂廣場/入口前方朝向建築正面的羅盤方向
const BASILICAS = [
  {
    id: "stpeter_vatican",
    name: "聖彼得大教堂",
    nameEn: "St. Peter's Basilica",
    location: "梵諦岡",
    coordinates: [41.9021, 12.4562], // 聖伯多祿廣場中央，正對正面
    type: "major",
    founded: 1626,
    dedication: "聖彼得",
    style: "文藝復興、巴洛克",
    significance: "聖彼得大教堂是天主教會的精神核心，教宗在此主持最重要的禮儀，包括復活節彌撒與聖年開啟聖門。此地相傳是耶穌使徒之首聖彼得殉道並安葬之所，使其成為普世天主教信仰與教宗宗座的根基。數百年來，無數朝聖者從世界各地湧來，渴望親近使徒之墓，祈求聖彼得代禱轉達天主。",
    description: "聖彼得大教堂建於文藝復興極盛時期，由米開朗基羅、拉斐爾等巨匠相繼參與設計，宏偉的穹頂至今仍是羅馬天際線的標誌。教堂可容納逾六萬名信眾，內部珍藏米開朗基羅的《聖殤》雕塑、貝尼尼設計的青銅華蓋，以及歷代教宗的陵寢。地下聖墓區保存著聖彼得的墓穴，是每位朝聖者必訪的信仰核心。廣場上貝尼尼設計的弧形柱廊象徵教會雙臂張開，擁抱全世界的信徒。",
    viewerUrl: "stpeter",
    panoramaHeading: 270, // 正面朝東，由廣場向西看
  },
  {
    id: "stpaul_vatican",
    name: "聖保羅大教堂",
    nameEn: "St. Paul's Basilica",
    location: "梵諦岡、羅馬",
    coordinates: [41.8589, 12.4769], // 北側廣場，朝南看金色馬賽克正面
    type: "major",
    founded: 386,
    dedication: "聖保羅",
    style: "早期基督教、文藝復興、巴洛克",
    significance: "聖保羅城牆外大殿紀念的是「外邦人的宗徒」聖保羅，他在此地附近殉道並被安葬，成為信仰傳播至全世界的精神象徵。此為羅馬四大宗座聖殿之一，是所有基督信徒朝聖羅馬的必訪之地，尤其在聖年期間更有大批信眾前來領取大赦。保羅書信塑造了基督宗教神學思想，其墓冢成為歷代信徒尋求庇護與啟示的聖地。",
    description: "原有的教堂由君士坦丁大帝建於西元四世紀，後多次擴建，成為當時世界最大的教堂之一。1823 年大火後，教堂依古老格局重建，保留了壯麗的白色大理石外觀與金色馬賽克正面。內部豪華的柱廊安置了歷代教宗的肖像章，從聖彼得一路排列至今，構成一部視覺化的教會史。教堂中央地板下方的石棺刻有「PAULO APOSTOLO MART」，被認定即為聖保羅長眠之所，信眾得以俯身祈禱。",
    viewerUrl: "stpaul",
    panoramaHeading: 180, // 正面朝北，由北廣場向南看
  },
  {
    id: "santa_maria_maggiore",
    name: "聖母瑪利亞大殿",
    nameEn: "Basilica of St. Mary Major",
    location: "羅馬",
    coordinates: [41.8978, 12.4971], // 西側廣場，朝東看主正面
    type: "major",
    founded: 432,
    dedication: "聖母瑪利亞",
    style: "早期基督教、文藝復興",
    significance: "聖母瑪利亞大殿是羅馬四大宗座聖殿之一，也是普世天主教會中供奉聖母最古老且最重要的聖殿。傳說教宗良一世夢見聖母指示在雪覆之地建堂，廣場中央的奇蹟之雪柱見證了這段聖母庇護之情。教堂珍藏的「大城聖母像」（Salus Populi Romani）被歷代教宗奉為羅馬城的護城之像，無數信眾至此祈求聖母的轉禱與護佑。",
    description: "聖母瑪利亞大殿是羅馬保存最完整的早期基督教教堂之一，建於第五世紀的西斯篤三世教宗時代。中殿天花板保有文藝復興時期以新大陸黃金裝飾的精工木雕頂棚，是新舊世界信仰交會的見證。中殿兩側高處的馬賽克鑲嵌畫描繪舊約場景，被認為是羅馬現存最古老的基督教藝術之一。聖誕節的主保聖物「耶穌誕生馬槽聖木」亦供奉於此，使此殿成為慶祝主降生的朝聖中心。",
    viewerUrl: "santa_maria",
    panoramaHeading: 90, // 主正面朝西，由東側廣場向西看
  },
  {
    id: "san_giovanni",
    name: "聖若望聖殿",
    nameEn: "Basilica of St. John Lateran",
    location: "羅馬",
    coordinates: [41.8858, 12.5056], // 東側廣場，朝西看 Borromini 正面
    type: "major",
    founded: 324,
    dedication: "聖若望洗者",
    style: "早期基督教、巴洛克",
    significance: "聖若望拉特朗大殿是教宗的主教座堂，即全球天主教會的「母堂」與「諸殿之首」，其宗教地位在普世教會中無可取代。此殿見證了多次教會大公會議的召開，是教宗宗座一脈相承的歷史根基，更是羅馬朝聖不可缺少的一站。教堂所在地相傳是基督教在羅馬帝國取得合法地位後最先建立聖殿之處，承載著信仰從地下轉為公開的歷史轉折。",
    description: "聖若望拉特朗大殿建於西元 313 年君士坦丁大帝賜地之後，是基督教史上最早建立的大型聖殿之一。現存的巴洛克式正面建於十八世紀，內部中殿展現多個世紀的藝術積累，包括雕像、壁畫與精緻的彩色大理石地板。教堂外側的聖樓（Scala Santa）相傳是耶穌受審前踏過的二十八級石階，信徒至今仍以跪行方式攀登以示敬虔。聖若望洗者與聖若望宗徒的遺骨據傳亦奉供於此，使此殿成為多重信仰傳統交會的神聖場所。",
    viewerUrl: "san_giovanni",
    panoramaHeading: 270, // 主正面朝東，由廣場向西看
  },
  {
    id: "basilica_assisi",
    name: "聖方濟各大殿",
    nameEn: "Basilica of St. Francis of Assisi",
    location: "亞西西",
    coordinates: [43.0749, 12.6059], // 下方廣場（Piazza Inferiore），朝北看正面
    type: "major",
    founded: 1253,
    dedication: "聖方濟各",
    style: "哥德式、文藝復興",
    significance: "聖方濟各大殿供奉著「清貧的小兄弟」聖方濟各的聖骨，他是天主教歷史上最受愛戴的聖人之一，一生效法基督的謙遜與對受造物的慈悲。此殿是方濟各靈修傳統的源頭與中心，每年吸引數百萬朝聖者，懷著與萬物共融的信仰精神而來。亞西西整座城市被列為世界遺產，而聖方濟各大殿更是其精神核心，象徵貧窮、和平與受造物之愛的基督信仰價值。",
    description: "聖方濟各大殿由上下兩層教堂組成，建於聖人辭世後短短兩年，是中世紀最重要的朝聖地之一。下層教堂以昏黃燈光與拱形壁畫烘托出靜謐神聖的氣氛，聖方濟各的石棺供奉於最深處的地下聖墓。上層教堂以喬托（Giotto）繪製的二十八幅濕壁畫聞名，生動描繪聖人的生平與神蹟，被譽為西方繪畫的里程碑。教堂附近的波爾齊昂古拉小堂（Porziuncola）是聖方濟各最喜愛的祈禱之所，朝聖者可在此感受聖人靈魂最真實的祈禱痕跡。",
    viewerUrl: "assisi",
    panoramaHeading: 0, // 正面朝南，由南側廣場向北看
  },
  {
    id: "santiago_compostela",
    name: "聖地亞哥聖殿",
    nameEn: "Cathedral of Santiago de Compostela",
    location: "西班牙",
    coordinates: [42.5803, -8.5444], // Praza do Obradoiro，朝東看巴洛克正面
    type: "cathedral",
    founded: 1211,
    dedication: "聖地亞哥（聖雅各）",
    style: "羅馬式、巴洛克",
    significance: "聖地亞哥－德孔波斯特拉主教座堂是中世紀三大朝聖地之一，供奉著耶穌宗徒聖雅各的遺骨，是「聖地亞哥之路」（Camino de Santiago）朝聖旅程的終點。數百年來，信眾從法國、葡萄牙、西班牙乃至歐洲各地徒步跋涉，帶著告白、悔罪與更新的心靈走向這座聖殿。完成朝聖之路不僅是信仰的里程碑，更被視為人生旅途的靈性轉化，使此地成為當代最具生命力的朝聖傳統之一。",
    description: "主教座堂的核心建築可追溯至十一至十三世紀的羅馬式時期，外立面於十八世紀改建為壯觀的西班牙巴洛克風格，以雙塔高聳、雕飾繁複著稱。主祭壇後方的「聖人懷抱」（Abrazo）儀式讓朝聖者能親手觸碰聖雅各金像，是朝聖旅程最高潮的信仰體驗。大型香爐「Botafumeiro」在重要禮儀中以繩索高速擺動穿越教堂散發香煙，傳說起源於淨化千里步行而來的朝聖者。地下聖墓保存著聖雅各與兩位門徒的遺骨，是每位完成 Camino 者心中最終極的信仰歸宿。",
    viewerUrl: "santiago",
    panoramaHeading: 90, // Obradoiro 正面朝西，由廣場向東看
  },
  {
    id: "reims_cathedral",
    name: "蘭斯聖母聖殿",
    nameEn: "Reims Cathedral",
    location: "法國",
    coordinates: [49.2534, 4.0334], // 西側廣場，朝東看哥德式正面
    type: "cathedral",
    founded: 1211,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "蘭斯聖母主教座堂是法蘭西王國歷代國王舉行加冕典禮的神聖場所，從克洛維斯一世受洗至查理十世，超過二十五位法王在此接受聖油膏抹，象徵王權由天主賦予。此傳統使教堂成為法國宗教、政治與民族認同的精神根源，聖女貞德護送查理七世於此加冕的事跡更賦予其英勇護國的神聖色彩。教堂本身供奉聖母瑪利亞，眾多天使雕像與「微笑天使」已成為哥德藝術的不朽圖騰。",
    description: "蘭斯主教座堂建造歷時逾百年，是法國哥德式建築的巔峰之作，外牆密佈超過兩千三百座雕像，形成石雕聖經的壯觀景象。西正面三個門廊的雕塑群描繪最後審判、聖母榮冠與歷代主教，細膩的表情被後人稱為「蘭斯微笑」。第一次世界大戰中德軍砲擊重創教堂，使其成為戰爭破壞文明遺產的痛苦見證，戰後的重建象徵法國民族的堅韌與信仰的復甦。教堂內珍藏的彩繪玻璃包括夏卡爾（Marc Chagall）設計的現代彩窗，古典與當代交映成輝。",
    viewerUrl: "reims",
    panoramaHeading: 90, // 正面朝西，由西廣場向東看
  },
  {
    id: "chartres_cathedral",
    name: "沙特爾聖母聖殿",
    nameEn: "Chartres Cathedral",
    location: "法國",
    coordinates: [48.4431, 1.4876], // 西側廣場，朝東看雙尖塔正面
    type: "cathedral",
    founded: 1220,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "沙特爾主教座堂珍藏著「聖母的面紗」（Voile de la Vierge），相傳是聖母瑪利亞親自穿戴之聖衣，自九世紀起成為西歐最重要的朝聖地之一，吸引包括法王在內的無數信眾前來朝拜。此殿被認為是中世紀哥德建築神學的完美體現，設計本身即是「光的神學」的詮釋：光線透過彩繪玻璃窗灑落，象徵天主聖光照耀世界的啟示。教堂曾多次逃過戰火，信徒視之為聖母特別庇護的奇蹟，更加深了此地的神聖性。",
    description: "沙特爾主教座堂以一百七十六扇彩繪玻璃聞名於世，其中「沙特爾藍」色澤深邃神秘，工藝至今已失傳，成為中世紀基督教藝術的獨特遺產。教堂地面的迷宮（Labyrinth）直徑十二點八公尺，是中世紀朝聖者以跪行代替前往耶路撒冷的靈修方式，至今仍供信眾默觀行走。兩座尖塔風格迥異，南塔為純粹羅馬式，北塔後加火焰哥德式，形成建築歷史的直觀對話。每年各地朝聖者齊聚此地，以三日徒步完成「沙特爾大學生朝聖」，成為當代最大規模的傳統朝聖活動之一。",
    viewerUrl: "chartres",
    panoramaHeading: 90, // 正面朝西，由西廣場向東看
  },
  {
    id: "notre_dame_paris",
    name: "巴黎聖母院",
    nameEn: "Notre-Dame de Paris",
    location: "法國",
    coordinates: [48.8530, 2.3486], // Parvis Notre-Dame，朝東看西正面
    type: "cathedral",
    founded: 1345,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "巴黎聖母院不僅是法蘭西民族信仰與文化的象徵，更是歷代法國人共同歷史記憶的核心——拿破崙在此加冕、聖女貞德平反典禮在此舉行、兩次世界大戰勝利感恩彌撒於此進行。此殿以「巴黎聖母」（Notre-Dame de Paris）之名，成為這座城市精神生命的守護者，無論戰時或和平，信徒總回到此地尋求力量與感恩。2019 年的大火震驚全球，世人齊聚為此殿祈禱，更彰顯了她在全人類心中的神聖地位與永恆意義。",
    description: "巴黎聖母院是哥德式建築的奠基典範，始建於 1163 年，以飛扶壁結構支撐高聳薄牆，使光線得以穿透三扇玫瑰窗灑入，形成流光溢彩的神聖空間。正面雕塑描繪最後審判與聖母榮冠，三個門廊層層疊疊，宛如一部石刻的聖經。雨果的小說《鐘樓怪人》使她成為文學中永恆的角色，鐘樓怪人的形象成為人性掙扎與靈魂救贖的象徵。2019 年火災後法國政府啟動史上最大規模的文化遺產修復工程，2024 年重新開放，成為信仰不息的見證。",
    viewerUrl: "notre_dame",
    panoramaHeading: 90, // 正面朝西，由 Parvis 向東看
  },
  {
    id: "cologne_cathedral",
    name: "科隆大教堂",
    nameEn: "Cologne Cathedral",
    location: "德國",
    coordinates: [50.9413, 6.9572], // 西側 Domplatte，朝東看雙塔正面
    type: "cathedral",
    founded: 1322,
    dedication: "聖母瑪利亞及聖王",
    style: "德國哥德式",
    significance: "科隆大教堂供奉著「東方三博士」（聖三王）的遺骨，相傳他們是最早朝拜聖嬰耶穌的異邦賢人，其遺骨在十二世紀從米蘭移至此地，立即引發中世紀歐洲最大規模的朝聖熱潮。三王聖骨匣是現存最大的中世紀金工藝術品，每年成千上萬的信眾前來尋求三王的代禱，祈求智慧、啟示與信仰的引導。科隆大教堂的建造跨越六個世紀，成為普世教會對信仰的頑強堅持與奉獻的最佳詮釋。",
    description: "科隆大教堂從 1248 年奠基，至 1880 年才正式竣工，歷時六百三十二年，是世界建築史上耗時最長的工程之一。雙塔高達一百五十七公尺，竣工之際短暫榮登世界最高建築，雄偉的高度成為信仰指向天堂的視覺宣言。教堂內珍藏的三王聖骨匣以黃金、寶石與精細浮雕打造，是哥德式金工藝術的極致代表。二次大戰中科隆市區幾乎夷為平地，而教堂雖受多次砲擊卻奇蹟般地大體屹立，信徒視之為天主特別保護的見證，戰後成為德國重建與和解的精神象徵。",
    viewerUrl: "cologne",
    panoramaHeading: 110, // 正面略朝西南，由西北廣場朝東南看
  },
  {
    id: "jingxin_chapel_fujen",
    name: "輔仁大學淨心堂",
    nameEn: "Jingxin Chapel, Fujen University",
    location: "台灣、新北市、新莊",
    coordinates: [25.0324, 121.4286],
    type: "chapel",
    founded: 1961,
    dedication: "聖母與聖若望",
    style: "現代教堂建築",
    significance: "淨心堂是輔仁大學校園的精神心臟，承載著天主教高等教育「信仰與理智並重」的核心使命，在學術殿堂中為師生提供靜默祈禱、領受聖事與信仰滋養的神聖空間。作為台灣少數設於大學校園內的天主教堂，淨心堂見證了數十年來無數學生在求知路上的信仰抉擇與生命成長，陪伴一代又一代年輕人在知識追尋中尋找終極真理。教堂供奉聖母與聖若望，象徵在十字架腳下彼此陪伴、共同領受使命的精神，呼應輔仁大學「真、善、美、聖」的辦學理念。",
    description: "淨心堂座落於輔仁大學校園的中心位置，每日開放彌撒與靜默祈禱，是師生在繁忙課業之餘尋求心靈安頓的場所。教堂建築融合現代設計與宗教美學，簡潔而莊重，外觀低調卻充滿靜謐安祥的氛圍。堂內設有聖母像與各式宗教藝術，歷年來由輔大各學系師生共同參與裝飾，將信仰與藝術才華融為一體。每逢學年初、聖誕節與復活節等重要時節，淨心堂舉辦各類靈修活動與感恩彌撒，凝聚全校天主教與非天主教信徒共同回應信仰的呼召。",
    viewerUrl: "jingxin",
    panoramaHeading: 180, // 正面朝北，由南側向北看
  },
  {
    id: "holy_sepulchre",
    name: "聖墓教堂",
    nameEn: "Church of the Holy Sepulchre",
    location: "耶路撒冷",
    coordinates: [31.7784, 35.2296], // 入口前廣場（Parvis），朝北看雙門正面
    type: "chapel",
    founded: 335,
    dedication: "耶穌基督的復活",
    style: "拜占庭式、哥德式",
    significance: "聖墓教堂是基督信仰最神聖的地點之一，傳統上認定為耶穌受難、被葬埋及三日後復活的所在地，即基督信仰核心神蹟的發生處。此地對天主教、東正教、亞美尼亞使徒教會等多個基督宗派皆具至高的朝聖意義，每年吸引來自全球數百萬信徒前來朝拜，在此祈禱、懺悔並體驗基督受難的救贖奧秘。教堂所在地又稱「各各他」（Golgotha）或「髑髏地」，是每位基督信徒信仰旅程中最渴望親臨的終極聖地。",
    description: "聖墓教堂內部包含多個重要的朝聖景點：各各他山岩（釘十字架之處）、受膏石（為耶穌遺體膏抹香料之所）、聖墓亭（空墳墓所在），以及科普特正教的祭壇。教堂的管理由六個基督教派共同持守，包括希臘正教會、天主教方濟各會、亞美尼亞使徒教會、科普特教會、衣索比亞正教會與敘利亞正教會，各自維護特定區域，展現基督宗教多元而合一的朝聖傳統。每年復活節前夕的「聖火奇蹟」（Holy Fire）儀式在此舉行，信徒相信從墓石中湧現的神聖之火具有奇特性質，吸引全球信眾齊聚見證。",
    viewerUrl: "holy_sepulchre",
    panoramaHeading: 0, // 入口朝南，由南側廣場向北看正面
  },
  {
    id: "church_of_the_nativity",
    name: "聖誕教堂",
    nameEn: "Church of the Nativity",
    location: "伯利恆",
    coordinates: [31.7053, 35.2025], // Manger Square，朝南看謙遜之門正面
    type: "chapel",
    founded: 339,
    dedication: "耶穌的誕生",
    style: "羅馬式、拜占庭式",
    significance: "聖誕教堂是基督宗教最古老且現存最完整的建築之一，標誌著耶穌基督降生的傳統地點，即《路加福音》中「馬槽」所在的伯利恆山洞。對天主教、東正教與新教信徒而言，此地是信仰起源的聖地，也是聖誕節靈修的精神源頭，親臨此地等同於踏上降生奧蹟的旅程。每年聖誕夜，伯利恆馬槽廣場（Manger Square）聚集來自全球的信徒，唱詩共慶，延續兩千年來不曾中斷的聖誕禮讚。",
    description: "聖誕教堂由君士坦丁大帝的母親聖赫勒拿（St. Helena）下令建於西元 339 年，並在查士丁尼一世時代大規模重建，是現存仍在使用中最古老的基督教教堂之一。教堂入口「謙遜之門」（Door of Humility）刻意縮小至僅 1.2 公尺高，信徒需彎腰入內，象徵在聖嬰面前的謙卑。地板下方保留了拜占庭時期的精美馬賽克鑲嵌畫，是研究早期基督教藝術的珍貴資料。星光洞（Grotto of the Nativity）地板上的銀星刻有拉丁文「Hic de Virgine Maria Iesus Christus natus est」（耶穌基督在此由童貞女瑪利亞降生），供信眾俯身親吻、默禱。",
    viewerUrl: "nativity",
    panoramaHeading: 180, // 入口朝北，由 Manger Square 向南看
  },
  {
    id: "annunciation_church",
    name: "聖母領報堂",
    nameEn: "Basilica of the Annunciation",
    location: "拿撒勒",
    coordinates: [32.7034, 35.2968], // 北側廣場，朝南看現代圓頂正面
    type: "chapel",
    founded: 1969,
    dedication: "聖母領報",
    style: "現代主義",
    significance: "聖母領報堂坐落於拿撒勒，是天使加百列向童貞女瑪利亞宣告她將懷孕誕生救主的傳統地點，這一「天主降凡」（Incarnation）的奧蹟是整個基督信仰的核心事件。此地標誌著救贖歷史的轉折點，瑪利亞的「是的」（Fiat）回應改變了整個人類命運，使此殿成為朝聖者靜思信德與順命意義的靈修場所。教堂更是全球各地敬禮聖母傳統的源頭，其地位在聖地諸殿中無可替代。",
    description: "現今的聖母領報堂建於 1969 年，是中東地區規模最大的天主教教堂，由義大利建築師喬凡尼·穆齊奧設計，圓頂以象徵聖母的百合花造型裝飾，典雅而現代。教堂分為上下兩層：下層直接建於古代聖母故居的洞窟遺址上，保存了拜占庭與十字軍時期的建築層次；上層聖殿四周的牆壁裝飾著來自世界各地數十幅聖母像，是一場跨越文化的信仰藝術大展。朝聖者可俯身進入下層洞窟，親臨傳統上認為天使顯現之處，在燭光與靜默中深刻體驗領報奧蹟的臨在。",
    viewerUrl: "annunciation",
    panoramaHeading: 180, // 正面朝北，由北廣場向南看
  },
  {
    id: "multiplication_church",
    name: "五餅二魚堂",
    nameEn: "Church of the Multiplication",
    location: "塔布加，加利利海",
    coordinates: [32.8771, 35.5694],
    type: "chapel",
    founded: 350,
    dedication: "耶穌行五餅二魚奇蹟",
    style: "拜占庭式",
    significance: "五餅二魚堂紀念的是《福音書》中耶穌以五個大麥餅和兩條魚在此地餵飽五千人的神蹟，這一事件被解讀為基督慷慨給予、與眾人分享生命糧食的宗教行動。此奇蹟直接預示了聖體聖事（感恩祭）的神學意義，使此地不僅是歷史景點，更是每次望彌撒的靈修起點。加利利海岸的自然風光與此處田園般的靜謐，為朝聖者帶來與耶穌並肩同行的臨場感。",
    description: "五餅二魚堂為拜占庭風格教堂，最早建於西元四世紀，現存建築重建於 1982 年，由德國本篤會修士負責管理。教堂最珍貴的文物是地板上保存完好的五世紀拜占庭馬賽克，描繪魚籃、鳥類與加利利湖畔的自然景色，被視為以色列境內最精美的早期基督教馬賽克之一。祭壇下方的石盤被認為是耶穌放置餅與魚的奇蹟之石，至今信眾仍在此祈禱，感謝天主的慷慨供養。教堂旁即為加利利海（提比利亞湖），湖光山色與福音場景合而為一，令朝聖者心生靜默感恩。",
    viewerUrl: "multiplication",
    panoramaHeading: 90, // 正面朝西，由東側入口廣場向西看
  },
  {
    id: "st_peter_gallicantu",
    name: "雞鳴堂",
    nameEn: "St. Peter in Gallicantu",
    location: "耶路撒冷",
    coordinates: [31.7700, 35.2295], // 錫安山坡道，朝北看現代教堂正面
    type: "chapel",
    founded: 1931,
    dedication: "聖伯多祿的三次不認主",
    style: "拜占庭復興式",
    significance: "雞鳴堂記念的是彼得三次否認認識耶穌後雞鳴啼叫、悔淚痛哭的聖經場景，對基督信徒而言，此地是悔罪、軟弱與重新起立的靈修核心。彼得的跌倒與復原正是教會信仰的縮影：即使軟弱背棄，天主仍施恩召喚歸回，使此地成為告解聖事與靈魂更新的深刻象徵。此處亦相傳是耶穌被捕後短暫被羈押的大司祭該亞法宮殿，使整個受難歷程得以在此地深度連結與默禱。",
    description: "雞鳴堂建於 1931 年，由聖母聖心會（Assumptionists）負責管理，以拜占庭復興風格融合耶路撒冷石材的暖色調，在錫安山坡地上形成莊嚴而和諧的視覺。教堂地下層保留了考古發掘的古羅馬宮殿遺址，包括拘留室、石鑿水槽與「鷹嘴石」，據傳是耶穌被捆綁懸吊的石孔。教堂外設有彼得痛哭的銅雕，信眾至此常駐足默想背叛與悔罪的奧秘。每逢受難週，此地舉辦特別的「受難之路」（Via Crucis）禮儀，讓朝聖者在耶穌真實走過的地方重走信仰的路。",
    viewerUrl: "gallicantu",
    panoramaHeading: 30, // 正面朝西北，由東南坡道向西北看
  }
];

async function uploadBasilicas() {
  try {
    console.log('開始上傳教堂資料...');
    for (const basilica of BASILICAS) {
      const { id, ...data } = basilica; // 移除id，因為Firestore會自動生成
      await db.collection('basilicas').add(data);
      console.log(`已上傳: ${basilica.name}`);
    }
    console.log('所有教堂資料上傳完成！');
  } catch (error) {
    console.error('上傳失敗:', error);
  }
}

uploadBasilicas();