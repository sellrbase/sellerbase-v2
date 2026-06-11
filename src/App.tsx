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
  const next = new Date(`${date}T00:00:00`);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (booting) return <FullScreenLoader />;
  if (!session) return <AuthScreen />;
  return <Sellerbase session={session} />;
}

function Sellerbase({ session }: { session: Session }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [actions, setActions] = useState<ListingAction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [platforms, setPlatforms] = useState<PlatformSetting[]>([]);
  const [page, setPage] = useState<Page>("home");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;
  const navigate = (nextPage: Page) => {
    setSelectedItemId(null);
    setBellOpen(false);
    setPage(nextPage);
  };

  const loadBusinesses = async () => {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data || []) as Business[];
    setBusinesses(rows);
    setBusiness((current) => current || rows[0] || null);
    setLoading(false);
  };

  const loadBusinessData = async (businessId: string) => {
    setLoading(true);
    const [itemsRes, salesRes, expensesRes, recurringRes, calendarRes, actionsRes, notificationsRes, platformsRes] =
      await Promise.all([
        supabase
          .from("inventory_items")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase
          .from("sales")
          .select("*")
          .eq("business_id", businessId)
          .order("sold_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .eq("business_id", businessId)
          .order("date", { ascending: false }),
        supabase
          .from("recurring_expenses")
          .select("*")
          .eq("business_id", businessId)
          .order("next_due_date", { ascending: true }),
        supabase
          .from("calendar_entries")
          .select("*")
          .eq("business_id", businessId)
          .order("date", { ascending: true }),
        supabase
          .from("listing_actions")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase
          .from("platform_settings")
          .select("*")
          .eq("business_id", businessId)
          .order("name", { ascending: true }),
      ]);

    setItems((itemsRes.data || []) as InventoryItem[]);
    setSales((salesRes.data || []) as Sale[]);
    setExpenses((expensesRes.data || []) as Expense[]);
    setRecurringExpenses((recurringRes.data || []) as RecurringExpense[]);
    setCalendarEntries((calendarRes.data || []) as CalendarEntry[]);
    setActions((actionsRes.data || []) as ListingAction[]);
    setNotifications((notificationsRes.data || []) as Notification[]);
    setPlatforms((platformsRes.data || []) as PlatformSetting[]);
    setLoading(false);
  };

  useEffect(() => {
    loadBusinesses().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (business) void loadBusinessData(business.id);
  }, [business?.id]);

  useEffect(() => {
    const theme = business?.theme || "dark";
    document.documentElement.dataset.theme = theme;
  }, [business?.theme]);

  const refresh = () => {
    void loadBusinesses();
    if (business) void loadBusinessData(business.id);
  };

  const notices = useMemo(
    () => buildNotices(items, expenses, recurringExpenses, sales, notifications),
    [items, expenses, recurringExpenses, sales, notifications],
  );

  if (loading && businesses.length === 0) return <FullScreenLoader />;
  if (!business) {
    return <BusinessSetup userId={session.user.id} onCreated={loadBusinesses} />;
  }

  const openListing = (itemId: string) => {
    setSelectedItemId(itemId);
    setBellOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          SELLR<span>BASE</span>
        </div>
        <BusinessSwitcher
          businesses={businesses}
          active={business}
          onChange={(next) => {
            setBusiness(next);
            setSelectedItemId(null);
          }}
        />
        <button className="ghost-button create-business-button" onClick={() => setBusinessModalOpen(true)}>
          Create business
        </button>
        <nav className="nav-list">
          <NavButton icon={<Home />} label="Home" page="home" active={page} onClick={navigate} />
          <NavButton
            icon={<Bell />}
            label="Notifications"
            page="notifications"
            active={page}
            onClick={navigate}
            count={notices.length}
          />
          <NavButton
            icon={<Boxes />}
            label="Inventory"
            page="inventory"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<PackagePlus />}
            label="Add Stock"
            page="add-stock"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<CircleDollarSign />}
            label="Sales"
            page="sales"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<Receipt />}
            label="Expenses"
            page="expenses"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<Search />}
            label="Comp Checker"
            page="comp"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<ClipboardList />}
            label="Calendar"
            page="calendar"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<ClipboardList />}
            label="Hauls"
            page="hauls"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<Percent />}
            label="Buying Calc"
            page="buying"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<BarChart3 />}
            label="Analytics"
            page="analytics"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<Receipt />}
            label="Tax"
            page="tax"
            active={page}
            onClick={navigate}
          />
          <NavButton
            icon={<Settings />}
            label="Settings"
            page="settings"
            active={page}
            onClick={navigate}
          />
        </nav>
        <button className="ghost-button sidebar-signout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{business.name}</p>
            <h1>{pageTitle(page)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setBellOpen((open) => !open)}>
              <Bell size={18} />
              {notices.length > 0 && <span>{notices.length}</span>}
            </button>
          </div>
          {bellOpen && (
            <NotificationDrawer
              notices={notices.slice(0, 8)}
              onOpenAll={() => {
                navigate("notifications");
                setBellOpen(false);
              }}
              onOpenListing={openListing}
            />
          )}
        </header>

        {selectedItem ? (
          <ListingDetail
            business={business}
            item={selectedItem}
            sales={sales.filter((sale) => sale.inventory_item_id === selectedItem.id)}
            actions={actions.filter((action) => action.inventory_item_id === selectedItem.id)}
            platforms={platforms}
            onBack={() => setSelectedItemId(null)}
            onRefresh={refresh}
          />
        ) : (
          <>
            {page === "home" && (
              <HomePage
                business={business}
                items={items}
                sales={sales}
                expenses={expenses}
                recurringExpenses={recurringExpenses}
                notices={notices}
                onOpenListing={openListing}
                onNavigate={navigate}
              />
            )}
            {page === "notifications" && (
              <NotificationsPage notices={notices} onOpenListing={openListing} />
            )}
            {page === "inventory" && (
              <InventoryPage items={items} onOpenListing={openListing} />
            )}
            {page === "add-stock" && (
              <AddStockPage
                business={business}
                items={items}
                onCreated={(itemId) => {
                  refresh();
                  setSelectedItemId(itemId);
                }}
              />
            )}
            {page === "sales" && (
              <SalesPage items={items} sales={sales} onOpenListing={openListing} />
            )}
            {page === "expenses" && (
              <ExpensesPage
                business={business}
                expenses={expenses}
                recurringExpenses={recurringExpenses}
                onRefresh={refresh}
              />
            )}
            {page === "comp" && <CompChecker />}
            {page === "calendar" && (
              <CalendarPage business={business} entries={calendarEntries} onRefresh={refresh} />
            )}
            {page === "hauls" && <HaulsPage items={items} sales={sales} />}
            {page === "buying" && <BuyingCalculator business={business} platforms={platforms} onOpenSettings={() => navigate("settings")} />}
            {page === "analytics" && <AnalyticsPage items={items} sales={sales} expenses={expenses} />}
            {page === "tax" && <TaxPage sales={sales} expenses={expenses} />}
            {page === "settings" && (
              <SettingsPage business={business} platforms={platforms} items={items} sales={sales} onRefresh={refresh} />
            )}
          </>
        )}
        {businessModalOpen && (
          <BusinessCreateModal
            userId={session.user.id}
            onClose={() => setBusinessModalOpen(false)}
            onCreated={async () => {
              setBusinessModalOpen(false);
              await loadBusinesses();
            }}
          />
        )}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          });
    if (result.error) setMessage(result.error.message);
    setBusy(false);
  };

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="brand large">
          SELLR<span>BASE</span>
        </div>
        <p className="auth-copy">
          Inventory, sales, profit, notifications and tax tools for resellers.
        </p>
        <div className="form-stack">
          {mode === "signup" && (
            <Field label="Name" value={name} onChange={setName} placeholder="Your name" />
          )}
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            type="password"
          />
          {message && <p className="error-box">{message}</p>}
          <button className="primary-button" disabled={busy || !email || !password} onClick={submit}>
            {busy ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>
        <button
          className="text-button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "I already have an account"}
        </button>
      </section>
    </div>
  );
}

function BusinessSetup({ userId, onCreated }: { userId: string; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("SB");
  const [start, setStart] = useState("1");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        user_id: userId,
        name,
        sku_prefix: prefix.toUpperCase(),
        sku_start: Number(start) || 1,
      })
      .select()
      .single();
    if (!error && data) {
      const defaults = ["eBay", "Vinted", "Depop", "Facebook", "Other"].map((platform) => ({
        business_id: data.id,
        name: platform,
      }));
      await supabase.from("platform_settings").insert(defaults);
      await onCreated();
    }
    setBusy(false);
  };

  return (
    <div className="auth-page">
      <section className="auth-panel wide">
        <div className="brand large">
          SELLR<span>BASE</span>
        </div>
        <h2>Create your first business</h2>
        <p className="muted">Set up the workspace that will hold your stock, sales and reports.</p>
        <div className="form-grid two">
          <Field label="Business name" value={name} onChange={setName} placeholder="Little Labels" />
          <Field label="SKU prefix" value={prefix} onChange={setPrefix} placeholder="LL" />
          <Field label="Starting number" value={start} onChange={setStart} type="number" />
        </div>
        <button className="primary-button" disabled={busy || !name} onClick={create}>
          {busy ? "Creating..." : "Create business"}
        </button>
      </section>
    </div>
  );
}

function BusinessCreateModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("SB");
  const [start, setStart] = useState("1");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        user_id: userId,
        name,
        sku_prefix: prefix.toUpperCase(),
        sku_start: Number(start) || 1,
      })
      .select()
      .single();
    if (!error && data) {
      await supabase.from("platform_settings").insert(
        ["eBay", "Vinted", "Depop", "Facebook", "Other"].map((platform) => ({
          business_id: data.id,
          name: platform,
        })),
      );
      await onCreated();
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="section-head">
          <div>
            <p className="eyebrow">Business</p>
            <h2>Create business</h2>
          </div>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid two">
          <Field label="Business name" value={name} onChange={setName} />
          <Field label="SKU prefix" value={prefix} onChange={setPrefix} />
          <Field label="Starting number" value={start} onChange={setStart} type="number" />
        </div>
        <button className="primary-button" disabled={busy || !name} onClick={create}>
          {busy ? "Creating..." : "Create business"}
        </button>
      </section>
    </div>
  );
}

function HomePage({
  business,
  items,
  sales,
  expenses,
  recurringExpenses,
  notices,
  onOpenListing,
  onNavigate,
}: {
  business: Business;
  items: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  notices: Notice[];
  onOpenListing: (id: string) => void;
  onNavigate: (page: Page) => void;
}) {
  const activeSales = sales.filter((sale) => !sale.voided_at);
  const month = today().slice(0, 7);
  const monthSales = activeSales.filter((sale) => sale.sold_at.startsWith(month));
  const monthExpenses = expenses.filter(
    (expense) => expense.date.startsWith(month) && expense.source !== "inventory_auto",
  );
  const revenue = monthSales.reduce(
    (sum, sale) => sum + sale.sold_price_each * sale.quantity_sold,
    0,
  );
  const salesProfit = monthSales.reduce(
    (sum, sale) =>
      sum +
      saleNetProfit({
        soldPriceEach: sale.sold_price_each,
        quantity: sale.quantity_sold,
        costEach: sale.cost_each_snapshot,
        platformFee: sale.platform_fee,
        postageCost: sale.postage_cost,
        packagingCost: sale.packaging_cost,
        otherCost: sale.other_cost,
      }),
    0,
  );
  const businessExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const profit = roundMoney(salesProfit - businessExpenses);
  const soldQty = monthSales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
  const listedThisMonth = items.filter((item) => item.created_at.startsWith(month)).length;
  const upcomingRecurring = recurringExpenses
    .filter((entry) => entry.status === "active")
    .filter((entry) => {
      const due = daysUntil(entry.next_due_date);
      return due !== null && due <= 14;
    })
    .slice(0, 5);

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <Stat label="Revenue this month" value={gbp(revenue)} icon={<CircleDollarSign />} />
        <Stat label="Business net profit" value={gbp(profit)} icon={<Calculator />} />
        <Stat label="Active listings" value={items.filter((item) => item.quantity_available > 0).length} icon={<Boxes />} />
        <Stat label="Open notifications" value={notices.length} icon={<Bell />} />
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Action centre</p>
            <h2>Needs attention</h2>
          </div>
          <button className="ghost-button" onClick={() => onNavigate("notifications")}>
            View all
          </button>
        </div>
        <NoticeList notices={notices.slice(0, 6)} onOpenListing={onOpenListing} />
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Monthly targets</p>
            <h2>Progress</h2>
          </div>
          <button className="ghost-button" onClick={() => onNavigate("settings")}>Set targets</button>
        </div>
        <div className="target-grid">
          <ProgressMetric label="Revenue" value={revenue} target={business.monthly_revenue_target} money />
          <ProgressMetric label="Profit" value={profit} target={business.monthly_profit_target} money />
          <ProgressMetric label="Sold" value={soldQty} target={business.monthly_sold_target} />
          <ProgressMetric label="Listed" value={listedThisMonth} target={business.monthly_listed_target} />
        </div>
      </section>
      <div className="split-grid">
        <section className="panel">
          <h2>Quick actions</h2>
          <div className="quick-grid">
            <button className="quick-card" onClick={() => onNavigate("add-stock")}>
              <PackagePlus />
              Add stock
            </button>
            <button className="quick-card" onClick={() => onNavigate("inventory")}>
              <ShoppingBag />
              Mark sold
            </button>
            <button className="quick-card" onClick={() => onNavigate("expenses")}>
              <Receipt />
              Add expense
            </button>
          </div>
        </section>
        <section className="panel">
          <h2>Recent sales</h2>
          <div className="mini-list">
            {monthSales.slice(0, 5).map((sale) => (
              <div className="history-row" key={sale.id}>
                <div><strong>{sale.title_snapshot}</strong><span>{sale.sold_at} - {sale.platform}</span></div>
                <strong>{gbp(sale.sold_price_each * sale.quantity_sold)}</strong>
              </div>
            ))}
            {monthSales.length === 0 && <p className="empty-state">No sales recorded this month.</p>}
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>Upcoming recurring expenses</h2>
        <div className="mini-list">
          {upcomingRecurring.map((entry) => (
            <div className="history-row" key={entry.id}>
              <div><strong>{entry.description}</strong><span>{entry.next_due_date} - {entry.frequency}</span></div>
              <strong>{gbp(entry.amount)}</strong>
            </div>
          ))}
          {upcomingRecurring.length === 0 && <p className="empty-state">No recurring expenses due in the next 14 days.</p>}
          </div>
        </section>
    </div>
  );
}

function NotificationsPage({
  notices,
  onOpenListing,
}: {
  notices: Notice[];
  onOpenListing: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Action centre</p>
          <h2>Notifications</h2>
        </div>
      </div>
      <NoticeList notices={notices} onOpenListing={onOpenListing} />
    </section>
  );
}

function InventoryPage({
  items,
  onOpenListing,
}: {
  items: InventoryItem[];
  onOpenListing: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = items.filter((item) => {
    const text = `${item.sku || ""} ${item.title}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === "All" || item.status === status);
  });

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Stock</p>
          <h2>Inventory</h2>
        </div>
      </div>
      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU or title" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          {statuses.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Title</th>
              <th>Status</th>
              <th>Qty</th>
              <th>Cost</th>
              <th>List</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} onClick={() => onOpenListing(item.id)}>
                <td><span className="sku-pill">{item.sku || "No SKU"}</span></td>
                <td>{item.title}</td>
                <td><StatusBadge status={item.status} /></td>
                <td>{item.quantity_available} / {item.quantity_total}</td>
                <td>{item.cost_each == null ? "-" : gbp(item.cost_each)}</td>
                <td>{gbp(item.list_price_each)}</td>
                <td>{item.location || "-"}</td>
                <td><ChevronRight size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddStockPage({
  business,
  items,
  onCreated,
}: {
  business: Business;
  items: InventoryItem[];
  onCreated: (id: string) => void;
}) {
  const nextSku = useMemo(() => {
    const prefix = business.sku_prefix.toUpperCase();
    const numbers = items
      .map((item) => item.sku || "")
      .filter((sku) => sku.startsWith(prefix))
      .map((sku) => Number(sku.slice(prefix.length)))
      .filter(Number.isFinite);
    return `${prefix}${String((numbers.length ? Math.max(...numbers) : business.sku_start - 1) + 1).padStart(3, "0")}`;
  }, [business, items]);

  const [form, setForm] = useState({
    sku: nextSku,
    title: "",
    category: "Clothing",
    status: "Bought",
    cost_each: "",
    list_price_each: "",
    quantity: "1",
    location: "",
    source: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm((current) => ({ ...current, sku: nextSku })), [nextSku]);

  const save = async () => {
    setBusy(true);
    const quantity = Math.max(1, Number(form.quantity) || 1);
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        business_id: business.id,
        sku: form.sku.trim().toUpperCase() || null,
        title: form.title.trim(),
        category: form.category,
        source: form.source || null,
        location: form.location || null,
        notes: form.notes || null,
        status: form.status,
        listed_at: form.status === "Listed" ? today() : null,
        cost_each: form.cost_each ? Number(form.cost_each) : null,
        list_price_each: Number(form.list_price_each) || 0,
        quantity_total: quantity,
        quantity_available: quantity,
      })
      .select()
      .single();
    if (!error && data) {
      await supabase.from("listing_actions").insert({
        business_id: business.id,
        inventory_item_id: data.id,
        action_type: "created",
        note: `Created with quantity ${quantity}`,
      });
      if (form.cost_each && Number(form.cost_each) > 0) {
        await supabase.from("expenses").insert({
          business_id: business.id,
          inventory_item_id: data.id,
          date: today(),
          amount: roundMoney(Number(form.cost_each) * quantity),
          category: "Stock",
          description: `Stock purchase: ${form.title.trim()}${quantity > 1 ? ` (x${quantity})` : ""}`,
          source: "inventory_auto",
        });
      }
      onCreated(data.id);
    }
    setBusy(false);
  };

  return (
    <section className="panel form-panel">
      <p className="eyebrow">Stock</p>
      <h2>Add stock</h2>
      <div className="form-grid two">
        <Field label="SKU / reference" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
        <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={statuses.filter((status) => status !== "Sold" && status !== "Returned")} />
        <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <SelectField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categories} />
        <Field label="Cost each" value={form.cost_each} onChange={(v) => setForm({ ...form, cost_each: v })} type="number" />
        <Field label="Quantity" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} type="number" />
        <Field label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
        {["Ready To List", "Listed"].includes(form.status) && (
          <Field label="List price each" value={form.list_price_each} onChange={(v) => setForm({ ...form, list_price_each: v })} type="number" />
        )}
        <Field label="Location optional" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
      </div>
      <label className="field span-all">
        <span>Notes optional</span>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <button className="primary-button" disabled={busy || !form.title} onClick={save}>
        {busy ? "Saving..." : "Add stock"}
      </button>
    </section>
  );
}

function ListingDetail({
  business,
  item,
  sales,
  actions,
  platforms,
  onBack,
  onRefresh,
}: {
  business: Business;
  item: InventoryItem;
  sales: Sale[];
  actions: ListingAction[];
  platforms: PlatformSetting[];
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const activeSales = sales.filter((sale) => !sale.voided_at);
  const totalRevenue = activeSales.reduce(
    (sum, sale) => sum + sale.sold_price_each * sale.quantity_sold,
    0,
  );
  const totalProfit = activeSales.reduce(
    (sum, sale) =>
      sum +
      saleNetProfit({
        soldPriceEach: sale.sold_price_each,
        quantity: sale.quantity_sold,
        costEach: sale.cost_each_snapshot,
        platformFee: sale.platform_fee,
        postageCost: sale.postage_cost,
        packagingCost: sale.packaging_cost,
        otherCost: sale.other_cost,
      }),
    0,
  );

  const recommendation = listingRecommendation(item, actions);

  const voidSale = async (sale: Sale) => {
    if (!window.confirm("Void this sale and return the quantity to available stock?")) return;
    await supabase.from("sales").update({ voided_at: new Date().toISOString() }).eq("id", sale.id);
    await supabase
      .from("inventory_items")
      .update({
        quantity_available: item.quantity_available + sale.quantity_sold,
        status: "Listed",
      })
      .eq("id", item.id);
    await supabase.from("listing_actions").insert({
      business_id: business.id,
      inventory_item_id: item.id,
      action_type: "sale_voided",
      note: `Voided sale of ${sale.quantity_sold}`,
    });
    onRefresh();
  };

  return (
    <div className="page-stack">
      <button className="text-button align-left" onClick={onBack}>Back to inventory</button>
      <section className="listing-hero">
        <div>
          <span className="sku-pill">{item.sku || "No SKU"}</span>
          <h2>{item.title}</h2>
          <p>{item.category} {item.location ? `- ${item.location}` : ""}</p>
        </div>
        <div className="hero-actions">
          <button className="ghost-button" onClick={() => setEditOpen(true)}>Edit listing</button>
          <button className="primary-button" disabled={item.quantity_available <= 0} onClick={() => setSaleOpen(true)}>
            Mark sold
          </button>
        </div>
      </section>
      <div className="stat-grid">
        <Stat label="Available" value={`${item.quantity_available} / ${item.quantity_total}`} icon={<Boxes />} />
        <Stat label="Cost each" value={item.cost_each == null ? "-" : gbp(item.cost_each)} icon={<Receipt />} />
        <Stat label="Total cost" value={item.cost_each == null ? "-" : gbp(item.cost_each * item.quantity_total)} icon={<Calculator />} />
        <Stat label="List price" value={gbp(item.list_price_each)} icon={<ShoppingBag />} />
        <Stat label="Revenue" value={gbp(totalRevenue)} icon={<CircleDollarSign />} />
        <Stat label="Net profit" value={gbp(totalProfit)} icon={<Calculator />} />
      </div>
      {recommendation && (
        <section className="panel recommendation">
          <p className="eyebrow">Recommendation</p>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.message}</p>
        </section>
      )}
      <div className="split-grid">
        <section className="panel">
          <h2>Sales history</h2>
          <div className="mini-list">
            {sales.length === 0 && <p>No sales yet.</p>}
            {sales.map((sale) => (
              <div className="history-row" key={sale.id}>
                <div>
                  <strong>{sale.quantity_sold} sold on {sale.platform}</strong>
                  <span>{sale.sold_at} - {gbp(sale.sold_price_each)} each {sale.voided_at ? "- voided" : ""}</span>
                </div>
                {!sale.voided_at && (
                  <button className="ghost-button small" onClick={() => voidSale(sale)}>
                    <Undo2 size={14} />
                    Void
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Action history</h2>
          <div className="mini-list">
            {actions.length === 0 && <p>No actions logged yet.</p>}
            {actions.map((action) => (
              <div className="history-row" key={action.id}>
                <div>
                  <strong>{formatActionLabel(action.action_type)}</strong>
                  <span>{new Date(action.created_at).toLocaleString("en-GB")} {action.note ? `- ${action.note}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {saleOpen && (
        <SellModal
          business={business}
          item={item}
          platforms={platforms}
          onClose={() => setSaleOpen(false)}
          onSold={() => {
            setSaleOpen(false);
            onRefresh();
          }}
        />
      )}
      {editOpen && (
        <EditListingModal
          business={business}
          item={item}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function EditListingModal({
  business,
  item,
  onClose,
  onSaved,
}: {
  business: Business;
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    sku: item.sku || "",
    title: item.title,
    category: item.category,
    status: item.status,
    cost_each: item.cost_each == null ? "" : String(item.cost_each),
    list_price_each: String(item.list_price_each),
    quantity_total: String(item.quantity_total),
    quantity_available: String(item.quantity_available),
    location: item.location || "",
    source: item.source || "",
    notes: item.notes || "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const quantityTotal = Math.max(0, Number(form.quantity_total) || 0);
    const quantityAvailable = Math.max(
      0,
      Math.min(Number(form.quantity_available) || 0, quantityTotal),
    );
    const updates = {
      sku: form.sku.trim().toUpperCase() || null,
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      cost_each: form.cost_each ? Number(form.cost_each) : null,
      list_price_each: Number(form.list_price_each) || 0,
      quantity_total: quantityTotal,
      quantity_available: quantityAvailable,
      location: form.location || null,
      source: form.source || null,
      notes: form.notes || null,
      listed_at: form.status === "Listed" && !item.listed_at ? today() : item.listed_at,
    };
    const { error } = await supabase.from("inventory_items").update(updates).eq("id", item.id);
    if (!error) {
      await supabase.from("listing_actions").insert({
        business_id: business.id,
        inventory_item_id: item.id,
        action_type: "edited",
        note: "Listing details updated",
      });
      onSaved();
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="section-head">
          <div>
            <p className="eyebrow">Listing</p>
            <h2>Edit listing</h2>
          </div>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid two">
          <Field label="SKU / reference" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
          <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <SelectField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categories} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={statuses} />
          <Field label="Cost each" value={form.cost_each} onChange={(v) => setForm({ ...form, cost_each: v })} type="number" />
          <Field label="List price each" value={form.list_price_each} onChange={(v) => setForm({ ...form, list_price_each: v })} type="number" />
          <Field label="Quantity total" value={form.quantity_total} onChange={(v) => setForm({ ...form, quantity_total: v })} type="number" />
          <Field label="Quantity available" value={form.quantity_available} onChange={(v) => setForm({ ...form, quantity_available: v })} type="number" />
          <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          <Field label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <button className="primary-button" disabled={busy || !form.title} onClick={save}>
          {busy ? "Saving..." : "Save listing"}
        </button>
      </section>
    </div>
  );
}

function SellModal({
  business,
  item,
  platforms,
  onClose,
  onSold,
}: {
  business: Business;
  item: InventoryItem;
  platforms: PlatformSetting[];
  onClose: () => void;
  onSold: () => void;
}) {
  const [platform, setPlatform] = useState(platforms[0]?.name || "eBay");
  const selectedPlatform = platforms.find((entry) => entry.name === platform);
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(String(item.list_price_each));
  const [soldAt, setSoldAt] = useState(today());
  const [postage, setPostage] = useState(String(selectedPlatform?.default_postage_cost || 0));
  const [packaging, setPackaging] = useState(String(selectedPlatform?.default_packaging_cost || 0));
  const [busy, setBusy] = useState(false);

  const qty = Math.max(1, Math.min(Number(quantity) || 1, item.quantity_available));
  const soldPriceEach = Number(price) || 0;
  const platformFee = roundMoney(
    soldPriceEach * qty * ((selectedPlatform?.fee_percent || 0) / 100) +
      (selectedPlatform?.fixed_fee || 0),
  );
  const profit = saleNetProfit({
    soldPriceEach,
    quantity: qty,
    costEach: item.cost_each,
    platformFee,
    postageCost: Number(postage) || 0,
    packagingCost: Number(packaging) || 0,
  });

  const save = async () => {
    setBusy(true);
    const remaining = item.quantity_available - qty;
    const { error } = await supabase.from("sales").insert({
      business_id: business.id,
      inventory_item_id: item.id,
      sku_snapshot: item.sku,
      title_snapshot: item.title,
      quantity_sold: qty,
      sold_price_each: soldPriceEach,
      cost_each_snapshot: item.cost_each,
      platform,
      platform_fee: platformFee,
      postage_cost: Number(postage) || 0,
      packaging_cost: Number(packaging) || 0,
      sold_at: soldAt,
    });
    if (!error) {
      await supabase
        .from("inventory_items")
        .update({
          quantity_available: remaining,
          status: remaining === 0 ? "Sold" : item.status,
        })
        .eq("id", item.id);
      await supabase.from("listing_actions").insert({
        business_id: business.id,
        inventory_item_id: item.id,
        action_type: "sold",
        note: `Sold ${qty} on ${platform}`,
      });
      onSold();
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="section-head">
          <div>
            <p className="eyebrow">Sale</p>
            <h2>Mark as sold</h2>
          </div>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid two">
          <SelectField label="Platform" value={platform} onChange={setPlatform} options={platforms.map((entry) => entry.name)} />
          <Field label={`Quantity, max ${item.quantity_available}`} value={quantity} onChange={setQuantity} type="number" />
          <Field label="Sold price each" value={price} onChange={setPrice} type="number" />
          <Field label="Sold date" value={soldAt} onChange={setSoldAt} type="date" />
          <Field label="Postage cost" value={postage} onChange={setPostage} type="number" />
          <Field label="Packaging cost" value={packaging} onChange={setPackaging} type="number" />
        </div>
        <div className="profit-preview">
          <span>Estimated net profit</span>
          <strong>{gbp(profit)}</strong>
        </div>
        <button className="primary-button" disabled={busy || soldPriceEach <= 0} onClick={save}>
          {busy ? "Saving..." : "Save sale"}
        </button>
      </section>
    </div>
  );
}

function SalesPage({
  items,
  sales,
  onOpenListing,
}: {
  items: InventoryItem[];
  sales: Sale[];
  onOpenListing: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All");
  const platforms = ["All", ...new Set(sales.map((sale) => sale.platform))];
  const activeSales = sales.filter((sale) => !sale.voided_at);
  const filteredSales = sales.filter((sale) => {
    const text = `${sale.sku_snapshot || ""} ${sale.title_snapshot}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (platform === "All" || sale.platform === platform);
  });
  const revenue = activeSales.reduce((sum, sale) => sum + sale.sold_price_each * sale.quantity_sold, 0);
  const soldQty = activeSales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
  return (
    <div className="page-stack">
      <div className="stat-grid">
        <Stat label="Sales revenue" value={gbp(revenue)} icon={<CircleDollarSign />} />
        <Stat label="Items sold" value={soldQty} icon={<ShoppingBag />} />
        <Stat label="Sales recorded" value={activeSales.length} icon={<Receipt />} />
        <Stat label="Voided sales" value={sales.filter((sale) => sale.voided_at).length} icon={<Undo2 />} />
      </div>
      <section className="panel">
        <p className="eyebrow">Ledger</p>
        <h2>Sales</h2>
        <div className="toolbar compact">
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sales" />
          </div>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            {platforms.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>SKU</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Platform</th>
                <th>Revenue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id} onClick={() => onOpenListing(sale.inventory_item_id)}>
                  <td>{sale.sold_at}</td>
                  <td><span className="sku-pill">{sale.sku_snapshot || "No SKU"}</span></td>
                  <td>{sale.title_snapshot}</td>
                  <td>{sale.quantity_sold}</td>
                  <td>{sale.platform}</td>
                  <td>{gbp(sale.sold_price_each * sale.quantity_sold)}</td>
                  <td>{sale.voided_at ? "Voided" : items.find((item) => item.id === sale.inventory_item_id)?.status || "Recorded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ExpensesPage({
  business,
  expenses,
  recurringExpenses,
  onRefresh,
}: {
  business: Business;
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  onRefresh: () => void;
}) {
  const [expenseMode, setExpenseMode] = useState<"one-off" | "recurring">("one-off");
  const [form, setForm] = useState({
    date: today(),
    amount: "",
    category: "Other",
    description: "",
    due_date: "",
  });
  const [recurringForm, setRecurringForm] = useState({
    description: "",
    amount: "",
    category: "Other",
    frequency: "monthly",
    start_date: today(),
    next_due_date: today(),
  });

  const save = async () => {
    await supabase.from("expenses").insert({
      business_id: business.id,
      date: form.date,
      amount: Number(form.amount) || 0,
      category: form.category,
      description: form.description,
      due_date: form.due_date || null,
      source: "manual",
    });
    setForm({ date: today(), amount: "", category: "Other", description: "", due_date: "" });
    onRefresh();
  };

  const deleteExpense = async (expense: Expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    await supabase.from("expenses").delete().eq("id", expense.id);
    onRefresh();
  };

  const saveRecurring = async () => {
    await supabase.from("recurring_expenses").insert({
      business_id: business.id,
      description: recurringForm.description,
      amount: Number(recurringForm.amount) || 0,
      category: recurringForm.category,
      frequency: recurringForm.frequency,
      start_date: recurringForm.start_date,
      next_due_date: recurringForm.next_due_date,
      status: "active",
    });
    setRecurringForm({
      description: "",
      amount: "",
      category: "Other",
      frequency: "monthly",
      start_date: today(),
      next_due_date: today(),
    });
    onRefresh();
  };

  const markRecurringPaid = async (rule: RecurringExpense) => {
    await supabase.from("expenses").insert({
      business_id: business.id,
      date: rule.next_due_date,
      amount: rule.amount,
      category: rule.category,
      description: rule.description,
      source: "recurring",
    });
    await supabase
      .from("recurring_expenses")
      .update({ next_due_date: nextDueDate(rule.next_due_date, rule.frequency) })
      .eq("id", rule.id);
    onRefresh();
  };

  const setRecurringStatus = async (rule: RecurringExpense, status: string) => {
    await supabase
      .from("recurring_expenses")
      .update({ status, end_date: status === "ended" ? today() : rule.end_date })
      .eq("id", rule.id);
    onRefresh();
  };

  return (
    <div className="page-stack">
      <section className="panel form-panel">
        <p className="eyebrow">Spending</p>
        <h2>Add expense</h2>
        <div className="segmented">
          <button className={expenseMode === "one-off" ? "active" : ""} onClick={() => setExpenseMode("one-off")}>One-off</button>
          <button className={expenseMode === "recurring" ? "active" : ""} onClick={() => setExpenseMode("recurring")}>Recurring</button>
        </div>
        {expenseMode === "one-off" ? (
        <div className="form-grid two">
          <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
          <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
          <Field label="Due date optional" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
          <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
        ) : (
        <div className="form-grid two">
          <Field label="Description" value={recurringForm.description} onChange={(v) => setRecurringForm({ ...recurringForm, description: v })} />
          <Field label="Amount" type="number" value={recurringForm.amount} onChange={(v) => setRecurringForm({ ...recurringForm, amount: v })} />
          <Field label="Category" value={recurringForm.category} onChange={(v) => setRecurringForm({ ...recurringForm, category: v })} />
          <SelectField label="Frequency" value={recurringForm.frequency} onChange={(v) => setRecurringForm({ ...recurringForm, frequency: v })} options={["weekly", "monthly", "quarterly", "yearly"]} />
          <Field label="Start date" type="date" value={recurringForm.start_date} onChange={(v) => setRecurringForm({ ...recurringForm, start_date: v })} />
          <Field label="Next due date" type="date" value={recurringForm.next_due_date} onChange={(v) => setRecurringForm({ ...recurringForm, next_due_date: v })} />
        </div>
        )}
        {expenseMode === "one-off" ? (
          <button className="primary-button" disabled={!form.amount || !form.description} onClick={save}>Save expense</button>
        ) : (
          <button className="primary-button" disabled={!recurringForm.amount || !recurringForm.description} onClick={saveRecurring}>Save recurring expense</button>
        )}
      </section>
      <section className="panel">
        <h2>Recurring expenses</h2>
        <div className="mini-list">
          {recurringExpenses.length === 0 && <p className="empty-state">No recurring expenses yet.</p>}
          {recurringExpenses.map((rule) => (
            <div className="history-row" key={rule.id}>
              <div>
                <strong>{rule.description}</strong>
                <span>{gbp(rule.amount)} {rule.frequency} - next due {rule.next_due_date} - {rule.status}</span>
              </div>
              <div className="row-actions">
                {rule.status === "active" && <button className="ghost-button small" onClick={() => markRecurringPaid(rule)}>Mark paid</button>}
                {rule.status === "active" && <button className="ghost-button small" onClick={() => setRecurringStatus(rule, "paused")}>Pause</button>}
                {rule.status === "paused" && <button className="ghost-button small" onClick={() => setRecurringStatus(rule, "active")}>Resume</button>}
                {rule.status !== "ended" && <button className="ghost-button small" onClick={() => setRecurringStatus(rule, "ended")}>End</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Expenses</h2>
        <div className="mini-list">
          {expenses.length === 0 && <p className="empty-state">No expenses recorded yet.</p>}
          {expenses.map((expense) => (
            <div className="history-row" key={expense.id}>
              <div>
                <strong>{expense.description}</strong>
                <span>{expense.date} - {expense.category} - {expense.source}</span>
              </div>
              <div className="row-actions">
                <strong>{gbp(expense.amount)}</strong>
                <button className="ghost-button small" onClick={() => deleteExpense(expense)}>
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompChecker() {
  const [brand, setBrand] = useState("");
  const [itemType, setItemType] = useState("");
  const [colour, setColour] = useState("");
  const [size, setSize] = useState("");
  const query = [brand, itemType, colour, size].filter(Boolean).join(" ").trim();
  const encoded = encodeURIComponent(query);

  return (
    <section className="panel form-panel">
      <p className="eyebrow">Pricing</p>
      <h2>Comp checker</h2>
      <p className="muted">Enter search terms, then open marketplace searches in a new tab. Sellerbase does not auto-fill marketplace results.</p>
      <div className="form-grid two">
        <Field label="Brand" value={brand} onChange={setBrand} placeholder="Nike" />
        <Field label="Item type" value={itemType} onChange={setItemType} placeholder="hoodie" />
        <Field label="Colour" value={colour} onChange={setColour} placeholder="grey" />
        <Field label="Size" value={size} onChange={setSize} placeholder="large" />
      </div>
      <div className="quick-grid">
        <a className={`quick-card ${!query ? "disabled" : ""}`} href={query ? `https://www.ebay.co.uk/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1` : undefined} target="_blank" rel="noreferrer">Open eBay sold search</a>
        <a className={`quick-card ${!query ? "disabled" : ""}`} href={query ? `https://www.ebay.co.uk/sch/i.html?_nkw=${encoded}` : undefined} target="_blank" rel="noreferrer">Open eBay active search</a>
        <a className={`quick-card ${!query ? "disabled" : ""}`} href={query ? `https://www.vinted.co.uk/catalog?search_text=${encoded}` : undefined} target="_blank" rel="noreferrer">Open Vinted search</a>
        <a className={`quick-card ${!query ? "disabled" : ""}`} href={query ? `https://www.depop.com/search/?q=${encoded}` : undefined} target="_blank" rel="noreferrer">Open Depop search</a>
      </div>
    </section>
  );
}

function CalendarPage({
  business,
  entries,
  onRefresh,
}: {
  business: Business;
  entries: CalendarEntry[];
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({ date: today(), text: "", type: "note" });
  const [monthCursor, setMonthCursor] = useState(today().slice(0, 7));
  const upcoming = entries.filter((entry) => entry.date >= today()).slice(0, 12);
  const monthDate = new Date(`${monthCursor}-01T00:00:00`);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const calendarCells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  const save = async () => {
    await supabase.from("calendar_entries").insert({
      business_id: business.id,
      date: form.date,
      text: form.text,
      type: form.type,
    });
    setForm({ date: today(), text: "", type: "note" });
    onRefresh();
  };

  const deleteEntry = async (entry: CalendarEntry) => {
    if (!window.confirm(`Delete calendar entry "${entry.text}"?`)) return;
    await supabase.from("calendar_entries").delete().eq("id", entry.id);
    onRefresh();
  };

  return (
    <div className="page-stack">
      <section className="panel form-panel">
        <p className="eyebrow">Planning</p>
        <h2>Calendar</h2>
        <div className="form-grid two">
          <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          <SelectField label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={["note", "bill", "task", "tax", "stock"]} />
          <Field label="Text" value={form.text} onChange={(v) => setForm({ ...form, text: v })} />
        </div>
        <button className="primary-button" disabled={!form.text} onClick={save}>Add calendar entry</button>
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>{monthDate.toLocaleString("en-GB", { month: "long", year: "numeric" })}</h2>
          <input type="month" value={monthCursor} onChange={(event) => setMonthCursor(event.target.value)} />
        </div>
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
          {calendarCells.map((cell) => {
            const date = cell.day ? `${monthCursor}-${String(cell.day).padStart(2, "0")}` : "";
            const dayEntries = entries.filter((entry) => entry.date === date);
            return (
              <div className="calendar-cell" key={cell.key}>
                {cell.day && <span>{cell.day}</span>}
                {dayEntries.slice(0, 3).map((entry) => <em key={entry.id}>{entry.text}</em>)}
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>Upcoming</h2>
        <div className="mini-list">
          {upcoming.length === 0 && <p className="empty-state">No upcoming calendar entries.</p>}
          {upcoming.map((entry) => (
            <div className="history-row" key={entry.id}>
              <div>
                <strong>{entry.text}</strong>
                <span>{entry.date} - {entry.type}</span>
              </div>
              <button className="ghost-button small" onClick={() => deleteEntry(entry)}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnalyticsPage({
  items,
  sales,
  expenses,
}: {
  items: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
}) {
  const activeSales = sales.filter((sale) => !sale.voided_at);
  const revenue = activeSales.reduce((sum, sale) => sum + sale.sold_price_each * sale.quantity_sold, 0);
  const salesProfit = activeSales.reduce(
    (sum, sale) =>
      sum +
      saleNetProfit({
        soldPriceEach: sale.sold_price_each,
        quantity: sale.quantity_sold,
        costEach: sale.cost_each_snapshot,
        platformFee: sale.platform_fee,
        postageCost: sale.postage_cost,
        packagingCost: sale.packaging_cost,
        otherCost: sale.other_cost,
      }),
    0,
  );
  const manualExpenses = expenses
    .filter((expense) => expense.source !== "inventory_auto")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const byPlatform = groupSum(activeSales, (sale) => sale.platform, (sale) => sale.sold_price_each * sale.quantity_sold);
  const byCategory = groupSum(
    items,
    (item) => item.category,
    (item) => item.quantity_available * item.list_price_each,
  );

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <Stat label="All-time revenue" value={gbp(revenue)} icon={<CircleDollarSign />} />
        <Stat label="Sales profit" value={gbp(salesProfit)} icon={<Calculator />} />
        <Stat label="Business net" value={gbp(salesProfit - manualExpenses)} icon={<BarChart3 />} />
        <Stat label="Sell-through" value={`${items.length ? Math.round((items.filter((item) => item.quantity_available === 0).length / items.length) * 100) : 0}%`} icon={<Percent />} />
      </div>
      <div className="split-grid">
        <BreakdownPanel title="Revenue by platform" rows={byPlatform} />
        <BreakdownPanel title="Listed value by category" rows={byCategory} />
      </div>
    </div>
  );
}

function TaxPage({ sales, expenses }: { sales: Sale[]; expenses: Expense[] }) {
  const [year, setYear] = useState("2025");
  const start = `${year}-04-06`;
  const end = `${Number(year) + 1}-04-05`;
  const yearSales = sales.filter((sale) => !sale.voided_at && sale.sold_at >= start && sale.sold_at <= end);
  const yearExpenses = expenses.filter(
    (expense) =>
      expense.date >= start &&
      expense.date <= end &&
      expense.source !== "inventory_auto",
  );
  const revenue = yearSales.reduce((sum, sale) => sum + sale.sold_price_each * sale.quantity_sold, 0);
  const costOfGoods = yearSales.reduce((sum, sale) => sum + (sale.cost_each_snapshot || 0) * sale.quantity_sold, 0);
  const saleCosts = yearSales.reduce(
    (sum, sale) => sum + sale.platform_fee + sale.postage_cost + sale.packaging_cost + sale.other_cost,
    0,
  );
  const expenseTotal = yearExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = roundMoney(revenue - costOfGoods - saleCosts - expenseTotal);
  const tradingAllowance = 1000;
  const roughTaxable = Math.max(0, netProfit - tradingAllowance);
  const exportCsv = () => {
    const rows = [
      ["Type", "Date", "Description", "Amount", "Category"],
      ...yearSales.map((sale) => ["Sale", sale.sold_at, sale.title_snapshot, sale.sold_price_each * sale.quantity_sold, sale.platform]),
      ...yearExpenses.map((expense) => ["Expense", expense.date, expense.description, expense.amount, expense.category]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `sellerbase-tax-${year}-${Number(year) + 1}.csv`;
    link.click();
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">UK estimate</p>
            <h2>Tax summary</h2>
          </div>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            {["2024", "2025", "2026", "2027"].map((option) => (
              <option key={option} value={option}>{option}/{String(Number(option) + 1).slice(2)}</option>
            ))}
          </select>
          <button className="ghost-button" onClick={exportCsv}>Export CSV</button>
        </div>
        <p className="muted">Organisational estimate only. Stock added through Add Stock is counted through cost of goods, so automatic stock expenses are ignored here.</p>
      </section>
      <div className="stat-grid">
        <Stat label="Sales" value={gbp(revenue)} icon={<CircleDollarSign />} />
        <Stat label="Cost of goods" value={gbp(costOfGoods)} icon={<Boxes />} />
        <Stat label="Expenses" value={gbp(expenseTotal + saleCosts)} icon={<Receipt />} />
        <Stat label="Net profit" value={gbp(netProfit)} icon={<Calculator />} />
      </div>
      <section className="panel">
        <h2>Rough taxable position</h2>
        <div className="mini-list">
          <div className="history-row"><span>Net profit</span><strong>{gbp(netProfit)}</strong></div>
          <div className="history-row"><span>Less trading allowance</span><strong>-{gbp(tradingAllowance)}</strong></div>
          <div className="history-row"><span>Rough taxable amount</span><strong>{gbp(roughTaxable)}</strong></div>
        </div>
      </section>
    </div>
  );
}

function HaulsPage({ items, sales }: { items: InventoryItem[]; sales: Sale[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("profit");
  const sources = [...new Set(items.map((item) => item.source || "Unspecified"))];
  const rows = sources.map((source) => {
    const sourceItems = items.filter((item) => (item.source || "Unspecified") === source);
    const sourceSales = sales.filter((sale) => sourceItems.some((item) => item.id === sale.inventory_item_id) && !sale.voided_at);
    const spend = sourceItems.reduce((sum, item) => sum + (item.cost_each || 0) * item.quantity_total, 0);
    const revenue = sourceSales.reduce((sum, sale) => sum + sale.sold_price_each * sale.quantity_sold, 0);
    return { source, items: sourceItems.length, spend, revenue, profit: revenue - spend };
  }).filter((row) => row.source.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "profit" ? b.profit - a.profit : sort === "revenue" ? b.revenue - a.revenue : b.items - a.items);

  return (
    <section className="panel">
      <p className="eyebrow">Buying performance</p>
      <h2>Hauls and sources</h2>
      <div className="toolbar compact">
        <div className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source or haul" />
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="profit">Profit</option>
          <option value="revenue">Revenue</option>
          <option value="items">Items</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Source / haul</th><th>Items</th><th>Spend</th><th>Revenue</th><th>Profit so far</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source}>
                <td>{row.source}</td>
                <td>{row.items}</td>
                <td>{gbp(row.spend)}</td>
                <td>{gbp(row.revenue)}</td>
                <td>{gbp(row.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BuyingCalculator({
  business,
  platforms,
  onOpenSettings,
}: {
  business: Business;
  platforms: PlatformSetting[];
  onOpenSettings: () => void;
}) {
  const [platform, setPlatform] = useState(platforms[0]?.name || "eBay");
  const selected = platforms.find((entry) => entry.name === platform);
  const [cost, setCost] = useState("");
  const [sale, setSale] = useState("");
  const [postage, setPostage] = useState(String(selected?.default_postage_cost || 0));
  const [packaging, setPackaging] = useState(String(selected?.default_packaging_cost || 0));
  const saleValue = Number(sale) || 0;
  const platformFee = roundMoney(saleValue * ((selected?.fee_percent || 0) / 100) + (selected?.fixed_fee || 0));
  const profit = roundMoney(saleValue - (Number(cost) || 0) - platformFee - (Number(postage) || 0) - (Number(packaging) || 0));
  const margin = saleValue > 0 ? Math.round((profit / saleValue) * 100) : 0;
  const minProfit = business.min_buy_profit ?? 5;
  const minMargin = business.min_buy_margin ?? 25;
  const isReady = profit >= minProfit && margin >= minMargin;

  return (
    <section className="panel form-panel">
      <p className="eyebrow">Buying decision</p>
      <h2>Buying calculator</h2>
      <div className="setup-note">
        Minimum target: {gbp(minProfit)} profit and {minMargin}% margin.
        <button className="text-button" onClick={onOpenSettings}>Change in Settings</button>
      </div>
      <div className="form-grid two">
        <SelectField label="Expected platform" value={platform} onChange={setPlatform} options={platforms.map((entry) => entry.name)} />
        <Field label="Buy cost" value={cost} onChange={setCost} type="number" />
        <Field label="Expected sale price" value={sale} onChange={setSale} type="number" />
        <Field label="Postage cost" value={postage} onChange={setPostage} type="number" />
        <Field label="Packaging cost" value={packaging} onChange={setPackaging} type="number" />
      </div>
      <div className="profit-preview">
        <span>Expected profit</span>
        <strong>{gbp(profit)} ({margin}%)</strong>
      </div>
      <p className="muted">{isReady ? "Meets your buying thresholds." : "Below your buying thresholds. Raise sale price, lower cost, or skip it."}</p>
    </section>
  );
}

function BreakdownPanel({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="mini-list">
        {rows.length === 0 && <p className="empty-state">No data yet.</p>}
        {rows.map((row) => (
          <div className="breakdown-row" key={row.label}>
            <span>{row.label}</span>
            <div><i style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></div>
            <strong>{gbp(row.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupSum<T>(rows: T[], label: (row: T) => string, value: (row: T) => number) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = label(row) || "Other";
    map.set(key, (map.get(key) || 0) + value(row));
  }
  return [...map.entries()].map(([entryLabel, entryValue]) => ({ label: entryLabel, value: entryValue }));
}

function SettingsPage({
  business,
  platforms,
  items,
  sales,
  onRefresh,
}: {
  business: Business;
  platforms: PlatformSetting[];
  items: InventoryItem[];
  sales: Sale[];
  onRefresh: () => void;
}) {
  const [businessForm, setBusinessForm] = useState({
    sku_prefix: business.sku_prefix,
    sku_start: String(business.sku_start),
    theme: business.theme || "dark",
    min_buy_profit: String(business.min_buy_profit ?? 5),
    min_buy_margin: String(business.min_buy_margin ?? 25),
    monthly_revenue_target: business.monthly_revenue_target == null ? "" : String(business.monthly_revenue_target),
    monthly_profit_target: business.monthly_profit_target == null ? "" : String(business.monthly_profit_target),
    monthly_sold_target: business.monthly_sold_target == null ? "" : String(business.monthly_sold_target),
    monthly_listed_target: business.monthly_listed_target == null ? "" : String(business.monthly_listed_target),
  });
  const nextSku = useMemo(() => {
    const prefix = businessForm.sku_prefix.toUpperCase();
    const numbers = items
      .map((item) => item.sku || "")
      .filter((sku) => sku.startsWith(prefix))
      .map((sku) => Number(sku.slice(prefix.length)))
      .filter(Number.isFinite);
    return `${prefix}${String((numbers.length ? Math.max(...numbers) : Number(businessForm.sku_start) - 1) + 1).padStart(3, "0")}`;
  }, [businessForm.sku_prefix, businessForm.sku_start, items]);

  const saveBusinessSettings = async () => {
    await supabase.from("businesses").update({
      sku_prefix: businessForm.sku_prefix.toUpperCase(),
      sku_start: Number(businessForm.sku_start) || 1,
      theme: businessForm.theme,
      min_buy_profit: Number(businessForm.min_buy_profit) || 0,
      min_buy_margin: Number(businessForm.min_buy_margin) || 0,
      monthly_revenue_target: businessForm.monthly_revenue_target ? Number(businessForm.monthly_revenue_target) : null,
      monthly_profit_target: businessForm.monthly_profit_target ? Number(businessForm.monthly_profit_target) : null,
      monthly_sold_target: businessForm.monthly_sold_target ? Number(businessForm.monthly_sold_target) : null,
      monthly_listed_target: businessForm.monthly_listed_target ? Number(businessForm.monthly_listed_target) : null,
    }).eq("id", business.id);
    onRefresh();
  };

  const updatePlatform = async (platform: PlatformSetting, key: keyof PlatformSetting, value: string) => {
    await supabase
      .from("platform_settings")
      .update({ [key]: Number(value) || 0 })
      .eq("id", platform.id);
    onRefresh();
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Business</p>
        <h2>{business.name}</h2>
        <div className="form-grid two">
          <Field label="SKU prefix" value={businessForm.sku_prefix} onChange={(v) => setBusinessForm({ ...businessForm, sku_prefix: v })} />
          <Field label="SKU start number" value={businessForm.sku_start} onChange={(v) => setBusinessForm({ ...businessForm, sku_start: v })} type="number" />
          <SelectField label="Theme" value={businessForm.theme} onChange={(v) => setBusinessForm({ ...businessForm, theme: v })} options={["dark", "light"]} />
        </div>
        <div className="setup-note">Next SKU preview: <strong>{nextSku}</strong></div>
      </section>
      <section className="panel">
        <p className="eyebrow">Buying calculator</p>
        <h2>Buying thresholds</h2>
        <div className="form-grid two">
          <Field label="Minimum profit" value={businessForm.min_buy_profit} onChange={(v) => setBusinessForm({ ...businessForm, min_buy_profit: v })} type="number" />
          <Field label="Minimum margin %" value={businessForm.min_buy_margin} onChange={(v) => setBusinessForm({ ...businessForm, min_buy_margin: v })} type="number" />
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Home progress</p>
        <h2>Monthly targets</h2>
        <div className="form-grid two">
          <Field label="Revenue target" value={businessForm.monthly_revenue_target} onChange={(v) => setBusinessForm({ ...businessForm, monthly_revenue_target: v })} type="number" />
          <Field label="Profit target" value={businessForm.monthly_profit_target} onChange={(v) => setBusinessForm({ ...businessForm, monthly_profit_target: v })} type="number" />
          <Field label="Sold items target" value={businessForm.monthly_sold_target} onChange={(v) => setBusinessForm({ ...businessForm, monthly_sold_target: v })} type="number" />
          <Field label="Listed items target" value={businessForm.monthly_listed_target} onChange={(v) => setBusinessForm({ ...businessForm, monthly_listed_target: v })} type="number" />
        </div>
        <button className="primary-button" onClick={saveBusinessSettings}>Save business settings</button>
      </section>
      <section className="panel">
        <p className="eyebrow">Profit settings</p>
        <h2>Platform fees</h2>
        <div className="platform-grid">
          {platforms.map((platform) => (
            <div className="platform-card" key={platform.id}>
              <h3>{platform.name}</h3>
              <Field label="Fee %" value={String(platform.fee_percent)} onChange={(v) => updatePlatform(platform, "fee_percent", v)} type="number" />
              <Field label="Fixed fee" value={String(platform.fixed_fee)} onChange={(v) => updatePlatform(platform, "fixed_fee", v)} type="number" />
              <Field label="Postage default" value={String(platform.default_postage_cost)} onChange={(v) => updatePlatform(platform, "default_postage_cost", v)} type="number" />
              <Field label="Packaging default" value={String(platform.default_packaging_cost)} onChange={(v) => updatePlatform(platform, "default_packaging_cost", v)} type="number" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function buildNotices(
  items: InventoryItem[],
  expenses: Expense[],
  recurringExpenses: RecurringExpense[],
  sales: Sale[],
  stored: Notification[],
): Notice[] {
  const notices: Notice[] = stored
    .filter((notice) => notice.status === "active")
    .map((notice) => ({
      id: notice.id,
      title: notice.title,
      message: notice.message,
      category: notice.category,
      priority: notice.priority as Notice["priority"],
      itemId: notice.inventory_item_id || undefined,
      route: notice.route as Page | undefined,
    }));

  for (const item of items) {
    if (item.quantity_available <= 0) continue;
    if (item.cost_each == null) {
      notices.push({
        id: `missing-cost-${item.id}`,
        title: `${item.sku || item.title} is missing cost price`,
        message: "Add the cost price so profit, tax and buying reports stay accurate.",
        category: "Missing data",
        priority: "medium",
        itemId: item.id,
      });
    }
    if (item.status === "Ready To List" && daysSince(item.updated_at) >= 6) {
      notices.push({
        id: `ready-${item.id}`,
        title: `${item.sku || item.title} is ready to list`,
        message: "This item has been ready for nearly a week. List it or change the status.",
        category: "Listing",
        priority: "medium",
        itemId: item.id,
      });
    }
    if (item.status === "Listed") {
      const listedDays = daysSince(item.listed_at || item.created_at);
      if (listedDays >= 60) {
        notices.push({
          id: `stale-60-${item.id}`,
          title: `${item.sku || item.title} has been listed ${listedDays} days`,
          message: "Consider bundling, clearing, or moving this into dead stock.",
          category: "Stale stock",
          priority: "high",
          itemId: item.id,
        });
      } else if (listedDays >= 30) {
        notices.push({
          id: `stale-30-${item.id}`,
          title: `${item.sku || item.title} has been listed ${listedDays} days`,
          message: "Consider a price reduction or relist.",
          category: "Stale stock",
          priority: "medium",
          itemId: item.id,
        });
      }
    }
  }

  for (const expense of expenses) {
    if (!expense.due_date) continue;
    const days = daysUntil(expense.due_date);
    if (expense.due_date <= today()) {
      notices.push({
        id: `bill-${expense.id}`,
        title: `Bill due: ${expense.description}`,
        message: `${gbp(expense.amount)} is due ${expense.due_date === today() ? "today" : "now"}.`,
        category: "Bills",
        priority: "high",
        route: "expenses",
      });
    } else if (days !== null && days <= 7) {
      notices.push({
        id: `bill-soon-${expense.id}`,
        title: `Upcoming bill: ${expense.description}`,
        message: `${gbp(expense.amount)} is due on ${expense.due_date}.`,
        category: "Bills",
        priority: "medium",
        route: "expenses",
      });
    }
  }

  for (const rule of recurringExpenses.filter((entry) => entry.status === "active")) {
    const dueIn = daysUntil(rule.next_due_date);
    if (dueIn !== null && dueIn <= 7) {
      notices.push({
        id: `recurring-${rule.id}`,
        title: `${rule.description} is ${dueIn <= 0 ? "due now" : `due in ${dueIn} days`}`,
        message: `${gbp(rule.amount)} ${rule.frequency}. Mark it paid from Expenses when it has been paid.`,
        category: "Recurring",
        priority: dueIn <= 0 ? "high" : "medium",
        route: "expenses",
      });
    }
  }

  const month = today().slice(0, 7);
  const monthSales = sales.filter((sale) => !sale.voided_at && sale.sold_at.startsWith(month));
  if (new Date().getDate() >= 20 && monthSales.length === 0) {
    notices.push({
      id: "no-sales-month",
      title: "No sales recorded this month",
      message: "Check whether sales need entering or stale stock needs action.",
      category: "Targets",
      priority: "low",
      route: "sales",
    });
  }

  return notices.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
}

function listingRecommendation(item: InventoryItem, actions: ListingAction[]) {
  if (item.status !== "Listed" || item.quantity_available <= 0) return null;
  const listedDays = daysSince(item.listed_at || item.created_at);
  const reductions = actions.filter((action) => action.action_type === "price_reduced").length;
  if (listedDays >= 60 && reductions >= 2) {
    return {
      title: "Consider bundle or clear",
      message: "This item has been listed for a while and already had multiple reductions.",
    };
  }
  if (listedDays >= 30) {
    return {
      title: "Review price or relist",
      message: "This listing is old enough to deserve action before it becomes dead stock.",
    };
  }
  return null;
}

function priorityWeight(priority: string) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function formatActionLabel(actionType: string) {
  const labels: Record<string, string> = {
    created: "Stock created",
    edited: "Listing edited",
    sold: "Marked sold",
    sale_voided: "Sale voided",
    price_reduced: "Price reduced",
    relisted: "Relisted",
    bundled: "Bundled",
    cleared: "Cleared",
  };
  return labels[actionType] || actionType.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function NoticeList({
  notices,
  onOpenListing,
}: {
  notices: Notice[];
  onOpenListing: (id: string) => void;
}) {
  if (notices.length === 0) return <p className="empty-state">Nothing needs attention right now.</p>;
  return (
    <div className="notice-list">
      {notices.map((notice) => (
        <button
          className={`notice-card ${notice.priority}`}
          key={notice.id}
          onClick={() => notice.itemId && onOpenListing(notice.itemId)}
        >
          <span>{notice.category}</span>
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
        </button>
      ))}
    </div>
  );
}

function NotificationDrawer({
  notices,
  onOpenAll,
  onOpenListing,
}: {
  notices: Notice[];
  onOpenAll: () => void;
  onOpenListing: (id: string) => void;
}) {
  return (
    <div className="notification-drawer">
      <div className="section-head">
        <h2>Notifications</h2>
        <button className="text-button" onClick={onOpenAll}>Open all</button>
      </div>
      <NoticeList notices={notices} onOpenListing={onOpenListing} />
    </div>
  );
}

function BusinessSwitcher({
  businesses,
  active,
  onChange,
}: {
  businesses: Business[];
  active: Business;
  onChange: (business: Business) => void;
}) {
  return (
    <select className="business-switcher" value={active.id} onChange={(e) => onChange(businesses.find((b) => b.id === e.target.value)!)} >
      {businesses.map((business) => (
        <option key={business.id} value={business.id}>{business.name}</option>
      ))}
    </select>
  );
}

function NavButton({
  icon,
  label,
  page,
  active,
  count,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  page: Page;
  active: Page;
  count?: number;
  onClick: (page: Page) => void;
}) {
  return (
    <button className={`nav-button ${active === page ? "active" : ""}`} onClick={() => onClick(page)}>
      {icon}
      <span>{label}</span>
      {!!count && <em>{count}</em>}
    </button>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="stat-card">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  target,
  money = false,
}: {
  label: string;
  value: number;
  target?: number | null;
  money?: boolean;
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="progress-card">
      <div>
        <span>{label}</span>
        <strong>{money ? gbp(value) : value}</strong>
      </div>
      <div className="progress-track"><i style={{ width: `${pct}%` }} /></div>
      <small>{target ? `${pct}% of ${money ? gbp(target) : target}` : "No target set"}</small>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status.toLowerCase().split(" ").join("-")}`}>{status}</span>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="panel placeholder">
      <ClipboardList />
      <h2>{title}</h2>
      <p>This page is planned for the next build slice.</p>
    </section>
  );
}

function FullScreenLoader() {
  return (
    <div className="loading-screen">
      <div className="loader" />
    </div>
  );
}

function pageTitle(page: Page) {
  const titles: Record<Page, string> = {
    home: "Home",
    notifications: "Notifications",
    inventory: "Inventory",
    "add-stock": "Add stock",
    sales: "Sales",
    expenses: "Expenses",
    comp: "Comp checker",
    calendar: "Calendar",
    hauls: "Hauls",
    buying: "Buying calculator",
    analytics: "Analytics",
    tax: "Tax summary",
    settings: "Settings",
  };
  return titles[page];
}
