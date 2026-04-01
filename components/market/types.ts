export type MarketCategory = "all" | "skills" | "hardware" | "requests";

export type MarketItemType = "技能" | "硬件" | "任务";

export type MarketItemStatus = "open" | "claimed";

export type MarketItemRow = {
  id: string;
  user_id: string;
  type: MarketItemType;
  title: string;
  description: string | null;
  price: number;
  status: MarketItemStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};
