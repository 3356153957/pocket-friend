export type QuizChoice = "A" | "B" | "C" | "D";
export type QuizQuestionId = "q1" | "q2" | "q3" | "q4" | "q5";

export type Archetype = "安静观察者" | "话痨点火机" | "好奇选手" | "松弛派";
export type FirstMeetStyle = "直接聊天" | "一起做事" | "安静陪伴" | "被邀请更舒服";
export type EncounterPreference = "深聊" | "共同任务" | "探索" | "玩乐感";
export type SceneType = "安静室内" | "户外游走" | "夜晚文化" | "游戏共创";
export type PrivacyMode = "需确认" | "匿名优先" | "熟后公开" | "开放捕捉";

export type QuizAnswers = Partial<Record<QuizQuestionId, QuizChoice>>;
export type CompletedQuizAnswers = Record<QuizQuestionId, QuizChoice>;

export interface EncounterProfile {
  archetype: Archetype;
  firstMeetStyle: FirstMeetStyle;
  encounterPreference: EncounterPreference;
  sceneType: SceneType;
  sceneTags: string[];
  privacyMode: PrivacyMode;
  displayText: string;
}

export interface LegacyMatchingPrefs {
  vibe: "quiet" | "spark" | "curious" | "chill";
  interests: string[];
  meetStyle: "eye" | "chat" | "activity";
}

type ScoreKey = Archetype | FirstMeetStyle | EncounterPreference | SceneType | PrivacyMode;
type ScorePatch = Partial<Record<ScoreKey, number>>;

interface QuizOption {
  key: QuizChoice;
  label: string;
  scores: ScorePatch;
}

export interface QuizQuestion {
  id: QuizQuestionId;
  title: string;
  options: QuizOption[];
}

const archetypeOrder: Archetype[] = ["安静观察者", "松弛派", "好奇选手", "话痨点火机"];
const firstMeetStyleOrder: FirstMeetStyle[] = ["直接聊天", "一起做事", "安静陪伴", "被邀请更舒服"];
const encounterPreferenceOrder: EncounterPreference[] = ["深聊", "共同任务", "探索", "玩乐感"];

export const quizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    title: "你刚进入一个有很多陌生人的活动现场，会先做什么？",
    options: [
      { key: "A", label: "先站在边上看看大家在做什么", scores: { 安静观察者: 3, 被邀请更舒服: 1 } },
      { key: "B", label: "找一个看起来有趣的人聊两句", scores: { 话痨点火机: 3, 直接聊天: 1 } },
      { key: "C", label: "看看有没有什么可以参与的小活动", scores: { 好奇选手: 2, 一起做事: 2 } },
      { key: "D", label: "找个舒服的位置待着，等气氛自然发生", scores: { 松弛派: 2, 安静陪伴: 1 } },
    ],
  },
  {
    id: "q2",
    title: "你旁边来了一个不太熟的人，你更容易因为什么事打开话题？",
    options: [
      { key: "A", label: "对方随口说了一个轻松、有趣的话题", scores: { 直接聊天: 3, 话痨点火机: 1 } },
      { key: "B", label: "你们刚好要一起完成一个小任务", scores: { 一起做事: 3, 好奇选手: 1 } },
      { key: "C", label: "你们在同一个地方待了一会儿，慢慢有了熟悉感", scores: { 安静陪伴: 3, 松弛派: 1 } },
      { key: "D", label: "对方先表达出友好，你再开始回应", scores: { 被邀请更舒服: 3, 安静观察者: 1 } },
    ],
  },
  {
    id: "q3",
    title: "一次活动结束后，哪种片段最容易让你记住一个人？",
    options: [
      { key: "A", label: "你们聊到一个很真实、很深入的话题", scores: { 深聊: 3, 直接聊天: 1 } },
      { key: "B", label: "你们一起解决了一个小麻烦", scores: { 共同任务: 3, 一起做事: 1 } },
      { key: "C", label: "你们临时改变路线，发现了一个没想到的地方", scores: { 探索: 3, 好奇选手: 1 } },
      { key: "D", label: "中间发生了一件有点好笑、很随机的事", scores: { 玩乐感: 3, 话痨点火机: 1 } },
    ],
  },
  {
    id: "q4",
    title: "活动结束后，有人说“要不要再待一会儿”，你更可能被哪种提议打动？",
    options: [
      { key: "A", label: "附近有个安静地方，可以坐一会儿", scores: { 安静室内: 3, 深聊: 1 } },
      { key: "B", label: "我们随便走走，看看会路过什么", scores: { 户外游走: 3, 探索: 1 } },
      { key: "C", label: "那边好像还有点热闹，要不要去看看", scores: { 夜晚文化: 3, 玩乐感: 1 } },
      { key: "D", label: "我们一起玩一局 / 做个东西再走", scores: { 游戏共创: 3, 共同任务: 1 } },
    ],
  },
  {
    id: "q5",
    title: "如果刚认识的人想把你加入 TA 的小岛，你更舒服的方式是？",
    options: [
      { key: "A", label: "先问我一下，我同意后再加入", scores: { 需确认: 3 } },
      { key: "B", label: "可以先加入，但先不要露出真实照片", scores: { 匿名优先: 3 } },
      { key: "C", label: "先用默认形象，熟一点后再解锁照片", scores: { 熟后公开: 3 } },
      { key: "D", label: "如果当下感觉不错，可以直接加入", scores: { 开放捕捉: 3 } },
    ],
  },
];

const sceneTagsByType: Record<SceneType, string[]> = {
  安静室内: ["咖啡店", "书店", "陶艺", "独立小店"],
  户外游走: ["citywalk", "公园", "户外散步"],
  夜晚文化: ["livehouse", "展览", "市集", "电影"],
  游戏共创: ["桌游", "手作", "项目共创", "剧本杀"],
};

const archetypeCopy: Record<Archetype, string> = {
  安静观察者: "你会先观察气氛，但很容易记住细节。适合被温柔地邀请靠近。",
  话痨点火机: "你擅长把空气点亮，适合从一个轻松话题开始相遇。",
  好奇选手: "你会被新鲜事吸引，适合在探索和小任务里认识别人。",
  松弛派: "你不急着推进关系，更喜欢自然、舒服、不用表演的相处。",
};

const firstMeetCopy: Record<FirstMeetStyle, string> = {
  直接聊天: "适合从一句轻松的话开始。",
  一起做事: "适合先一起完成一个小任务。",
  安静陪伴: "适合先待在同一个空间里。",
  被邀请更舒服: "适合由对方先靠近，你再回应。",
};

const privacyCopy: Record<PrivacyMode, string> = {
  需确认: "对方捕捉前需要先确认。",
  匿名优先: "可以先进入小岛，但优先匿名展示。",
  熟后公开: "先用像素形象，熟一点后再解锁照片。",
  开放捕捉: "当下感觉不错时，可以直接成为对方岛民。",
};

function addScores(target: Map<ScoreKey, number>, patch: ScorePatch) {
  for (const [key, value] of Object.entries(patch) as Array<[ScoreKey, number]>) {
    target.set(key, (target.get(key) ?? 0) + value);
  }
}

function pickHighest<T extends ScoreKey>(scores: Map<ScoreKey, number>, order: readonly T[]): T {
  const initial = order[0];
  if (!initial) throw new Error("Cannot pick a score without candidates.");

  return order.reduce((best, candidate) => {
    const bestScore = scores.get(best) ?? 0;
    const candidateScore = scores.get(candidate) ?? 0;
    return candidateScore > bestScore ? candidate : best;
  }, initial);
}

export function isQuizComplete(answers: QuizAnswers): answers is CompletedQuizAnswers {
  return quizQuestions.every((question) => Boolean(answers[question.id]));
}

export function calculateEncounterProfile(answers: CompletedQuizAnswers): EncounterProfile {
  const scores = new Map<ScoreKey, number>();

  for (const question of quizQuestions) {
    const choice = answers[question.id];
    const option = question.options.find((candidate) => candidate.key === choice);
    if (option) addScores(scores, option.scores);
  }

  const q4SceneByChoice: Record<QuizChoice, SceneType> = {
    A: "安静室内",
    B: "户外游走",
    C: "夜晚文化",
    D: "游戏共创",
  };
  const q5PrivacyByChoice: Record<QuizChoice, PrivacyMode> = {
    A: "需确认",
    B: "匿名优先",
    C: "熟后公开",
    D: "开放捕捉",
  };

  const archetype = pickHighest(scores, archetypeOrder);
  const firstMeetStyle = pickHighest(scores, firstMeetStyleOrder);
  const encounterPreference = pickHighest(scores, encounterPreferenceOrder);
  const sceneType = q4SceneByChoice[answers.q4];
  const privacyMode = q5PrivacyByChoice[answers.q5];
  const sceneTags = sceneTagsByType[sceneType];

  return {
    archetype,
    firstMeetStyle,
    encounterPreference,
    sceneType,
    sceneTags,
    privacyMode,
    displayText: `${archetypeCopy[archetype]} ${firstMeetCopy[firstMeetStyle]} 推荐从 ${sceneTags.slice(0, 3).join(" / ")} 这样的场景里开始。${privacyCopy[privacyMode]}`,
  };
}

export function deriveLegacyMatchingPrefs(profile: EncounterProfile): LegacyMatchingPrefs {
  const vibeByArchetype: Record<Archetype, LegacyMatchingPrefs["vibe"]> = {
    安静观察者: "quiet",
    话痨点火机: "spark",
    好奇选手: "curious",
    松弛派: "chill",
  };
  const meetStyleByFirstMeet: Record<FirstMeetStyle, LegacyMatchingPrefs["meetStyle"]> = {
    直接聊天: "chat",
    一起做事: "activity",
    安静陪伴: "eye",
    被邀请更舒服: "chat",
  };

  return {
    vibe: vibeByArchetype[profile.archetype],
    interests: profile.sceneTags,
    meetStyle: meetStyleByFirstMeet[profile.firstMeetStyle],
  };
}

export function buildAdjustedEncounterProfile(
  profile: EncounterProfile,
  updates: Partial<Pick<EncounterProfile, "archetype" | "firstMeetStyle" | "privacyMode" | "sceneTags">>,
): EncounterProfile {
  const sceneTags = updates.sceneTags ?? profile.sceneTags;
  const archetype = updates.archetype ?? profile.archetype;
  const firstMeetStyle = updates.firstMeetStyle ?? profile.firstMeetStyle;
  const privacyMode = updates.privacyMode ?? profile.privacyMode;

  return {
    ...profile,
    archetype,
    firstMeetStyle,
    privacyMode,
    sceneTags,
    displayText: `${archetypeCopy[archetype]} ${firstMeetCopy[firstMeetStyle]} 推荐从 ${sceneTags.slice(0, 3).join(" / ")} 这样的场景里开始。${privacyCopy[privacyMode]}`,
  };
}

export const archetypeOptions = archetypeOrder;
export const firstMeetStyleOptions = firstMeetStyleOrder;
export const privacyModeOptions: PrivacyMode[] = ["需确认", "匿名优先", "熟后公开", "开放捕捉"];
