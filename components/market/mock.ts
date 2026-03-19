export type MarketCategory = "all" | "skills" | "hardware" | "requests";

export type MarketItem = {
  id: string;
  category: Exclude<MarketCategory, "all">;
  tag: string;
  title: string;
  reward: number;
  distanceM: number;
};

export const MARKET_ITEMS: MarketItem[] = [
  {
    id: "1",
    category: "requests",
    tag: "修电脑",
    title: "MacBook 风扇异响 + 发热，想找同学帮忙排查并清灰",
    reward: 50,
    distanceM: 35,
  },
  {
    id: "2",
    category: "skills",
    tag: "技能交换",
    title: "互换：UI 动效 / Framer Motion 指导，换你的数据结构刷题计划",
    reward: 40,
    distanceM: 120,
  },
  {
    id: "3",
    category: "hardware",
    tag: "硬件转让",
    title: "出闲置：MX Master 2S，轻微使用痕迹，校内面交",
    reward: 120,
    distanceM: 260,
  },
  {
    id: "4",
    category: "requests",
    tag: "求带饭",
    title: "图书馆到二食堂，帮带一份轻食沙拉，感谢通证",
    reward: 50,
    distanceM: 50,
  },
  {
    id: "5",
    category: "skills",
    tag: "技能交换",
    title: "我可以帮你做简历排版与英文润色，交换你的摄影人像拍摄",
    reward: 30,
    distanceM: 80,
  },
  {
    id: "6",
    category: "hardware",
    tag: "硬件转让",
    title: "出：机械键盘轴体一套（线性），适合自习室静音改造",
    reward: 70,
    distanceM: 180,
  },
  {
    id: "7",
    category: "requests",
    tag: "求助任务",
    title: "帮我把 Next.js 项目部署到 Vercel 并做环境变量检查",
    reward: 90,
    distanceM: 310,
  },
  {
    id: "8",
    category: "skills",
    tag: "技能交换",
    title: "交换：线性代数期末复习笔记，换你的一份系统设计面经",
    reward: 35,
    distanceM: 150,
  },
];

