import { type ReactNode } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type PrototypeRoute =
  | "island"
  | "empty-island"
  | "residents"
  | "resident-detail"
  | "activity"
  | "encounter"
  | "encounter-settings"
  | "profile"
  | "tags";

interface PrototypeProps {
  route: PrototypeRoute;
  onNavigate: (route: PrototypeRoute) => void;
}

const colors = {
  ink: "#17231F",
  paper: "#FFF9E9",
  cream: "#F3E8C8",
  green: "#72C98E",
  darkGreen: "#28635A",
  water: "#6EC5D7",
  blue: "#4E8EA6",
  yellow: "#F5C857",
  coral: "#EF7E6D",
  violet: "#8E7BB8",
  white: "#FFFFFF",
  muted: "#66736F",
};

const residents = [
  { id: "ada", name: "Ada", initial: "A", color: colors.coral, tags: ["8bit", "咖啡"], meta: "7 月 23 日 · Adventure X" },
  { id: "lin", name: "Lin", initial: "L", color: colors.water, tags: ["硬件", "游戏"], meta: "湖畔创研中心" },
  { id: "mori", name: "Mori", initial: "M", color: colors.violet, tags: ["AI", "阅读"], meta: "7 月 21 日 · 杭州" },
];

const routeNames: Record<PrototypeRoute, string> = {
  island: "小岛首页",
  "empty-island": "空岛状态",
  residents: "居民图鉴",
  "resident-detail": "居民详情",
  activity: "岛屿动态",
  encounter: "相遇首页",
  "encounter-settings": "相遇设置",
  profile: "我的",
  tags: "我的标签",
};

function PixelAvatar({ initial, color, size = 44 }: { initial: string; color: string; size?: number }) {
  return (
    <View style={[styles.pixelAvatar, { backgroundColor: color, height: size, width: size }]}>
      <View style={styles.pixelHair} />
      <View style={styles.pixelEyes}><View style={styles.pixelEye} /><View style={styles.pixelEye} /></View>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

function IconButton({ label, icon, onPress }: { label: string; icon: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.iconButton}>
      <Text style={styles.iconGlyph}>{icon}</Text>
    </Pressable>
  );
}

function PageHeader({ title, eyebrow, back, right }: { title: string; eyebrow?: string; back?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.headerSide}>{back ? <IconButton icon="‹" label="返回" onPress={back} /> : null}</View>
      <View style={styles.headerTitleWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

function BottomNav({ active, onNavigate }: { active: "island" | "encounter" | "profile"; onNavigate: (route: PrototypeRoute) => void }) {
  const items = [
    { id: "island" as const, icon: "⌂", label: "小岛" },
    { id: "encounter" as const, icon: "◎", label: "相遇" },
    { id: "profile" as const, icon: "●", label: "我的" },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onNavigate(item.id)} style={styles.navItem}>
          <View style={[styles.navIconWrap, active === item.id && styles.navIconActive]}><Text style={[styles.navIcon, active === item.id && styles.navIconTextActive]}>{item.icon}</Text></View>
          <Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PrototypeIndex({ current, onNavigate }: { current: PrototypeRoute; onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prototypeIndex}>
      {(Object.keys(routeNames) as PrototypeRoute[]).map((key) => (
        <Pressable key={key} onPress={() => onNavigate(key)} style={[styles.indexChip, key === current && styles.indexChipActive]}>
          <Text style={[styles.indexChipText, key === current && styles.indexChipTextActive]}>{routeNames[key]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function AppFrame({ route, children, nav, onNavigate }: { route: PrototypeRoute; children: ReactNode; nav?: "island" | "encounter" | "profile"; onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <PrototypeIndex current={route} onNavigate={onNavigate} />
      <View style={styles.appBody}>{children}</View>
      {nav ? <BottomNav active={nav} onNavigate={onNavigate} /> : null}
    </SafeAreaView>
  );
}

function Tag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <View style={[styles.tag, dark && styles.tagDark]}><Text style={[styles.tagText, dark && styles.tagTextDark]}>#{children}</Text></View>;
}

function IslandScene({ empty = false }: { empty?: boolean }) {
  return (
    <View style={styles.islandScene}>
      <View style={styles.cloudOne} /><View style={styles.cloudTwo} />
      <View style={styles.islandShadow} />
      <View style={styles.islandLand}>
        <View style={styles.pathHorizontal} /><View style={styles.pathVertical} />
        <View style={styles.house}><View style={styles.roof} /><View style={styles.door} /><View style={styles.window} /></View>
        <View style={[styles.tree, { left: "9%", top: "19%" }]}><View style={styles.treeTop} /><View style={styles.treeTrunk} /></View>
        <View style={[styles.tree, { right: "7%", top: "12%" }]}><View style={styles.treeTop} /><View style={styles.treeTrunk} /></View>
        <View style={styles.workbench}><View style={styles.benchTop} /><View style={styles.benchLegs} /></View>
        <View style={styles.recordPlayer}><View style={styles.recordDisc} /></View>
        {!empty ? (
          <>
            <View style={[styles.sceneResident, { left: "20%", top: "52%" }]}><PixelAvatar initial="A" color={colors.coral} size={38} /></View>
            <View style={[styles.sceneResident, { right: "18%", top: "48%" }]}><PixelAvatar initial="L" color={colors.water} size={38} /></View>
            <View style={[styles.sceneResident, { left: "47%", bottom: "8%" }]}><PixelAvatar initial="M" color={colors.violet} size={38} /></View>
            <View style={styles.speechBubble}><Text style={styles.speechText}>有个新点子！</Text></View>
          </>
        ) : (
          <View style={styles.emptySceneCopy}><Text style={styles.emptySceneTitle}>岛上还很安静</Text><Text style={styles.emptySceneText}>完成第一次相遇，让新朋友来到这里</Text></View>
        )}
      </View>
    </View>
  );
}

function IslandScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <AppFrame route="island" nav="island" onNavigate={onNavigate}>
      <View style={styles.islandPageHeader}>
        <View><Text style={styles.brand}>POCKET FRIEND</Text><Text style={styles.islandName}>我的口袋岛</Text></View>
        <View style={styles.onlinePill}><View style={styles.onlineDot} /><Text style={styles.onlineText}>在线</Text></View>
      </View>
      <IslandScene />
      <View style={styles.quickActions}>
        <Pressable style={styles.quickAction} onPress={() => onNavigate("residents")}><Text style={styles.quickNumber}>05</Text><Text style={styles.quickLabel}>岛上居民</Text><Text style={styles.quickArrow}>›</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => onNavigate("activity")}><Text style={styles.quickNumber}>12</Text><Text style={styles.quickLabel}>今日动态</Text><Text style={styles.quickArrow}>›</Text></Pressable>
      </View>
      <Pressable style={styles.activityBanner} onPress={() => onNavigate("activity")}>
        <View style={styles.activityIcon}><Text style={styles.activityIconText}>✦</Text></View>
        <View style={styles.flex}><Text style={styles.activityTitle}>正在发生</Text><Text style={styles.activityText}>Ada 和 Lin 在工作台讨论新点子</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </AppFrame>
  );
}

function EmptyIslandScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <AppFrame route="empty-island" nav="island" onNavigate={onNavigate}>
      <View style={styles.islandPageHeader}><View><Text style={styles.brand}>POCKET FRIEND</Text><Text style={styles.islandName}>我的口袋岛</Text></View><View style={styles.onlinePill}><View style={styles.onlineDot} /><Text style={styles.onlineText}>在线</Text></View></View>
      <IslandScene empty />
      <View style={styles.emptyCard}><Text style={styles.emptyCardKicker}>FIRST SIGNAL</Text><Text style={styles.emptyCardTitle}>去遇见第一个朋友</Text><Text style={styles.emptyCardText}>打开相遇地图，寻找附近与你兴趣相投的人。</Text><Pressable style={styles.primaryButton} onPress={() => onNavigate("encounter")}><Text style={styles.primaryButtonText}>开始相遇</Text></Pressable></View>
    </AppFrame>
  );
}

function ResidentsScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <AppFrame route="residents" onNavigate={onNavigate}>
      <PageHeader title="岛上居民" eyebrow="05 / 20 RESIDENTS" back={() => onNavigate("island")} />
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><Text style={styles.searchPlaceholder}>搜索居民或共同标签</Text></View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>最近来到岛上</Text><Text style={styles.sectionMeta}>按相遇时间</Text></View>
        {residents.map((resident) => (
          <Pressable key={resident.id} style={styles.residentRow} onPress={() => onNavigate("resident-detail")}>
            <PixelAvatar initial={resident.initial} color={resident.color} size={54} />
            <View style={styles.flex}><Text style={styles.residentName}>{resident.name}</Text><View style={styles.tagsRow}>{resident.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</View><Text style={styles.residentMeta}>{resident.meta}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        <View style={styles.capacityCard}><Text style={styles.capacityTitle}>岛屿容量</Text><View style={styles.progressTrack}><View style={styles.progressFill} /></View><Text style={styles.capacityText}>已经迎来 5 位居民，还可以住下 15 位朋友。</Text></View>
      </ScrollView>
    </AppFrame>
  );
}

function PhotoMemory() {
  return (
    <View style={styles.photoMemory}>
      <View style={styles.photoSky}><View style={styles.photoSun} /><View style={styles.photoBuilding} /></View>
      <View style={[styles.photoPerson, { left: "27%" }]}><PixelAvatar initial="你" color={colors.green} size={58} /></View>
      <View style={[styles.photoPerson, { right: "27%" }]}><PixelAvatar initial="A" color={colors.coral} size={58} /></View>
      <View style={styles.photoCaption}><Text style={styles.photoCaptionText}>ADVENTURE X · 2026.07.23</Text></View>
    </View>
  );
}

function ResidentDetailScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <AppFrame route="resident-detail" onNavigate={onNavigate}>
      <PageHeader title="居民详情" back={() => onNavigate("residents")} right={<IconButton icon="•••" label="更多" />} />
      <ScrollView contentContainerStyle={styles.pageContent}>
        <PhotoMemory />
        <View style={styles.profileIdentity}><PixelAvatar initial="A" color={colors.coral} size={64} /><View style={styles.flex}><Text style={styles.detailName}>Ada</Text><Text style={styles.detailStatus}>活泼的小居民 · 正在工作台画草图</Text></View></View>
        <InfoSection title="我们的共同信号"><View style={styles.tagsRow}><Tag dark>8bit</Tag><Tag dark>咖啡</Tag><Tag dark>AI</Tag></View></InfoSection>
        <InfoSection title="第一次相遇"><Text style={styles.infoMain}>2026 年 7 月 23 日 · 14:32</Text><Text style={styles.infoSub}>Adventure X · 湖畔创研中心</Text></InfoSection>
        <InfoSection title="保持联系"><InfoLine label="GitHub" value="github.com/ada-pixel" /><InfoLine label="微信" value="AdaCreates" /></InfoSection>
        <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>查看完整回忆</Text></Pressable>
      </ScrollView>
    </AppFrame>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.infoSection}><Text style={styles.infoTitle}>{title}</Text>{children}</View>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function ActivityScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  const events = [
    { time: "14:20", icon: "✦", color: colors.yellow, names: "Ada 和 Lin", text: "在工作台旁画起了产品草图", tag: "硬件" },
    { time: "12:10", icon: "♫", color: colors.coral, names: "Mori", text: "在唱片机旁听了一会儿音乐", tag: "音乐" },
    { time: "09:42", icon: "▣", color: colors.water, names: "Ada", text: "翻开了你们第一次见面的合影", tag: "回忆" },
  ];
  return (
    <AppFrame route="activity" onNavigate={onNavigate}>
      <PageHeader title="岛屿动态" eyebrow="ISLAND MOMENTS" back={() => onNavigate("island")} />
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.dayHeading}><Text style={styles.dayTitle}>今天</Text><Text style={styles.dayWeather}>晴 · 27°C</Text></View>
        {events.map((event) => (
          <View key={event.time} style={styles.timelineRow}>
            <Text style={styles.timelineTime}>{event.time}</Text>
            <View style={[styles.timelineIcon, { backgroundColor: event.color }]}><Text style={styles.timelineIconText}>{event.icon}</Text></View>
            <View style={styles.timelineCard}><Text style={styles.timelineNames}>{event.names}</Text><Text style={styles.timelineText}>{event.text}</Text><Tag>{event.tag}</Tag></View>
          </View>
        ))}
        <View style={styles.memoryQuote}><Text style={styles.memoryQuoteMark}>“</Text><Text style={styles.memoryQuoteText}>小岛记住的，不只是认识了谁，还有那些真实发生过的小瞬间。</Text></View>
      </ScrollView>
    </AppFrame>
  );
}

function EncounterMap() {
  return (
    <View style={styles.encounterMap}>
      <View style={[styles.mapRoad, { left: "12%", width: 34 }]} /><View style={[styles.mapRoadHorizontal, { top: "58%" }]} />
      <View style={[styles.mapBuilding, { left: "29%", top: "20%", width: 78, height: 52 }]}><Text style={styles.mapBuildingText}>湖畔</Text></View>
      <View style={[styles.mapBuilding, { right: "10%", bottom: "13%", width: 90, height: 62 }]}><Text style={styles.mapBuildingText}>T1</Text></View>
      <View style={styles.radarRingLarge} /><View style={styles.radarRingSmall} />
      <View style={styles.selfMarker}><Text style={styles.selfMarkerText}>你</Text></View>
      <View style={[styles.friendMarker, { left: "29%", top: "35%", backgroundColor: colors.coral }]}><Text style={styles.friendMarkerText}>A</Text></View>
      <View style={[styles.friendMarker, { right: "24%", top: "22%", backgroundColor: colors.water }]}><Text style={styles.friendMarkerText}>L</Text></View>
      <View style={styles.mapStatus}><View style={styles.onlineDot} /><Text style={styles.mapStatusText}>模拟定位 · 精度良好</Text></View>
    </View>
  );
}

function EncounterScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <AppFrame route="encounter" nav="encounter" onNavigate={onNavigate}>
      <PageHeader title="附近相遇" eyebrow="DISCOVERING" right={<IconButton icon="⚙" label="相遇设置" onPress={() => onNavigate("encounter-settings")} />} />
      <ScrollView contentContainerStyle={styles.encounterContent}>
        <View style={styles.discoverableBar}><View><Text style={styles.discoverableTitle}>你正在被同频的人发现</Text><Text style={styles.discoverableSub}>发现范围 800 m</Text></View><View style={styles.toggleOn}><View style={styles.toggleKnob} /></View></View>
        <EncounterMap />
        <View style={styles.matchSection}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>附近同频的人</Text><Text style={styles.matchCount}>2 个信号</Text></View>
          {residents.slice(0, 2).map((resident, index) => <View key={resident.id} style={styles.matchCard}><PixelAvatar initial={resident.initial} color={resident.color} size={48} /><View style={styles.flex}><View style={styles.matchNameRow}><Text style={styles.residentName}>{resident.name}</Text><Text style={styles.matchScore}>{88 - index * 6}%</Text></View><Text style={styles.matchDistance}>{index ? "约 500 米内" : "约 300 米"}</Text><View style={styles.tagsRow}>{resident.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</View></View><Text style={styles.chevron}>›</Text></View>)}
        </View>
      </ScrollView>
    </AppFrame>
  );
}

function Segmented({ options, active }: { options: string[]; active: number }) {
  return <View style={styles.segmented}>{options.map((option, index) => <View key={option} style={[styles.segment, index === active && styles.segmentActive]}><Text style={[styles.segmentText, index === active && styles.segmentTextActive]}>{option}</Text></View>)}</View>;
}

function EncounterSettingsScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  return (
    <AppFrame route="encounter-settings" onNavigate={onNavigate}>
      <PageHeader title="相遇设置" back={() => onNavigate("encounter")} />
      <ScrollView contentContainerStyle={styles.pageContent}>
        <SettingGroup title="发现状态" description="关闭后，附近的人将无法看到你。"><View style={styles.settingRow}><View><Text style={styles.settingName}>可被发现</Text><Text style={styles.settingValue}>当前已开启</Text></View><View style={styles.toggleOn}><View style={styles.toggleKnob} /></View></View></SettingGroup>
        <SettingGroup title="发现范围" description="只有范围内的共同兴趣用户会出现在地图中。"><Segmented options={["300m", "800m", "1.5km"]} active={1} /></SettingGroup>
        <SettingGroup title="距离展示精度" description="双方会自动采用更保护隐私的一方设置。"><Segmented options={["100m", "500m", "1km", "区域"]} active={1} /></SettingGroup>
        <SettingGroup title="定位方式" description="Demo 中可以随时切换模拟定位。"><View style={styles.radioRow}><View style={styles.radioSelected}><View style={styles.radioDot} /></View><View><Text style={styles.settingName}>手机定位</Text><Text style={styles.settingValue}>使用设备 GPS</Text></View></View><View style={styles.radioRow}><View style={styles.radio} /><View><Text style={styles.settingName}>模拟定位</Text><Text style={styles.settingValue}>用于现场演示</Text></View></View></SettingGroup>
      </ScrollView>
    </AppFrame>
  );
}

function SettingGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <View style={styles.settingGroup}><Text style={styles.settingGroupTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text><View style={styles.settingControl}>{children}</View></View>;
}

function ProfileScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  const menu = [
    { icon: "#", color: colors.yellow, title: "我的标签", detail: "硬件 · AI · 8bit", route: "tags" as PrototypeRoute },
    { icon: "▣", color: colors.water, title: "设备与连接", detail: "Pocket Friend · 已连接" },
    { icon: "◇", color: colors.green, title: "隐私设置", detail: "发现与合影权限" },
    { icon: "↓", color: colors.cream, title: "数据与存储", detail: "回忆、联系人与导出" },
  ];
  return (
    <AppFrame route="profile" nav="profile" onNavigate={onNavigate}>
      <PageHeader title="我的" eyebrow="MY POCKET" />
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.userCard}><View style={styles.userAvatarRing}><PixelAvatar initial="你" color={colors.green} size={72} /></View><View style={styles.flex}><Text style={styles.userName}>Fiona 的口袋岛</Text><Text style={styles.userHandle}>@pocket-friend-001</Text><View style={styles.userStats}><View><Text style={styles.statNumber}>05</Text><Text style={styles.statLabel}>居民</Text></View><View style={styles.statDivider} /><View><Text style={styles.statNumber}>12</Text><Text style={styles.statLabel}>回忆</Text></View><View style={styles.statDivider} /><View><Text style={styles.statNumber}>08</Text><Text style={styles.statLabel}>家具</Text></View></View></View></View>
        <View style={styles.deviceCard}><View style={styles.deviceIcon}><Text style={styles.deviceIconText}>PF</Text></View><View style={styles.flex}><Text style={styles.deviceTitle}>Pocket Friend</Text><Text style={styles.deviceSub}>已连接 · 电量 82%</Text></View><View style={styles.onlinePill}><View style={styles.onlineDot} /><Text style={styles.onlineText}>在线</Text></View></View>
        <View style={styles.menuList}>{menu.map((item) => <Pressable key={item.title} style={styles.menuRow} onPress={() => item.route && onNavigate(item.route)}><View style={[styles.menuIcon, { backgroundColor: item.color }]}><Text style={styles.menuIconText}>{item.icon}</Text></View><View style={styles.flex}><Text style={styles.menuTitle}>{item.title}</Text><Text style={styles.menuDetail}>{item.detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
      </ScrollView>
    </AppFrame>
  );
}

function TagsScreen({ onNavigate }: { onNavigate: (route: PrototypeRoute) => void }) {
  const selected = ["硬件", "AI", "8bit", "独立开发", "找合伙人"];
  const suggested = ["产品设计", "音乐", "咖啡", "游戏", "开源", "摄影"];
  return (
    <AppFrame route="tags" onNavigate={onNavigate}>
      <PageHeader title="我的标签" eyebrow="3–5 个信号" back={() => onNavigate("profile")} />
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.tagHero}><Text style={styles.tagHeroTitle}>让同频的人更快找到你</Text><Text style={styles.tagHeroText}>标签会影响附近匹配，也会决定小岛上出现的家具和事件。</Text></View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>已选择</Text><Text style={styles.sectionMeta}>{selected.length} / 5</Text></View>
        <View style={styles.selectedTags}>{selected.map((tag, index) => <View key={tag} style={[styles.selectedTag, index === 4 && styles.selectedTagAccent]}><Text style={styles.selectedTagText}>#{tag}</Text><Text style={styles.removeTag}>×</Text></View>)}</View>
        <View style={styles.addTagBox}><Text style={styles.addTagPlaceholder}>输入一个新标签</Text><View style={styles.addButton}><Text style={styles.addButtonText}>＋</Text></View></View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>推荐标签</Text><Text style={styles.sectionMeta}>点击添加</Text></View>
        <View style={styles.suggestedTags}>{suggested.map((tag) => <View key={tag} style={styles.suggestedTag}><Text style={styles.suggestedTagText}>＋ #{tag}</Text></View>)}</View>
        <View style={styles.tagPreview}><View style={styles.previewFurniture}><View style={styles.benchTop} /><View style={styles.benchLegs} /></View><View style={styles.flex}><Text style={styles.previewTitle}>你的标签会生成岛屿物品</Text><Text style={styles.previewText}>#硬件 将解锁「共创工作台」</Text></View></View>
        <Pressable style={styles.primaryButton}><Text style={styles.primaryButtonText}>保存标签</Text></Pressable>
      </ScrollView>
    </AppFrame>
  );
}

export function PocketFriendPrototype({ route, onNavigate }: PrototypeProps) {
  if (route === "empty-island") return <EmptyIslandScreen onNavigate={onNavigate} />;
  if (route === "residents") return <ResidentsScreen onNavigate={onNavigate} />;
  if (route === "resident-detail") return <ResidentDetailScreen onNavigate={onNavigate} />;
  if (route === "activity") return <ActivityScreen onNavigate={onNavigate} />;
  if (route === "encounter") return <EncounterScreen onNavigate={onNavigate} />;
  if (route === "encounter-settings") return <EncounterSettingsScreen onNavigate={onNavigate} />;
  if (route === "profile") return <ProfileScreen onNavigate={onNavigate} />;
  if (route === "tags") return <TagsScreen onNavigate={onNavigate} />;
  return <IslandScreen onNavigate={onNavigate} />;
}

const hardShadow = { shadowColor: colors.ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 };

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper }, appBody: { flex: 1 }, flex: { flex: 1 },
  prototypeIndex: { backgroundColor: colors.ink, gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  indexChip: { borderColor: "#8B9994", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }, indexChipActive: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  indexChipText: { color: colors.white, fontSize: 11, fontWeight: "700" }, indexChipTextActive: { color: colors.ink },
  pageHeader: { alignItems: "center", backgroundColor: colors.paper, borderBottomColor: colors.ink, borderBottomWidth: 2, flexDirection: "row", minHeight: 68, paddingHorizontal: 14 },
  headerSide: { width: 54 }, headerRight: { alignItems: "flex-end" }, headerTitleWrap: { alignItems: "center", flex: 1 }, pageTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" }, eyebrow: { color: colors.darkGreen, fontSize: 10, fontWeight: "900", marginBottom: 2 },
  iconButton: { alignItems: "center", borderColor: colors.ink, borderWidth: 2, height: 40, justifyContent: "center", width: 40 }, iconGlyph: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  bottomNav: { backgroundColor: colors.paper, borderTopColor: colors.ink, borderTopWidth: 2, flexDirection: "row", height: 70, justifyContent: "space-around", paddingHorizontal: 24 },
  navItem: { alignItems: "center", flex: 1, justifyContent: "center", gap: 2 }, navIconWrap: { alignItems: "center", height: 31, justifyContent: "center", width: 42 }, navIconActive: { backgroundColor: colors.ink }, navIcon: { color: colors.ink, fontSize: 22, fontWeight: "900" }, navIconTextActive: { color: colors.yellow }, navLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, navLabelActive: { color: colors.ink, fontWeight: "900" },
  islandPageHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10, paddingTop: 14 }, brand: { color: colors.darkGreen, fontSize: 10, fontWeight: "900" }, islandName: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 2 },
  onlinePill: { alignItems: "center", backgroundColor: "#DDF3E2", flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 7 }, onlineDot: { backgroundColor: "#38A863", height: 8, width: 8 }, onlineText: { color: colors.darkGreen, fontSize: 11, fontWeight: "900" },
  islandScene: { backgroundColor: colors.water, flex: 1, minHeight: 310, overflow: "hidden", position: "relative" }, cloudOne: { backgroundColor: "#DDF5F4", height: 14, left: 25, position: "absolute", top: 25, width: 58 }, cloudTwo: { backgroundColor: "#DDF5F4", height: 12, position: "absolute", right: 35, top: 50, width: 42 },
  islandShadow: { backgroundColor: colors.blue, borderRadius: 130, bottom: 20, height: "68%", left: "8%", position: "absolute", width: "84%" },
  islandLand: { backgroundColor: colors.green, borderColor: colors.ink, borderRadius: 120, borderWidth: 3, bottom: 31, height: "70%", left: "7%", overflow: "hidden", position: "absolute", width: "86%", ...hardShadow },
  pathHorizontal: { backgroundColor: colors.cream, height: 31, left: 0, position: "absolute", top: "48%", width: "100%" }, pathVertical: { backgroundColor: colors.cream, height: "100%", left: "48%", position: "absolute", top: 0, width: 30 },
  house: { backgroundColor: colors.paper, borderColor: colors.ink, borderWidth: 3, height: 72, left: "37%", position: "absolute", top: "8%", width: 84 }, roof: { backgroundColor: colors.coral, borderColor: colors.ink, borderWidth: 3, height: 26, left: -8, position: "absolute", top: -14, width: 96 }, door: { backgroundColor: colors.darkGreen, bottom: 0, height: 33, left: 33, position: "absolute", width: 20 }, window: { backgroundColor: colors.water, borderColor: colors.ink, borderWidth: 2, height: 18, left: 8, position: "absolute", top: 17, width: 19 },
  tree: { height: 62, position: "absolute", width: 48 }, treeTop: { backgroundColor: colors.darkGreen, borderColor: colors.ink, borderRadius: 22, borderWidth: 3, height: 44, width: 48 }, treeTrunk: { backgroundColor: "#9B6B43", bottom: 0, height: 24, left: 19, position: "absolute", width: 10 },
  workbench: { bottom: "14%", height: 38, left: "12%", position: "absolute", width: 58 }, benchTop: { backgroundColor: colors.yellow, borderColor: colors.ink, borderWidth: 3, height: 18, width: 58 }, benchLegs: { borderBottomWidth: 0, borderColor: colors.ink, borderLeftWidth: 5, borderRightWidth: 5, height: 21, marginHorizontal: 8 },
  recordPlayer: { backgroundColor: colors.violet, borderColor: colors.ink, borderWidth: 3, height: 42, position: "absolute", right: "10%", top: "27%", width: 48 }, recordDisc: { backgroundColor: colors.ink, borderColor: colors.yellow, borderRadius: 15, borderWidth: 4, height: 29, left: 7, position: "absolute", top: 4, width: 29 },
  sceneResident: { position: "absolute" }, speechBubble: { backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2, left: "9%", paddingHorizontal: 8, paddingVertical: 5, position: "absolute", top: "36%", ...hardShadow }, speechText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  pixelAvatar: { alignItems: "center", borderColor: colors.ink, borderWidth: 3, justifyContent: "center", overflow: "hidden", position: "relative" }, pixelHair: { backgroundColor: colors.ink, height: "24%", left: 0, position: "absolute", right: 0, top: 0 }, pixelEyes: { flexDirection: "row", gap: 8, position: "absolute", top: "42%" }, pixelEye: { backgroundColor: colors.ink, height: 4, width: 4 }, avatarInitial: { bottom: 1, color: colors.ink, fontSize: 9, fontWeight: "900", position: "absolute" },
  quickActions: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 10 }, quickAction: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.ink, borderWidth: 2, flex: 1, flexDirection: "row", minHeight: 48, paddingHorizontal: 10 }, quickNumber: { color: colors.darkGreen, fontSize: 18, fontWeight: "900", marginRight: 8 }, quickLabel: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" }, quickArrow: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  activityBanner: { alignItems: "center", backgroundColor: colors.ink, flexDirection: "row", margin: 10, padding: 10 }, activityIcon: { alignItems: "center", backgroundColor: colors.yellow, height: 38, justifyContent: "center", marginRight: 10, width: 38 }, activityIconText: { color: colors.ink, fontSize: 20 }, activityTitle: { color: colors.yellow, fontSize: 10, fontWeight: "900" }, activityText: { color: colors.white, fontSize: 11, marginTop: 2 }, chevron: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  emptySceneCopy: { alignItems: "center", left: "10%", position: "absolute", right: "10%", top: "50%" }, emptySceneTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" }, emptySceneText: { color: colors.darkGreen, fontSize: 11, marginTop: 4, textAlign: "center" }, emptyCard: { backgroundColor: colors.paper, borderColor: colors.ink, borderWidth: 2, margin: 14, padding: 16 }, emptyCardKicker: { color: colors.coral, fontSize: 10, fontWeight: "900" }, emptyCardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 4 }, emptyCardText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 14, marginTop: 6 },
  primaryButton: { alignItems: "center", backgroundColor: colors.ink, borderColor: colors.ink, borderWidth: 2, justifyContent: "center", minHeight: 48, ...hardShadow }, primaryButtonText: { color: colors.yellow, fontSize: 14, fontWeight: "900" }, secondaryButton: { alignItems: "center", borderColor: colors.ink, borderWidth: 2, justifyContent: "center", minHeight: 48 }, secondaryButtonText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  pageContent: { gap: 14, padding: 14, paddingBottom: 30 }, searchBox: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2, flexDirection: "row", minHeight: 48, paddingHorizontal: 12 }, searchIcon: { color: colors.ink, fontSize: 22, marginRight: 8 }, searchPlaceholder: { color: colors.muted, fontSize: 13 }, sectionHeading: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" }, sectionMeta: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  residentRow: { alignItems: "center", backgroundColor: colors.white, borderBottomColor: colors.cream, borderBottomWidth: 2, flexDirection: "row", gap: 12, padding: 10 }, residentName: { color: colors.ink, fontSize: 16, fontWeight: "900" }, residentMeta: { color: colors.muted, fontSize: 11, marginTop: 6 }, tagsRow: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 }, tag: { backgroundColor: colors.cream, paddingHorizontal: 7, paddingVertical: 3 }, tagDark: { backgroundColor: colors.ink }, tagText: { color: colors.darkGreen, fontSize: 9, fontWeight: "800" }, tagTextDark: { color: colors.yellow },
  capacityCard: { backgroundColor: "#DDF3E2", borderColor: colors.darkGreen, borderWidth: 2, marginTop: 4, padding: 12 }, capacityTitle: { color: colors.darkGreen, fontSize: 13, fontWeight: "900" }, progressTrack: { backgroundColor: colors.white, borderColor: colors.darkGreen, borderWidth: 1, height: 10, marginVertical: 8 }, progressFill: { backgroundColor: colors.green, height: "100%", width: "25%" }, capacityText: { color: colors.darkGreen, fontSize: 11 },
  photoMemory: { backgroundColor: colors.water, borderColor: colors.ink, borderWidth: 3, height: 228, overflow: "hidden", position: "relative", ...hardShadow }, photoSky: { backgroundColor: "#BCE5E7", height: "67%", position: "absolute", top: 0, width: "100%" }, photoSun: { backgroundColor: colors.yellow, height: 38, position: "absolute", right: 24, top: 18, width: 38 }, photoBuilding: { backgroundColor: colors.cream, borderColor: colors.ink, borderWidth: 3, bottom: 0, height: 72, left: "12%", position: "absolute", width: "76%" }, photoPerson: { bottom: 38, position: "absolute" }, photoCaption: { backgroundColor: colors.ink, bottom: 0, left: 0, padding: 8, position: "absolute", right: 0 }, photoCaptionText: { color: colors.yellow, fontSize: 10, fontWeight: "900", textAlign: "center" },
  profileIdentity: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 4 }, detailName: { color: colors.ink, fontSize: 25, fontWeight: "900" }, detailStatus: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 }, infoSection: { backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2, gap: 8, padding: 12 }, infoTitle: { color: colors.darkGreen, fontSize: 11, fontWeight: "900" }, infoMain: { color: colors.ink, fontSize: 14, fontWeight: "800" }, infoSub: { color: colors.muted, fontSize: 12 }, infoLine: { alignItems: "center", borderTopColor: colors.cream, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 8 }, infoLabel: { color: colors.muted, fontSize: 11 }, infoValue: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  dayHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, dayTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" }, dayWeather: { color: colors.muted, fontSize: 11 }, timelineRow: { alignItems: "flex-start", flexDirection: "row" }, timelineTime: { color: colors.muted, fontSize: 11, paddingTop: 13, width: 42 }, timelineIcon: { alignItems: "center", borderColor: colors.ink, borderWidth: 2, height: 40, justifyContent: "center", marginRight: 9, width: 40 }, timelineIconText: { color: colors.ink, fontSize: 18, fontWeight: "900" }, timelineCard: { backgroundColor: colors.white, borderBottomColor: colors.cream, borderBottomWidth: 2, flex: 1, padding: 10 }, timelineNames: { color: colors.ink, fontSize: 13, fontWeight: "900" }, timelineText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginVertical: 4 }, memoryQuote: { backgroundColor: colors.darkGreen, marginTop: 8, padding: 16 }, memoryQuoteMark: { color: colors.yellow, fontSize: 30, fontWeight: "900", lineHeight: 24 }, memoryQuoteText: { color: colors.white, fontSize: 13, lineHeight: 20 },
  encounterContent: { paddingBottom: 18 }, discoverableBar: { alignItems: "center", backgroundColor: colors.paper, flexDirection: "row", justifyContent: "space-between", padding: 14 }, discoverableTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, discoverableSub: { color: colors.muted, fontSize: 10, marginTop: 3 }, toggleOn: { backgroundColor: colors.green, borderColor: colors.ink, borderWidth: 2, height: 28, padding: 3, width: 48 }, toggleKnob: { alignSelf: "flex-end", backgroundColor: colors.white, height: 18, width: 18 },
  encounterMap: { backgroundColor: "#CFE3C0", borderBottomColor: colors.ink, borderBottomWidth: 3, borderTopColor: colors.ink, borderTopWidth: 3, height: 280, overflow: "hidden", position: "relative" }, mapRoad: { backgroundColor: colors.paper, height: "100%", position: "absolute", top: 0 }, mapRoadHorizontal: { backgroundColor: colors.paper, height: 40, left: 0, position: "absolute", width: "100%" }, mapBuilding: { alignItems: "center", backgroundColor: colors.yellow, borderColor: colors.ink, borderWidth: 2, justifyContent: "center", position: "absolute" }, mapBuildingText: { color: colors.ink, fontSize: 11, fontWeight: "900" }, radarRingLarge: { borderColor: "rgba(40,99,90,0.3)", borderRadius: 90, borderWidth: 2, height: 180, left: "27%", position: "absolute", top: 52, width: 180 }, radarRingSmall: { borderColor: "rgba(40,99,90,0.55)", borderRadius: 52, borderWidth: 2, height: 104, left: "37%", position: "absolute", top: 90, width: 104 }, selfMarker: { alignItems: "center", backgroundColor: colors.ink, borderColor: colors.white, borderWidth: 3, height: 40, justifyContent: "center", left: "46%", position: "absolute", top: "45%", width: 40 }, selfMarkerText: { color: colors.yellow, fontSize: 12, fontWeight: "900" }, friendMarker: { alignItems: "center", borderColor: colors.ink, borderWidth: 3, height: 34, justifyContent: "center", position: "absolute", width: 34 }, friendMarkerText: { color: colors.ink, fontSize: 12, fontWeight: "900" }, mapStatus: { alignItems: "center", backgroundColor: colors.ink, bottom: 9, flexDirection: "row", gap: 6, left: 10, paddingHorizontal: 9, paddingVertical: 6, position: "absolute" }, mapStatusText: { color: colors.white, fontSize: 9, fontWeight: "700" },
  matchSection: { gap: 9, padding: 14 }, matchCount: { color: colors.darkGreen, fontSize: 11, fontWeight: "900" }, matchCard: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2, flexDirection: "row", gap: 10, padding: 10 }, matchNameRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, matchScore: { color: colors.coral, fontSize: 12, fontWeight: "900" }, matchDistance: { color: colors.muted, fontSize: 10, marginTop: 1 },
  settingGroup: { backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2, padding: 13 }, settingGroupTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, settingDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, settingControl: { borderTopColor: colors.cream, borderTopWidth: 2, gap: 14, marginTop: 12, paddingTop: 12 }, settingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, settingName: { color: colors.ink, fontSize: 13, fontWeight: "800" }, settingValue: { color: colors.muted, fontSize: 10, marginTop: 2 }, segmented: { borderColor: colors.ink, borderWidth: 2, flexDirection: "row" }, segment: { alignItems: "center", borderRightColor: colors.ink, borderRightWidth: 1, flex: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 3 }, segmentActive: { backgroundColor: colors.ink }, segmentText: { color: colors.ink, fontSize: 10, fontWeight: "800" }, segmentTextActive: { color: colors.yellow }, radioRow: { alignItems: "center", flexDirection: "row", gap: 10 }, radio: { borderColor: colors.ink, borderRadius: 10, borderWidth: 2, height: 20, width: 20 }, radioSelected: { alignItems: "center", borderColor: colors.ink, borderRadius: 10, borderWidth: 2, height: 20, justifyContent: "center", width: 20 }, radioDot: { backgroundColor: colors.darkGreen, borderRadius: 5, height: 10, width: 10 },
  userCard: { alignItems: "center", backgroundColor: colors.darkGreen, flexDirection: "row", gap: 12, padding: 14 }, userAvatarRing: { borderColor: colors.yellow, borderWidth: 3, padding: 3 }, userName: { color: colors.white, fontSize: 17, fontWeight: "900" }, userHandle: { color: "#B6D6CF", fontSize: 10, marginTop: 2 }, userStats: { alignItems: "center", flexDirection: "row", gap: 12, marginTop: 12 }, statNumber: { color: colors.yellow, fontSize: 14, fontWeight: "900", textAlign: "center" }, statLabel: { color: colors.white, fontSize: 9 }, statDivider: { backgroundColor: "#5B867F", height: 25, width: 1 }, deviceCard: { alignItems: "center", backgroundColor: "#DDF3E2", borderColor: colors.darkGreen, borderWidth: 2, flexDirection: "row", gap: 10, padding: 11 }, deviceIcon: { alignItems: "center", backgroundColor: colors.ink, height: 44, justifyContent: "center", width: 44 }, deviceIconText: { color: colors.yellow, fontSize: 12, fontWeight: "900" }, deviceTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, deviceSub: { color: colors.muted, fontSize: 10, marginTop: 3 }, menuList: { backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2 }, menuRow: { alignItems: "center", borderBottomColor: colors.cream, borderBottomWidth: 2, flexDirection: "row", gap: 10, minHeight: 66, padding: 10 }, menuIcon: { alignItems: "center", borderColor: colors.ink, borderWidth: 2, height: 38, justifyContent: "center", width: 38 }, menuIconText: { color: colors.ink, fontSize: 17, fontWeight: "900" }, menuTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, menuDetail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  tagHero: { backgroundColor: colors.darkGreen, padding: 16 }, tagHeroTitle: { color: colors.yellow, fontSize: 19, fontWeight: "900" }, tagHeroText: { color: colors.white, fontSize: 12, lineHeight: 19, marginTop: 6 }, selectedTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, selectedTag: { alignItems: "center", backgroundColor: colors.ink, flexDirection: "row", gap: 8, paddingHorizontal: 11, paddingVertical: 9 }, selectedTagAccent: { backgroundColor: colors.coral }, selectedTagText: { color: colors.white, fontSize: 12, fontWeight: "900" }, removeTag: { color: colors.yellow, fontSize: 16, fontWeight: "900" }, addTagBox: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 2, flexDirection: "row", minHeight: 48, paddingLeft: 12 }, addTagPlaceholder: { color: colors.muted, flex: 1, fontSize: 12 }, addButton: { alignItems: "center", alignSelf: "stretch", backgroundColor: colors.yellow, borderLeftColor: colors.ink, borderLeftWidth: 2, justifyContent: "center", width: 48 }, addButtonText: { color: colors.ink, fontSize: 22, fontWeight: "900" }, suggestedTags: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, suggestedTag: { borderColor: colors.darkGreen, borderWidth: 2, paddingHorizontal: 9, paddingVertical: 7 }, suggestedTagText: { color: colors.darkGreen, fontSize: 11, fontWeight: "800" }, tagPreview: { alignItems: "center", backgroundColor: colors.cream, borderColor: colors.ink, borderWidth: 2, flexDirection: "row", gap: 12, padding: 12 }, previewFurniture: { height: 40, width: 58 }, previewTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" }, previewText: { color: colors.muted, fontSize: 10, marginTop: 3 },
});
