#include "pf_ui.h"

#include <stdint.h>

#include "board_com_api.h"
#include "lv_vendor.h"
#include "lvgl.h"
#include "pf_camera.h"
#include "pf_demo_runtime_config.h"
#include "pf_input.h"
#include "tal_api.h"
#include "tal_image.h"

LV_FONT_DECLARE(pf_font_names_16);

#define PF_UI_WIDTH          320
#define PF_UI_HEIGHT         480
#define PF_UI_TOUCH_TARGET   64
#define PF_UI_PRIMARY_WIDTH  272
#define PF_UI_PRIMARY_HEIGHT 72
#define PF_UI_PINYIN_CAND_WIDTH  304
#define PF_UI_PINYIN_CAND_HEIGHT 52
#define PF_UI_PAGE_COUNT     ((uint8_t)PF_UI_PAGE_WIFI_CONNECT + 1U)

#define PF_UI_COLOR_BG       0x111827U
#define PF_UI_COLOR_SURFACE  0x1F2937U
#define PF_UI_COLOR_PRIMARY  0x2563EBU
#define PF_UI_COLOR_ACCENT   0xF97316U
#define PF_UI_COLOR_TEXT     0xF8FAFCU
#define PF_UI_COLOR_MUTED    0xCBD5E1U
#define PF_UI_COLOR_SUCCESS  0x22C55EU
#define PF_UI_COLOR_ERROR    0xDC2626U

/* Pocket Friend brand palette (320x480 / ILI9488) */
#define PF_UI_COLOR_SKY        0x0091FFU
#define PF_UI_COLOR_LIME       0xC8FF00U
#define PF_UI_COLOR_CYAN       0x00E5FFU
#define PF_UI_COLOR_PINK       0xFF2D9BU
#define PF_UI_COLOR_NIGHT      0x0A1030U
#define PF_UI_COLOR_INK        0x000000U
#define PF_UI_COLOR_SLEEP_TXT  0xA8C4FFU
#define PF_UI_COLOR_PET        0x1A4A9AU
#define PF_UI_COLOR_DEVICE_DIM 0x3A6A20U

typedef struct {
    lv_obj_t *pages[PF_UI_PAGE_COUNT];
    lv_obj_t *preview_canvas;
    lv_obj_t *result_image;
    lv_obj_t *peer_label;
    lv_obj_t *match_status_label;
    lv_obj_t *waiting_status_label;
    lv_obj_t *countdown_label;
    lv_obj_t *preview_countdown_label;
    lv_obj_t *error_label;
    lv_obj_t *wifi_status_label;
    lv_obj_t *wifi_list;
    lv_obj_t *wifi_scan_status;
    lv_obj_t *wifi_ssid_label;
    lv_obj_t *wifi_password;
    lv_obj_t *wifi_keyboard;
    lv_obj_t *wifi_connect_label;
    lv_obj_t *wifi_retry_button;
    lv_obj_t *photo_name_textarea;
    lv_obj_t *photo_name_keyboard;
    lv_obj_t *photo_name_ime;
    lv_obj_t *pinyin_textarea;
    lv_obj_t *pinyin_keyboard;
    lv_obj_t *pinyin_ime;
} PF_UI_OBJECTS_T;

static PF_UI_OBJECTS_T sg_ui;
static MUTEX_HANDLE sg_preview_mutex = NULL;
static uint8_t *sg_preview_buffer = NULL;
static uint8_t *sg_preview_pending = NULL;
static uint8_t *sg_result_buffer = NULL;
static lv_image_dsc_t sg_result_descriptor;
static bool sg_ui_initialized = false;
static bool sg_ui_started = false;

static lv_pinyin_dict_t sg_pinyin_name_dict[] = {
    {"a", "安昂奥"},
    {"ai", "爱艾"},
    {"an", "安岸桉"},
    {"ao", "奥傲"},
    {"ba", "巴柏霸"},
    {"bai", "白柏百"},
    {"ban", "班斑"},
    {"bao", "宝保堡葆"},
    {"bei", "贝蓓北备"},
    {"ben", "本"},
    {"bi", "碧璧必毕"},
    {"bian", "边卞"},
    {"biao", "彪标"},
    {"bin", "斌滨彬宾"},
    {"bing", "冰兵炳秉"},
    {"bo", "博伯波柏泊"},
    {"bu", "布步"},
    {"cai", "才采彩蔡"},
    {"can", "灿璨"},
    {"cao", "曹"},
    {"ce", "策"},
    {"cen", "岑"},
    {"ceng", "曾"},
    {"cha", "查茶"},
    {"chai", "柴"},
    {"chan", "婵禅蝉"},
    {"chang", "昌畅长常嫦"},
    {"chao", "超朝潮"},
    {"chen", "陈晨辰宸琛尘臣忱"},
    {"cheng", "成诚城程承澄橙盛"},
    {"chi", "驰池迟炽"},
    {"chong", "崇冲充"},
    {"chu", "楚初储"},
    {"chuan", "川传荃"},
    {"chun", "春纯淳"},
    {"ci", "慈辞"},
    {"cong", "聪丛琮"},
    {"cu", "促"},
    {"cui", "崔翠璀"},
    {"cun", "存"},
    {"cuo", "措"},
    {"da", "达大妲"},
    {"dai", "黛岱戴代"},
    {"dan", "丹单淡旦"},
    {"dang", "党"},
    {"dao", "道岛"},
    {"de", "德得"},
    {"deng", "邓登灯"},
    {"di", "迪笛蒂帝娣"},
    {"dian", "典点滇"},
    {"diao", "雕"},
    {"ding", "丁鼎定"},
    {"dong", "东栋冬董彤"},
    {"dou", "豆窦"},
    {"du", "杜渡都笃"},
    {"duan", "段端"},
    {"dui", "兑"},
    {"duo", "朵铎多"},
    {"e", "娥峨鄂"},
    {"en", "恩"},
    {"er", "尔二洱"},
    {"fa", "发法"},
    {"fan", "凡帆梵樊范繁"},
    {"fang", "方芳访放"},
    {"fei", "飞菲斐霏非"},
    {"fen", "芬奋粉"},
    {"feng", "峰锋枫凤丰风"},
    {"fo", "佛"},
    {"fu", "福富芙甫复付傅符"},
    {"ga", "伽"},
    {"gai", "盖"},
    {"gan", "甘淦"},
    {"gang", "刚钢港"},
    {"gao", "高皋"},
    {"ge", "歌格葛戈革"},
    {"gen", "根"},
    {"geng", "耿庚"},
    {"gong", "功公龚恭"},
    {"gou", "构"},
    {"gu", "古谷顾固"},
    {"gua", "卦"},
    {"guan", "关冠观莞"},
    {"guang", "光广"},
    {"gui", "贵桂归瑰"},
    {"guo", "国果郭过"},
    {"hai", "海亥"},
    {"han", "涵寒汉翰晗韩菡瀚"},
    {"hang", "航杭"},
    {"hao", "浩昊豪皓灏好"},
    {"he", "和河禾何贺赫荷"},
    {"hei", "黑"},
    {"hen", "恒"},
    {"heng", "恒衡珩"},
    {"hong", "宏红洪鸿虹弘"},
    {"hou", "侯厚"},
    {"hu", "虎湖胡护沪"},
    {"hua", "华花桦化画"},
    {"huan", "欢环桓焕奂"},
    {"huang", "黄煌凰晃"},
    {"hui", "慧辉惠会徽晖绘"},
    {"hun", "浑"},
    {"huo", "霍火"},
    {"ji", "吉佳季姬济基纪继霁骥冀己极记"},
    {"jia", "佳嘉家加甲珈迦"},
    {"jian", "建健剑坚简见谦俭荐鉴"},
    {"jiang", "江姜蒋疆将"},
    {"jiao", "娇骄皎教焦姣"},
    {"jie", "杰洁捷婕姐介"},
    {"jin", "金锦瑾晋津谨劲"},
    {"jing", "静晶京景靖敬菁璟镜竞"},
    {"jiong", "炯"},
    {"jiu", "久玖九"},
    {"ju", "菊居举炬钧"},
    {"juan", "娟隽绢"},
    {"jue", "觉珏爵"},
    {"jun", "俊君军钧峻骏筠郡竣"},
    {"ka", "卡"},
    {"kai", "凯开楷恺"},
    {"kan", "侃"},
    {"kang", "康慷"},
    {"kao", "考"},
    {"ke", "可科珂克柯轲"},
    {"ken", "垦"},
    {"kong", "孔空"},
    {"kou", "寇"},
    {"ku", "酷"},
    {"kua", "夸"},
    {"kuai", "快"},
    {"kuan", "宽"},
    {"kui", "奎葵魁"},
    {"kun", "坤昆琨"},
    {"kuo", "阔"},
    {"la", "拉"},
    {"lai", "来莱"},
    {"lan", "兰岚蓝澜"},
    {"lang", "朗浪郎"},
    {"lao", "老"},
    {"le", "乐勒"},
    {"lei", "磊蕾雷垒"},
    {"leng", "冷"},
    {"li", "丽莉立力利黎理礼李璃俪励"},
    {"lian", "莲连廉恋"},
    {"liang", "良亮梁凉"},
    {"liao", "辽廖"},
    {"lie", "烈"},
    {"lin", "琳林霖麟临淋"},
    {"ling", "玲灵凌岭苓龄"},
    {"liu", "柳刘流琉"},
    {"long", "龙隆"},
    {"lou", "楼娄"},
    {"lu", "路露璐鲁陆鹿禄"},
    {"luan", "鸾峦"},
    {"lun", "伦仑"},
    {"luo", "洛罗骆落"},
    {"lv", "吕旅律"},
    {"ma", "马玛"},
    {"mai", "麦"},
    {"man", "曼满漫"},
    {"mang", "芒"},
    {"mao", "茂懋毛"},
    {"mei", "美梅枚媚玫"},
    {"men", "门"},
    {"meng", "梦萌蒙孟"},
    {"mi", "米弥蜜"},
    {"mian", "绵勉"},
    {"miao", "苗淼妙"},
    {"min", "敏民闵珉"},
    {"ming", "明铭鸣名"},
    {"miu", "谬"},
    {"mo", "墨默茉莫"},
    {"mou", "牟"},
    {"mu", "慕牧穆木沐"},
    {"na", "娜纳"},
    {"nai", "乃"},
    {"nan", "楠南男"},
    {"nang", "囊"},
    {"nao", "瑙"},
    {"ne", "呢"},
    {"nei", "内"},
    {"nen", "嫩"},
    {"neng", "能"},
    {"ni", "妮倪霓"},
    {"nian", "年念"},
    {"niang", "娘"},
    {"niao", "鸟"},
    {"nie", "聂"},
    {"nin", "宁"},
    {"ning", "宁凝柠"},
    {"niu", "牛钮"},
    {"nong", "农侬"},
    {"nu", "努"},
    {"nv", "女"},
    {"nuo", "诺娜"},
    {"o", "欧"},
    {"ou", "欧鸥"},
    {"pa", "帕"},
    {"pai", "派"},
    {"pan", "盼潘攀"},
    {"pang", "庞"},
    {"pao", "跑"},
    {"pei", "佩培沛裴"},
    {"pen", "盆"},
    {"peng", "鹏朋彭澎"},
    {"pi", "丕霹"},
    {"pian", "翩"},
    {"piao", "飘"},
    {"pin", "品"},
    {"ping", "平萍苹屏"},
    {"po", "珀"},
    {"pu", "璞普蒲"},
    {"qi", "琪琦启祺齐奇淇棋麒其"},
    {"qia", "恰"},
    {"qian", "倩千谦乾芊茜前骞"},
    {"qiang", "强蔷羌"},
    {"qiao", "乔巧桥俏峤"},
    {"qie", "洁"},
    {"qin", "琴钦勤沁秦"},
    {"qing", "清晴庆卿青擎"},
    {"qiong", "琼穹"},
    {"qiu", "秋丘邱"},
    {"qu", "曲渠屈"},
    {"quan", "全泉权铨"},
    {"que", "雀阙"},
    {"qun", "群裙"},
    {"ran", "然冉"},
    {"rang", "让"},
    {"rao", "饶"},
    {"ren", "仁任壬"},
    {"reng", "仍"},
    {"ri", "日"},
    {"rong", "荣蓉容榕"},
    {"rou", "柔"},
    {"ru", "如茹儒"},
    {"ruan", "阮"},
    {"rui", "瑞睿锐蕊"},
    {"run", "润"},
    {"ruo", "若"},
    {"sa", "萨"},
    {"sai", "赛"},
    {"san", "三散"},
    {"sang", "桑"},
    {"sao", "韶"},
    {"se", "瑟"},
    {"sen", "森"},
    {"seng", "僧"},
    {"sha", "莎沙煞"},
    {"shan", "珊善山杉姗闪"},
    {"shang", "尚商上"},
    {"shao", "绍邵少韶"},
    {"she", "舍"},
    {"shen", "沈申深慎绅莘"},
    {"sheng", "胜盛圣生晟笙"},
    {"shi", "诗世士石时实史师施识仕适始是事狮舒释拾十誓氏市势柿"},
    {"shou", "守寿"},
    {"shu", "书淑舒树姝叔曙"},
    {"shua", "帅"},
    {"shuai", "帅"},
    {"shuan", "栓"},
    {"shuang", "爽双霜"},
    {"shui", "水"},
    {"shun", "顺舜"},
    {"shuo", "硕烁朔"},
    {"si", "思斯司丝姒"},
    {"song", "松颂宋"},
    {"sou", "搜"},
    {"su", "苏素肃"},
    {"suan", "酸"},
    {"sui", "隋穗遂"},
    {"sun", "孙荪"},
    {"suo", "索"},
    {"ta", "塔"},
    {"tai", "泰太台"},
    {"tan", "谭潭檀坦"},
    {"tang", "唐棠堂糖"},
    {"tao", "涛陶桃韬"},
    {"te", "特"},
    {"teng", "腾藤滕"},
    {"ti", "提高体"},
    {"tian", "天甜田恬添"},
    {"tiao", "眺"},
    {"tie", "铁"},
    {"ting", "婷庭廷亭霆"},
    {"tong", "彤桐童同潼"},
    {"tou", "透"},
    {"tu", "图涂"},
    {"tuan", "团"},
    {"tui", "退"},
    {"tun", "屯"},
    {"tuo", "拓托"},
    {"wa", "娃"},
    {"wai", "外"},
    {"wan", "婉万琬晚莞"},
    {"wang", "王望旺"},
    {"wei", "伟威薇维玮炜唯蔚魏卫"},
    {"wen", "文雯闻温稳"},
    {"weng", "翁"},
    {"wo", "沃"},
    {"wu", "武舞吴梧伍吾悟"},
    {"xi", "希熙溪曦夕西喜惜玺锡"},
    {"xia", "夏霞侠"},
    {"xian", "贤娴宪仙显先纤"},
    {"xiang", "翔香湘祥向相"},
    {"xiao", "晓笑小潇萧孝"},
    {"xie", "谢协洁颉"},
    {"xin", "欣鑫心新芯信馨昕歆"},
    {"xing", "星兴杏行邢"},
    {"xiong", "雄熊"},
    {"xiu", "秀修绣"},
    {"xu", "旭徐许序叙"},
    {"xuan", "轩萱璇玄宣"},
    {"xue", "雪学薛玥"},
    {"xun", "迅勋寻洵"},
    {"ya", "雅亚娅"},
    {"yan", "妍艳彦燕岩言延炎雁琰"},
    {"yang", "阳洋杨扬央"},
    {"yao", "瑶姚耀尧遥"},
    {"ye", "叶烨野业"},
    {"yi", "一依怡逸奕艺亦宜毅义伊仪忆益熠易"},
    {"yin", "音银茵寅尹殷"},
    {"ying", "颖莹英樱盈影迎"},
    {"yong", "勇永咏雍"},
    {"you", "友优佑悠宥"},
    {"yu", "宇雨玉语钰昱瑜羽煜禹予誉郁俞"},
    {"yuan", "媛源远元圆苑袁缘"},
    {"yue", "悦玥越岳月跃"},
    {"yun", "云芸韵允运"},
    {"za", "杂"},
    {"zai", "载"},
    {"zan", "赞"},
    {"zang", "臧"},
    {"zao", "早"},
    {"ze", "泽则择"},
    {"zei", "贼"},
    {"zen", "怎"},
    {"zeng", "曾增"},
    {"zha", "查札"},
    {"zhai", "翟"},
    {"zhan", "展湛占瞻"},
    {"zhang", "张章璋彰掌"},
    {"zhao", "赵昭兆照"},
    {"zhe", "哲喆者浙"},
    {"zhen", "珍真振臻贞祯"},
    {"zheng", "正政郑征峥铮"},
    {"zhi", "志智芝芷治之知致"},
    {"zhong", "中忠钟仲"},
    {"zhou", "周洲舟宙"},
    {"zhu", "朱竹珠祝著柱"},
    {"zhua", "爪"},
    {"zhuai", "拽"},
    {"zhuan", "专传"},
    {"zhuang", "庄壮"},
    {"zhui", "追"},
    {"zhun", "准"},
    {"zhuo", "卓灼拙"},
    {"zi", "子梓紫姿自"},
    {"zong", "宗综"},
    {"zou", "邹"},
    {"zu", "祖足"},
    {"zuan", "钻"},
    {"zui", "最"},
    {"zun", "尊"},
    {"zuo", "左佐作"},
    {NULL, NULL},
};

static void pf_ui_wifi_ap_cb(lv_event_t *event)
{
    uint8_t index = (uint8_t)(uintptr_t)lv_event_get_user_data(event);
    pf_input_post_wifi_from_ui(PF_INPUT_WIFI_SELECT, index, NULL);
}

static void pf_ui_wifi_connect_cb(lv_event_t *event)
{
    const char *password = lv_textarea_get_text(sg_ui.wifi_password);
    (void)event;
    pf_input_post_wifi_from_ui(PF_INPUT_WIFI_CONNECT, 0U, password);
    lv_textarea_set_text(sg_ui.wifi_password, "");
}

static void pf_ui_wifi_visibility_cb(lv_event_t *event)
{
    bool hidden = lv_textarea_get_password_mode(sg_ui.wifi_password);
    (void)event;
    lv_textarea_set_password_mode(sg_ui.wifi_password, !hidden);
}

static void pf_ui_pinyin_clear_cb(lv_event_t *event)
{
    (void)event;
    lv_textarea_set_text(sg_ui.pinyin_textarea, "");
}

static void pf_ui_photo_name_submit_cb(lv_event_t *event)
{
    const char *name = lv_textarea_get_text(sg_ui.photo_name_textarea);
    (void)event;
    pf_input_post_text_from_ui(PF_INPUT_PHOTO_NAME_SUBMIT, name);
    lv_textarea_set_text(sg_ui.photo_name_textarea, "");
}

static void pf_ui_photo_name_clear_cb(lv_event_t *event)
{
    (void)event;
    lv_textarea_set_text(sg_ui.photo_name_textarea, "");
}

static void pf_ui_button_cb(lv_event_t *event)
{
    PF_INPUT_ACTION_E action =
        (PF_INPUT_ACTION_E)(uintptr_t)lv_event_get_user_data(event);

    pf_input_post_from_ui(action);
}

static lv_obj_t *pf_ui_create_page(const char *title)
{
    lv_obj_t *page = lv_obj_create(NULL);
    lv_obj_t *label = lv_label_create(page);

    lv_obj_set_size(page, PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(page, lv_color_hex(PF_UI_COLOR_BG), 0);
    lv_obj_set_style_border_width(page, 0, 0);
    lv_obj_set_style_pad_all(page, 0, 0);
    lv_obj_clear_flag(page, LV_OBJ_FLAG_SCROLLABLE);

    lv_label_set_text(label, title);
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_TEXT), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_24, 0);
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 28);
    return page;
}

static lv_obj_t *pf_ui_create_label(lv_obj_t *parent, const char *text,
                                    lv_align_t align, int32_t x, int32_t y)
{
    lv_obj_t *label = lv_label_create(parent);

    lv_label_set_text(label, text);
    lv_label_set_long_mode(label, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(label, PF_UI_PRIMARY_WIDTH);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_MUTED), 0);
    lv_obj_align(label, align, x, y);
    return label;
}

static lv_obj_t *pf_ui_create_button(lv_obj_t *parent, const char *text,
                                     PF_INPUT_ACTION_E action,
                                     uint32_t color, bool compact)
{
    lv_obj_t *button = lv_btn_create(parent);
    lv_obj_t *label = lv_label_create(button);

    if (compact) {
        lv_obj_set_size(button, PF_UI_TOUCH_TARGET, PF_UI_TOUCH_TARGET);
    } else {
        lv_obj_set_size(button, PF_UI_PRIMARY_WIDTH, PF_UI_PRIMARY_HEIGHT);
    }
    lv_obj_set_style_bg_color(button, lv_color_hex(color), 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_70,
                            LV_PART_MAIN | LV_STATE_PRESSED);
    lv_obj_set_style_radius(button, 8, 0);
    lv_obj_set_style_shadow_width(button, 0, 0);
    lv_obj_add_event_cb(button, pf_ui_button_cb, LV_EVENT_CLICKED,
                        (void *)(uintptr_t)action);

    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_TEXT), 0);
    lv_obj_center(label);
    return button;
}

static void pf_ui_style_pinyin_candidate_panel(lv_obj_t *cand_panel)
{
    lv_obj_set_style_bg_color(cand_panel, lv_color_white(), 0);
    lv_obj_set_style_bg_opa(cand_panel, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(cand_panel, 8, 0);
    lv_obj_set_style_pad_all(cand_panel, 4, 0);
    lv_obj_set_style_pad_gap(cand_panel, 0, 0);
    lv_obj_set_style_text_color(cand_panel, lv_color_black(), 0);
    lv_obj_set_style_text_font(cand_panel, &pf_font_names_16, 0);
}

static lv_obj_t *pf_ui_create_blank_page(uint32_t bg_color)
{
    lv_obj_t *page = lv_obj_create(NULL);

    lv_obj_set_size(page, PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(page, lv_color_hex(bg_color), 0);
    lv_obj_set_style_border_width(page, 0, 0);
    lv_obj_set_style_pad_all(page, 0, 0);
    lv_obj_clear_flag(page, LV_OBJ_FLAG_SCROLLABLE);
    return page;
}

static lv_obj_t *pf_ui_draw_pet_device(lv_obj_t *parent, bool asleep)
{
    lv_obj_t *body;
    lv_obj_t *screen;
    lv_obj_t *pet;
    lv_obj_t *btn;
    int16_t i;

    body = lv_obj_create(parent);
    lv_obj_set_size(body, 132, 168);
    lv_obj_set_style_radius(body, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(body,
                              lv_color_hex(asleep ? PF_UI_COLOR_DEVICE_DIM
                                                  : PF_UI_COLOR_LIME),
                              0);
    lv_obj_set_style_border_color(body, lv_color_hex(PF_UI_COLOR_INK), 0);
    lv_obj_set_style_border_width(body, 4, 0);
    lv_obj_set_style_shadow_width(body, 0, 0);
    lv_obj_set_style_pad_all(body, 0, 0);
    lv_obj_clear_flag(body, LV_OBJ_FLAG_SCROLLABLE);

    screen = lv_obj_create(body);
    lv_obj_set_size(screen, 64, 56);
    lv_obj_align(screen, LV_ALIGN_TOP_MID, 0, 36);
    lv_obj_set_style_radius(screen, 2, 0);
    lv_obj_set_style_bg_color(screen,
                              lv_color_hex(asleep ? 0x1A2238U : 0xF4F8FFU),
                              0);
    lv_obj_set_style_border_color(screen, lv_color_hex(PF_UI_COLOR_INK), 0);
    lv_obj_set_style_border_width(screen, 3, 0);
    lv_obj_set_style_pad_all(screen, 0, 0);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);

    pet = lv_label_create(screen);
    lv_label_set_text(pet, asleep ? "(-_-)" : "(o_o)");
    lv_obj_set_style_text_color(pet, lv_color_hex(PF_UI_COLOR_PET), 0);
    lv_obj_center(pet);

    for (i = 0; i < 3; i++) {
        btn = lv_obj_create(body);
        lv_obj_set_size(btn, 14, 14);
        lv_obj_set_style_radius(btn, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(btn,
                                  lv_color_hex(i == 1 ? PF_UI_COLOR_LIME
                                                      : PF_UI_COLOR_PINK),
                                  0);
        lv_obj_set_style_border_color(btn, lv_color_hex(PF_UI_COLOR_INK), 0);
        lv_obj_set_style_border_width(btn, 2, 0);
        lv_obj_set_style_pad_all(btn, 0, 0);
        lv_obj_clear_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_align(btn, LV_ALIGN_BOTTOM_MID, (int32_t)((i - 1) * 22),
                     i == 1 ? -22 : -28);
    }

    return body;
}

static void pf_ui_create_start_page(void)
{
    lv_obj_t *page;
    lv_obj_t *label;
    lv_obj_t *device;
    lv_obj_t *button;
    lv_obj_t *shadow;

    page = pf_ui_create_blank_page(PF_UI_COLOR_SKY);
    sg_ui.pages[PF_UI_PAGE_START] = page;

    label = lv_label_create(page);
    lv_label_set_text(label, "POCKET");
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_CYAN), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_24, 0);
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 36);

    label = lv_label_create(page);
    lv_label_set_text(label, "FRIEND");
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_LIME), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_24, 0);
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 68);

    device = pf_ui_draw_pet_device(page, false);
    lv_obj_align(device, LV_ALIGN_TOP_MID, 0, 120);

    shadow = lv_obj_create(page);
    lv_obj_set_size(shadow, PF_UI_PRIMARY_WIDTH, PF_UI_PRIMARY_HEIGHT);
    lv_obj_set_style_bg_color(shadow, lv_color_hex(PF_UI_COLOR_INK), 0);
    lv_obj_set_style_border_width(shadow, 0, 0);
    lv_obj_set_style_radius(shadow, 4, 0);
    lv_obj_set_style_pad_all(shadow, 0, 0);
    lv_obj_clear_flag(shadow, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_align(shadow, LV_ALIGN_BOTTOM_MID, 6, -42);

    button = pf_ui_create_button(page, "START", PF_INPUT_START,
                                 PF_UI_COLOR_PINK, false);
    lv_obj_set_style_radius(button, 4, 0);
    lv_obj_set_style_border_color(button, lv_color_hex(PF_UI_COLOR_INK), 0);
    lv_obj_set_style_border_width(button, 4, 0);
    lv_obj_set_style_text_font(lv_obj_get_child(button, 0),
                               &lv_font_montserrat_24, 0);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -48);

    label = lv_label_create(page);
    lv_label_set_text(label, "TAP TO BEGIN");
    lv_obj_set_style_text_color(label, lv_color_hex(0xE8F4FFU), 0);
    lv_obj_align(label, LV_ALIGN_BOTTOM_MID, 0, -16);
}

static void pf_ui_create_sleep_page(void)
{
    lv_obj_t *page;
    lv_obj_t *label;
    lv_obj_t *device;
    lv_obj_t *badge;
    lv_obj_t *zzz;

    page = pf_ui_create_blank_page(PF_UI_COLOR_NIGHT);
    sg_ui.pages[PF_UI_PAGE_SLEEP] = page;
    lv_obj_add_flag(page, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(page, pf_ui_button_cb, LV_EVENT_CLICKED,
                        (void *)(uintptr_t)PF_INPUT_WAKE);

    device = pf_ui_draw_pet_device(page, true);
    lv_obj_align(device, LV_ALIGN_TOP_MID, 0, 96);

    zzz = lv_label_create(page);
    lv_label_set_text(zzz, "Z z");
    lv_obj_set_style_text_color(zzz, lv_color_hex(PF_UI_COLOR_PINK), 0);
    lv_obj_set_style_text_font(zzz, &lv_font_montserrat_24, 0);
    lv_obj_align_to(zzz, device, LV_ALIGN_OUT_RIGHT_TOP, -8, 8);

    badge = lv_obj_create(page);
    lv_obj_set_size(badge, 200, 56);
    lv_obj_set_style_bg_color(badge, lv_color_hex(0x162048U), 0);
    lv_obj_set_style_border_color(badge, lv_color_hex(PF_UI_COLOR_INK), 0);
    lv_obj_set_style_border_width(badge, 4, 0);
    lv_obj_set_style_radius(badge, 4, 0);
    lv_obj_set_style_pad_all(badge, 0, 0);
    lv_obj_clear_flag(badge, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_align(badge, LV_ALIGN_CENTER, 0, 100);

    label = lv_label_create(badge);
    /* "已休眠" — keep UTF-8 for CJK font path */
    lv_label_set_text(label, "\xE5\xB7\xB2\xE4\xBC\x91\xE7\x9C\xA0");
    lv_obj_set_style_text_color(label, lv_color_hex(PF_UI_COLOR_SLEEP_TXT), 0);
    lv_obj_set_style_text_font(label, &pf_font_names_16, 0);
    lv_obj_center(label);

    label = lv_label_create(page);
    lv_label_set_text(label, "TOUCH TO WAKE");
    lv_obj_set_style_text_color(label, lv_color_hex(0x6A7AAAU), 0);
    lv_obj_align(label, LV_ALIGN_BOTTOM_MID, 0, -36);
}

static void pf_ui_create_idle_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_IDLE] = pf_ui_create_page("Pocket Friend");
    pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_IDLE], "Waiting for a friend",
                       LV_ALIGN_CENTER, 0, -40);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_IDLE], "Start",
                                 PF_INPUT_OPEN_CAMERA,
                                 PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_IDLE],
                                 LV_SYMBOL_WIFI, PF_INPUT_OPEN_WIFI,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_IDLE],
                                 LV_SYMBOL_EDIT, PF_INPUT_OPEN_PINYIN,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    sg_ui.wifi_status_label = lv_label_create(sg_ui.pages[PF_UI_PAGE_IDLE]);
    lv_label_set_text(sg_ui.wifi_status_label, LV_SYMBOL_CLOSE);
    lv_obj_set_style_text_color(sg_ui.wifi_status_label,
                                lv_color_hex(PF_UI_COLOR_MUTED), 0);
    lv_obj_align(sg_ui.wifi_status_label, LV_ALIGN_TOP_RIGHT, -76, 28);
}

static void pf_ui_create_photo_name_input_page(void)
{
    lv_obj_t *button;
    lv_obj_t *cand_panel;

    sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT] = pf_ui_create_page("Name");
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT],
                                 LV_SYMBOL_LEFT, PF_INPUT_PHOTO_NAME_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT],
                                 LV_SYMBOL_TRASH, PF_INPUT_PHOTO_NAME_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 8);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_photo_name_clear_cb,
                        LV_EVENT_CLICKED, NULL);

    sg_ui.photo_name_textarea =
        lv_textarea_create(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT]);
    lv_obj_set_size(sg_ui.photo_name_textarea, 288, 64);
    lv_obj_align(sg_ui.photo_name_textarea, LV_ALIGN_TOP_MID, 0, 82);
    lv_textarea_set_one_line(sg_ui.photo_name_textarea, true);
    lv_textarea_set_max_length(sg_ui.photo_name_textarea, 48U);
    lv_obj_set_style_text_font(sg_ui.photo_name_textarea,
                               &pf_font_names_16, 0);

    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT],
                                 "Start", PF_INPUT_PHOTO_NAME_SUBMIT,
                                 PF_UI_COLOR_PRIMARY, false);
    lv_obj_set_size(button, 136, 52);
    lv_obj_align(button, LV_ALIGN_TOP_MID, 0, 158);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_photo_name_submit_cb,
                        LV_EVENT_CLICKED, NULL);

    sg_ui.photo_name_keyboard =
        lv_keyboard_create(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT]);
    lv_obj_set_size(sg_ui.photo_name_keyboard, 304, 220);
    lv_obj_align(sg_ui.photo_name_keyboard, LV_ALIGN_BOTTOM_MID, 0, -8);
    lv_keyboard_set_textarea(sg_ui.photo_name_keyboard,
                             sg_ui.photo_name_textarea);

    sg_ui.photo_name_ime =
        lv_ime_pinyin_create(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT]);
    lv_ime_pinyin_set_keyboard(sg_ui.photo_name_ime,
                               sg_ui.photo_name_keyboard);
    lv_ime_pinyin_set_dict(sg_ui.photo_name_ime, sg_pinyin_name_dict);
    lv_ime_pinyin_set_mode(sg_ui.photo_name_ime, LV_IME_PINYIN_MODE_K26);
    lv_obj_set_style_text_font(sg_ui.photo_name_ime,
                               &pf_font_names_16, 0);
    cand_panel = lv_ime_pinyin_get_cand_panel(sg_ui.photo_name_ime);
    lv_obj_set_parent(cand_panel, sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT]);
    lv_obj_set_size(cand_panel, PF_UI_PINYIN_CAND_WIDTH,
                    PF_UI_PINYIN_CAND_HEIGHT);
    lv_obj_align_to(cand_panel, sg_ui.photo_name_keyboard,
                    LV_ALIGN_OUT_TOP_MID, 0, -4);
    pf_ui_style_pinyin_candidate_panel(cand_panel);
}

static void pf_ui_create_pinyin_input_page(void)
{
    lv_obj_t *button;
    lv_obj_t *cand_panel;

    sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT] = pf_ui_create_page("Pinyin");
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT],
                                 LV_SYMBOL_LEFT, PF_INPUT_PINYIN_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT],
                                 LV_SYMBOL_TRASH, PF_INPUT_PINYIN_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 8);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_pinyin_clear_cb, LV_EVENT_CLICKED, NULL);

    sg_ui.pinyin_textarea =
        lv_textarea_create(sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT]);
    lv_obj_set_size(sg_ui.pinyin_textarea, 288, 104);
    lv_obj_align(sg_ui.pinyin_textarea, LV_ALIGN_TOP_MID, 0, 82);
    lv_textarea_set_one_line(sg_ui.pinyin_textarea, false);
    lv_textarea_set_max_length(sg_ui.pinyin_textarea, 120U);
    lv_obj_set_style_text_font(sg_ui.pinyin_textarea,
                               &pf_font_names_16, 0);

    sg_ui.pinyin_keyboard =
        lv_keyboard_create(sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT]);
    lv_obj_set_size(sg_ui.pinyin_keyboard, 304, 220);
    lv_obj_align(sg_ui.pinyin_keyboard, LV_ALIGN_BOTTOM_MID, 0, -8);
    lv_keyboard_set_textarea(sg_ui.pinyin_keyboard, sg_ui.pinyin_textarea);

    sg_ui.pinyin_ime =
        lv_ime_pinyin_create(sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT]);
    lv_ime_pinyin_set_keyboard(sg_ui.pinyin_ime, sg_ui.pinyin_keyboard);
    lv_ime_pinyin_set_dict(sg_ui.pinyin_ime, sg_pinyin_name_dict);
    lv_ime_pinyin_set_mode(sg_ui.pinyin_ime, LV_IME_PINYIN_MODE_K26);
    lv_obj_set_style_text_font(sg_ui.pinyin_ime,
                               &pf_font_names_16, 0);
    cand_panel = lv_ime_pinyin_get_cand_panel(sg_ui.pinyin_ime);
    lv_obj_set_parent(cand_panel, sg_ui.pages[PF_UI_PAGE_PINYIN_INPUT]);
    lv_obj_set_size(cand_panel, PF_UI_PINYIN_CAND_WIDTH,
                    PF_UI_PINYIN_CAND_HEIGHT);
    lv_obj_align_to(cand_panel, sg_ui.pinyin_keyboard,
                    LV_ALIGN_OUT_TOP_MID, 0, -4);
    pf_ui_style_pinyin_candidate_panel(cand_panel);
}

static void pf_ui_create_wifi_scan_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WIFI_SCAN] = pf_ui_create_page("Wi-Fi");
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN],
                                 LV_SYMBOL_LEFT, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN],
                                 LV_SYMBOL_REFRESH, PF_INPUT_WIFI_SCAN,
                                 PF_UI_COLOR_PRIMARY, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 8);
    sg_ui.wifi_scan_status =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN],
                           "Scanning...", LV_ALIGN_TOP_MID, 0, 78);
    sg_ui.wifi_list = lv_list_create(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN]);
    lv_obj_set_size(sg_ui.wifi_list, 288, 330);
    lv_obj_align(sg_ui.wifi_list, LV_ALIGN_BOTTOM_MID, 0, -12);
}

static void pf_ui_create_wifi_password_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD] = pf_ui_create_page("Password");
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD],
                                 LV_SYMBOL_LEFT, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
    sg_ui.wifi_ssid_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD], "",
                           LV_ALIGN_TOP_MID, 0, 72);
    sg_ui.wifi_password =
        lv_textarea_create(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD]);
    lv_obj_set_size(sg_ui.wifi_password, 230, 52);
    lv_obj_align(sg_ui.wifi_password, LV_ALIGN_TOP_LEFT, 16, 112);
    lv_textarea_set_one_line(sg_ui.wifi_password, true);
    lv_textarea_set_password_mode(sg_ui.wifi_password, true);
    lv_textarea_set_max_length(sg_ui.wifi_password, 63U);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD],
                                 LV_SYMBOL_EYE_OPEN, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_RIGHT, -8, 106);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_wifi_visibility_cb, LV_EVENT_CLICKED, NULL);
    sg_ui.wifi_keyboard =
        lv_keyboard_create(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD]);
    lv_obj_set_size(sg_ui.wifi_keyboard, 304, 230);
    lv_obj_align(sg_ui.wifi_keyboard, LV_ALIGN_BOTTOM_MID, 0, -8);
    lv_keyboard_set_textarea(sg_ui.wifi_keyboard, sg_ui.wifi_password);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD],
                                 "Connect", PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_PRIMARY, true);
    lv_obj_set_size(button, 112, 48);
    lv_obj_align(button, LV_ALIGN_TOP_MID, 0, 174);
    lv_obj_remove_event_cb(button, pf_ui_button_cb);
    lv_obj_add_event_cb(button, pf_ui_wifi_connect_cb, LV_EVENT_CLICKED, NULL);
}

static void pf_ui_create_wifi_connect_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT] = pf_ui_create_page("Wi-Fi");
    sg_ui.wifi_connect_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT],
                           "Connecting...", LV_ALIGN_CENTER, 0, -24);
    sg_ui.wifi_retry_button =
        pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT], "Retry",
                            PF_INPUT_WIFI_RETRY, PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(sg_ui.wifi_retry_button, LV_ALIGN_BOTTOM_MID, 0, -24);
    lv_obj_add_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT],
                                 LV_SYMBOL_LEFT, PF_INPUT_WIFI_BACK,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
}

static void pf_ui_create_preview_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_PREVIEW] = lv_obj_create(NULL);
    lv_obj_set_size(sg_ui.pages[PF_UI_PAGE_PREVIEW], PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(sg_ui.pages[PF_UI_PAGE_PREVIEW],
                              lv_color_black(), 0);
    lv_obj_set_style_border_width(sg_ui.pages[PF_UI_PAGE_PREVIEW], 0, 0);
    lv_obj_set_style_pad_all(sg_ui.pages[PF_UI_PAGE_PREVIEW], 0, 0);
    lv_obj_clear_flag(sg_ui.pages[PF_UI_PAGE_PREVIEW], LV_OBJ_FLAG_SCROLLABLE);

    sg_ui.preview_canvas = lv_canvas_create(sg_ui.pages[PF_UI_PAGE_PREVIEW]);
    lv_obj_add_flag(sg_ui.preview_canvas, LV_OBJ_FLAG_HIDDEN);
    lv_obj_align(sg_ui.preview_canvas, LV_ALIGN_CENTER, 0, 0);

    sg_ui.preview_countdown_label =
        lv_label_create(sg_ui.pages[PF_UI_PAGE_PREVIEW]);
    lv_label_set_text(sg_ui.preview_countdown_label, "3");
    lv_obj_set_size(sg_ui.preview_countdown_label, 112, 112);
    lv_obj_set_style_radius(sg_ui.preview_countdown_label, 56, 0);
    lv_obj_set_style_bg_color(sg_ui.preview_countdown_label,
                              lv_color_black(), 0);
    lv_obj_set_style_bg_opa(sg_ui.preview_countdown_label, LV_OPA_70, 0);
    lv_obj_set_style_text_color(sg_ui.preview_countdown_label,
                                lv_color_white(), 0);
    lv_obj_set_style_text_font(sg_ui.preview_countdown_label,
                               &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_align(sg_ui.preview_countdown_label,
                                LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_pad_top(sg_ui.preview_countdown_label, 40, 0);
    lv_obj_align(sg_ui.preview_countdown_label, LV_ALIGN_CENTER, 0, 0);
    lv_obj_add_flag(sg_ui.preview_countdown_label, LV_OBJ_FLAG_HIDDEN);

    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_PREVIEW],
                                 LV_SYMBOL_LEFT, PF_INPUT_CLOSE_CAMERA,
                                 PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);

}

static void pf_ui_create_match_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_MATCH] = pf_ui_create_page("Friend found");
    sg_ui.peer_label = pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_MATCH],
                                          "Friend -- offline",
                                          LV_ALIGN_CENTER, 0, -72);
    sg_ui.match_status_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_MATCH], "Ready to connect",
                           LV_ALIGN_CENTER, 0, -8);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_MATCH], "Confirm",
                                 PF_INPUT_CONFIRM, PF_UI_COLOR_ACCENT, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_MATCH], LV_SYMBOL_CLOSE,
                                 PF_INPUT_CANCEL, PF_UI_COLOR_SURFACE, true);
    lv_obj_align(button, LV_ALIGN_TOP_LEFT, 8, 8);
}

static void pf_ui_create_waiting_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_WAITING] = pf_ui_create_page("Almost ready");
    sg_ui.waiting_status_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_WAITING],
                           "You: waiting\nFriend: waiting",
                           LV_ALIGN_CENTER, 0, -16);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_WAITING], "Cancel",
                                 PF_INPUT_CANCEL, PF_UI_COLOR_SURFACE, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

static void pf_ui_create_countdown_page(void)
{
    sg_ui.pages[PF_UI_PAGE_COUNTDOWN] = pf_ui_create_page("Photo in");
    sg_ui.countdown_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_COUNTDOWN], "3",
                           LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_text_color(sg_ui.countdown_label,
                                lv_color_hex(PF_UI_COLOR_ACCENT), 0);
    lv_obj_set_style_text_font(sg_ui.countdown_label,
                               &lv_font_montserrat_24, 0);
}

static void pf_ui_create_result_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_RESULT] = lv_obj_create(NULL);
    lv_obj_set_size(sg_ui.pages[PF_UI_PAGE_RESULT], PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_set_style_bg_color(sg_ui.pages[PF_UI_PAGE_RESULT],
                              lv_color_black(), 0);
    lv_obj_set_style_border_width(sg_ui.pages[PF_UI_PAGE_RESULT], 0, 0);
    lv_obj_set_style_pad_all(sg_ui.pages[PF_UI_PAGE_RESULT], 0, 0);
    lv_obj_clear_flag(sg_ui.pages[PF_UI_PAGE_RESULT], LV_OBJ_FLAG_SCROLLABLE);

    sg_ui.result_image = lv_image_create(sg_ui.pages[PF_UI_PAGE_RESULT]);
    lv_obj_set_size(sg_ui.result_image, PF_UI_WIDTH, PF_UI_HEIGHT);
    lv_obj_center(sg_ui.result_image);

    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_RESULT], "Done",
                                 PF_INPUT_COMPLETE, PF_UI_COLOR_SUCCESS, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

static void pf_ui_create_dnd_page(void)
{
    /* DND reuses the branded sleep screen. */
    sg_ui.pages[PF_UI_PAGE_DND] = sg_ui.pages[PF_UI_PAGE_SLEEP];
}

static void pf_ui_create_error_page(void)
{
    lv_obj_t *button;

    sg_ui.pages[PF_UI_PAGE_ERROR] = pf_ui_create_page("Something went wrong");
    sg_ui.error_label =
        pf_ui_create_label(sg_ui.pages[PF_UI_PAGE_ERROR], "Please try again",
                           LV_ALIGN_CENTER, 0, -24);
    lv_obj_set_style_text_color(sg_ui.error_label,
                                lv_color_hex(PF_UI_COLOR_ERROR), 0);
    button = pf_ui_create_button(sg_ui.pages[PF_UI_PAGE_ERROR], "Retry",
                                 PF_INPUT_RETRY, PF_UI_COLOR_PRIMARY, false);
    lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -24);
}

OPERATE_RET pf_ui_init(void)
{
    OPERATE_RET rt;

    if (sg_ui_initialized) {
        return OPRT_INIT_MORE_THAN_ONCE;
    }
    rt = tal_mutex_create_init(&sg_preview_mutex);
    if (rt != OPRT_OK) {
        return rt;
    }

    lv_vendor_init(DISPLAY_NAME);
    lv_vendor_start(THREAD_PRIO_1, 1024U * 8U);
    lv_vendor_disp_lock();
    pf_ui_create_start_page();
    pf_ui_create_sleep_page();
    pf_ui_create_idle_page();
    pf_ui_create_preview_page();
    pf_ui_create_match_page();
    pf_ui_create_waiting_page();
    pf_ui_create_countdown_page();
    pf_ui_create_result_page();
    pf_ui_create_dnd_page();
    pf_ui_create_error_page();
    pf_ui_create_photo_name_input_page();
    pf_ui_create_pinyin_input_page();
    pf_ui_create_wifi_scan_page();
    pf_ui_create_wifi_password_page();
    pf_ui_create_wifi_connect_page();
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_START]);
    lv_vendor_disp_unlock();

    sg_ui_initialized = true;
    PR_NOTICE("[ui] ready 320x480 start/sleep");
    return OPRT_OK;
}

void pf_ui_show_page(PF_UI_PAGE_E page)
{
    if (!sg_ui_initialized || page >= PF_UI_PAGE_COUNT) {
        return;
    }
    if (page == PF_UI_PAGE_DND) {
        page = PF_UI_PAGE_SLEEP;
    }
    lv_vendor_disp_lock();
    lv_screen_load(sg_ui.pages[page]);
    lv_vendor_disp_unlock();
}

void pf_ui_mark_started(bool started)
{
    sg_ui_started = started;
}

bool pf_ui_is_started(void)
{
    return sg_ui_started;
}

void pf_ui_set_peer(char peer_id, bool online)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.peer_label, "Friend %c  %s", peer_id,
                          online ? "online" : "offline");
    lv_vendor_disp_unlock();
}

void pf_ui_set_confirmed(bool local, bool peer)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.match_status_label,
                      local ? "Waiting for friend" : "Ready to connect");
    lv_label_set_text_fmt(sg_ui.waiting_status_label,
                          "You: %s\nFriend: %s",
                          local ? "ready" : "waiting",
                          peer ? "ready" : "waiting");
    lv_vendor_disp_unlock();
}

void pf_ui_set_countdown(uint8_t seconds)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.countdown_label, "%u", seconds);
    lv_vendor_disp_unlock();
}

void pf_ui_show_preview_countdown(uint8_t seconds)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.preview_countdown_label, "%u", seconds);
    lv_obj_clear_flag(sg_ui.preview_countdown_label, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(sg_ui.preview_countdown_label);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_PREVIEW]);
    lv_vendor_disp_unlock();
}

static void pf_ui_camera_frame_cb(uint8_t *yuv, uint16_t width,
                                  uint16_t height)
{
    pf_ui_preview_flush(width, height, yuv);
}

static void pf_ui_rotate_rgb565_180(uint8_t *buffer, uint16_t width,
                                    uint16_t height)
{
#if PF_CAMERA_ROTATION_180
    uint16_t *pixels;
    uint32_t left = 0U;
    uint32_t right;

    if (buffer == NULL || width == 0U || height == 0U) {
        return;
    }
    pixels = (uint16_t *)buffer;
    right = (uint32_t)width * height - 1U;
    while (left < right) {
        uint16_t swap = pixels[left];
        pixels[left] = pixels[right];
        pixels[right] = swap;
        ++left;
        --right;
    }
#else
    (void)buffer;
    (void)width;
    (void)height;
#endif
}

OPERATE_RET pf_ui_preview_start(uint16_t width, uint16_t height)
{
    uint32_t buffer_size;
    uint8_t *buffer;

    if (!sg_ui_initialized || width == 0U || height == 0U ||
        width > PF_CAMERA_WIDTH || height > PF_CAMERA_HEIGHT) {
        return OPRT_INVALID_PARM;
    }

    buffer_size = (uint32_t)width * height * 2U;
    buffer = tal_psram_calloc(1, buffer_size);
    if (buffer == NULL) {
        return OPRT_MALLOC_FAILED;
    }

    tal_mutex_lock(sg_preview_mutex);
    if (sg_preview_buffer != NULL) {
        tal_mutex_unlock(sg_preview_mutex);
        tal_psram_free(buffer);
        return OPRT_INIT_MORE_THAN_ONCE;
    }
    sg_preview_buffer = buffer;
    if (sg_preview_pending == NULL) {
        sg_preview_pending = tal_psram_calloc(1, buffer_size);
        if (sg_preview_pending == NULL) {
            tal_psram_free(buffer);
            sg_preview_buffer = NULL;
            tal_mutex_unlock(sg_preview_mutex);
            return OPRT_MALLOC_FAILED;
        }
    }
    lv_vendor_disp_lock();
    lv_canvas_set_buffer(sg_ui.preview_canvas, sg_preview_buffer,
                         width, height, LV_COLOR_FORMAT_RGB565);
    lv_obj_set_size(sg_ui.preview_canvas, width, height);
    lv_obj_align(sg_ui.preview_canvas, LV_ALIGN_CENTER, 0, 0);
    lv_obj_clear_flag(sg_ui.preview_canvas, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(sg_ui.preview_countdown_label, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_PREVIEW]);
    lv_vendor_disp_unlock();
    pf_camera_set_frame_cb(pf_ui_camera_frame_cb);
    pf_camera_preview_enable(true);
    tal_mutex_unlock(sg_preview_mutex);
    return OPRT_OK;
}

void pf_ui_preview_flush(uint16_t width, uint16_t height, uint8_t *yuv)
{
    TAL_IMAGE_YUV422_TO_RGB_T conversion;

    if (!sg_ui_initialized || yuv == NULL) {
        return;
    }

    tal_mutex_lock(sg_preview_mutex);
    if (sg_preview_buffer == NULL || sg_preview_pending == NULL) {
        tal_mutex_unlock(sg_preview_mutex);
        return;
    }

    memset(&conversion, 0, sizeof(conversion));
    conversion.in_buf = yuv;
    conversion.in_width = width;
    conversion.in_height = height;
    conversion.out_buf = sg_preview_pending;
    conversion.out_width = width;
    conversion.out_height = height;
    if (tal_image_convert_yuv422_to_rgb565(&conversion) == OPRT_OK) {
        pf_ui_rotate_rgb565_180(sg_preview_pending, width, height);
        lv_vendor_disp_lock();
        {
            uint8_t *swap = sg_preview_buffer;
            sg_preview_buffer = sg_preview_pending;
            sg_preview_pending = swap;
            lv_canvas_set_buffer(sg_ui.preview_canvas, sg_preview_buffer,
                                 width, height, LV_COLOR_FORMAT_RGB565);
        }
        lv_obj_invalidate(sg_ui.preview_canvas);
        lv_vendor_disp_unlock();
    }
    tal_mutex_unlock(sg_preview_mutex);
}

void pf_ui_preview_stop(void)
{
    uint8_t *buffer;

    if (!sg_ui_initialized) {
        return;
    }
    pf_camera_preview_enable(false);
    pf_camera_set_frame_cb(NULL);

    tal_mutex_lock(sg_preview_mutex);
    buffer = sg_preview_buffer;
    sg_preview_buffer = NULL;
    if (sg_preview_pending != NULL) {
        tal_psram_free(sg_preview_pending);
        sg_preview_pending = NULL;
    }
    lv_vendor_disp_lock();
    lv_obj_add_flag(sg_ui.preview_canvas, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(sg_ui.preview_countdown_label, LV_OBJ_FLAG_HIDDEN);
    lv_vendor_disp_unlock();
    tal_mutex_unlock(sg_preview_mutex);
    tal_psram_free(buffer);
}

OPERATE_RET pf_ui_show_photo(uint16_t width, uint16_t height,
                             uint8_t *jpeg, uint32_t len)
{
    OPERATE_RET rt;
    uint32_t buffer_size;
    uint8_t *buffer;
    uint8_t *old_buffer;
    TAL_IMAGE_JPEG_OUTPUT_T output;

    if (!sg_ui_initialized || jpeg == NULL || len == 0U ||
        width == 0U || height == 0U ||
        width > PF_CAMERA_WIDTH || height > PF_CAMERA_HEIGHT) {
        return OPRT_INVALID_PARM;
    }

    buffer_size = (uint32_t)width * height * 2U;
    buffer = tal_psram_malloc(buffer_size);
    if (buffer == NULL) {
        return OPRT_MALLOC_FAILED;
    }
    memset(&output, 0, sizeof(output));
    output.out_buf = buffer;
    output.out_buf_size = buffer_size;
    output.out_width = width;
    output.out_height = height;
    rt = tal_image_jpeg_decode_rgb565(jpeg, len, &output);
    if (rt != OPRT_OK) {
        tal_psram_free(buffer);
        return rt;
    }
    pf_ui_rotate_rgb565_180(buffer, width, height);

    lv_vendor_disp_lock();
    old_buffer = sg_result_buffer;
    sg_result_buffer = buffer;
    memset(&sg_result_descriptor, 0, sizeof(sg_result_descriptor));
    sg_result_descriptor.header.cf = LV_COLOR_FORMAT_RGB565;
    sg_result_descriptor.header.w = width;
    sg_result_descriptor.header.h = height;
    sg_result_descriptor.data = sg_result_buffer;
    sg_result_descriptor.data_size = buffer_size;
    lv_image_set_src(sg_ui.result_image, &sg_result_descriptor);
    lv_image_set_inner_align(sg_ui.result_image, LV_IMAGE_ALIGN_CENTER);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_RESULT]);
    lv_vendor_disp_unlock();
    tal_psram_free(old_buffer);
    return OPRT_OK;
}

void pf_ui_show_error(const char *message)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.error_label,
                      message != NULL ? message : "Please try again");
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_ERROR]);
    lv_vendor_disp_unlock();
}

void pf_ui_show_photo_name_input(void)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_textarea_set_text(sg_ui.photo_name_textarea, "");
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_PHOTO_NAME_INPUT]);
    lv_vendor_disp_unlock();
}

void pf_ui_set_wifi_status(bool connected, bool busy)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.wifi_status_label,
                      connected ? LV_SYMBOL_WIFI :
                      (busy ? LV_SYMBOL_REFRESH : LV_SYMBOL_CLOSE));
    lv_obj_set_style_text_color(
        sg_ui.wifi_status_label,
        lv_color_hex(connected ? PF_UI_COLOR_SUCCESS : PF_UI_COLOR_MUTED), 0);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_scan(void)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_obj_clean(sg_ui.wifi_list);
    lv_label_set_text(sg_ui.wifi_scan_status, "Scanning...");
    lv_obj_clear_flag(sg_ui.wifi_scan_status, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_set_results(const PF_WIFI_AP_T *aps, uint8_t count)
{
    uint8_t i;

    if (!sg_ui_initialized || (aps == NULL && count > 0U)) {
        return;
    }
    lv_vendor_disp_lock();
    lv_obj_clean(sg_ui.wifi_list);
    if (count == 0U) {
        lv_label_set_text(sg_ui.wifi_scan_status, "No networks found");
        lv_obj_clear_flag(sg_ui.wifi_scan_status, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(sg_ui.wifi_scan_status, LV_OBJ_FLAG_HIDDEN);
        for (i = 0U; i < count; ++i) {
            char label[64];
            lv_obj_t *button;

            snprintf(label, sizeof(label), "%s  %d dBm%s", aps[i].ssid,
                     aps[i].rssi, aps[i].security == 0U ? "" : "  *");
            button = lv_list_add_button(sg_ui.wifi_list, LV_SYMBOL_WIFI, label);
            lv_obj_add_event_cb(button, pf_ui_wifi_ap_cb, LV_EVENT_CLICKED,
                                (void *)(uintptr_t)i);
        }
    }
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_SCAN]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_password(const char *ssid)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.wifi_ssid_label, ssid != NULL ? ssid : "Wi-Fi");
    lv_textarea_set_text(sg_ui.wifi_password, "");
    lv_textarea_set_password_mode(sg_ui.wifi_password, true);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_PASSWORD]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_connecting(const char *ssid)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.wifi_connect_label, "Connecting to\n%s",
                          ssid != NULL ? ssid : "Wi-Fi");
    lv_obj_add_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_connected(const char *ip)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text_fmt(sg_ui.wifi_connect_label, "Connected\n%s",
                          ip != NULL ? ip : "");
    lv_obj_add_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT]);
    lv_vendor_disp_unlock();
}

void pf_ui_wifi_show_failed(const char *message)
{
    if (!sg_ui_initialized) {
        return;
    }
    lv_vendor_disp_lock();
    lv_label_set_text(sg_ui.wifi_connect_label,
                      message != NULL ? message : "Unable to connect");
    lv_obj_clear_flag(sg_ui.wifi_retry_button, LV_OBJ_FLAG_HIDDEN);
    lv_screen_load(sg_ui.pages[PF_UI_PAGE_WIFI_CONNECT]);
    lv_vendor_disp_unlock();
}
