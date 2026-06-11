import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Bell,
  BarChart3,
  Boxes,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Home,
  LogOut,
  PackagePlus,
  Percent,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  Undo2,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { gbp, roundMoney, saleNetProfit } from "./lib/money";
import type {
  Business,
  Expense,
  CalendarEntry,
  InventoryItem,
  ListingAction,
  Notification,
  PlatformSetting,
  RecurringExpense,
  Sale,
} from "./lib/types";

type Page =
  | "home"
  | "notifications"
  | "inventory"
  | "add-stock"
  | "sales"
  | "expenses"
  | "comp"
  | "calendar"
  | "hauls"
  | "buying"
  | "analytics"
  | "tax"
  | "settings";

type Notice = {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: "high" | "medium" | "low";
  itemId?: string;
  route?: Page;
};

const statuses = [
  "Bought",
  "Needs Prep",
  "Needs Photos",
  "Ready To List",
  "Listed",
  "Sold",
  "Returned",
  "Dead Stock",
];

const categories = [
  "Clothing",
  "Footwear",
  "Electronics",
  "Collectibles",
  "Books",
  "Homeware",
  "Toys",
  "Jewellery",
  "Art",
  "Vintage",
  "Other",
];

const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (date?: string | null) => {
  if (!date) return 0;
  const start = new Date(`${date.slice(0, 10)}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
};
const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
};
const nextDueDate = (date: string, frequency: string) => {
