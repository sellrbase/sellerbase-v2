export type Business = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  currency: string;
  tax_region: string;
  sku_prefix: string;
  sku_start: number;
  theme: string | null;
  min_buy_profit: number | null;
  min_buy_margin: number | null;
  monthly_revenue_target: number | null;
  monthly_profit_target: number | null;
  monthly_sold_target: number | null;
  monthly_listed_target: number | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  business_id: string;
  batch_id: string | null;
  sku: string | null;
  title: string;
  category: string;
  source: string | null;
  condition: string | null;
  location: string | null;
  notes: string | null;
  cost_each: number | null;
  list_price_each: number;
  quantity_total: number;
  quantity_available: number;
  status: string;
  listed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Sale = {
  id: string;
  business_id: string;
  inventory_item_id: string;
  sku_snapshot: string | null;
  title_snapshot: string;
  quantity_sold: number;
  sold_price_each: number;
  cost_each_snapshot: number | null;
  platform: string;
  platform_fee: number;
  postage_cost: number;
  packaging_cost: number;
  other_cost: number;
  sold_at: string;
  voided_at: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  business_id: string;
  inventory_item_id: string | null;
  date: string;
  amount: number;
  category: string;
  description: string;
  source: string;
  due_date: string | null;
  recurring: boolean;
  created_at: string;
};

export type RecurringExpense = {
  id: string;
  business_id: string;
  description: string;
  amount: number;
  category: string;
  frequency: string;
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
};

export type ListingAction = {
  id: string;
  business_id: string;
  inventory_item_id: string;
  action_type: string;
  note: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
