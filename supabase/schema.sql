create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  currency text not null default 'GBP',
  tax_region text not null default 'UK',
  sku_prefix text not null default 'SB',
  sku_start integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  source text,
  purchase_date date not null default current_date,
  total_spend numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  batch_id uuid references public.stock_batches(id) on delete set null,
  sku text,
  title text not null,
  category text not null default 'Other',
  source text,
  condition text,
  location text,
  notes text,
  cost_each numeric(12,2),
  list_price_each numeric(12,2) not null default 0,
  quantity_total integer not null default 1 check (quantity_total >= 0),
  quantity_available integer not null default 1 check (quantity_available >= 0),
  status text not null default 'Bought',
  listed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  sku_snapshot text,
  title_snapshot text not null,
  quantity_sold integer not null default 1 check (quantity_sold > 0),
  sold_price_each numeric(12,2) not null default 0,
  cost_each_snapshot numeric(12,2),
  platform text not null default 'Other',
  platform_fee numeric(12,2) not null default 0,
  postage_cost numeric(12,2) not null default 0,
  packaging_cost numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  sold_at date not null default current_date,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  date date not null default current_date,
  amount numeric(12,2) not null default 0,
  category text not null default 'Other',
  description text not null,
  source text not null default 'manual',
  due_date date,
  recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null default 0,
  category text not null default 'Other',
  frequency text not null default 'monthly',
  start_date date not null default current_date,
  next_due_date date not null default current_date,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.listing_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  action_type text not null,
  note text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null default 'general',
  priority text not null default 'medium',
  route text,
  status text not null default 'active',
  due_date date,
  snoozed_until date,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  fee_percent numeric(6,3) not null default 0,
  fixed_fee numeric(12,2) not null default 0,
  default_postage_cost numeric(12,2) not null default 0,
  default_packaging_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null,
  period text not null default 'monthly',
  target_revenue numeric(12,2),
  target_profit numeric(12,2),
  target_items integer,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  text text not null,
  type text not null default 'note',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_inventory_items_updated_at on public.inventory_items;
create trigger touch_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.stock_batches enable row level security;
alter table public.inventory_items enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.listing_actions enable row level security;
alter table public.notifications enable row level security;
alter table public.platform_settings enable row level security;
alter table public.targets enable row level security;
alter table public.calendar_entries enable row level security;

create policy "profiles own rows" on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());

create policy "businesses own rows" on public.businesses
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "stock batches via business owner" on public.stock_batches
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "inventory via business owner" on public.inventory_items
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "sales via business owner" on public.sales
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "expenses via business owner" on public.expenses
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "recurring expenses via business owner" on public.recurring_expenses
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "listing actions via business owner" on public.listing_actions
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "notifications via business owner" on public.notifications
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "platform settings via business owner" on public.platform_settings
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "targets via business owner" on public.targets
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create policy "calendar via business owner" on public.calendar_entries
for all using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

create index if not exists idx_businesses_user_id on public.businesses(user_id);
create index if not exists idx_inventory_business_id on public.inventory_items(business_id);
create index if not exists idx_inventory_sku on public.inventory_items(business_id, sku);
create index if not exists idx_sales_business_id on public.sales(business_id);
create index if not exists idx_expenses_business_id on public.expenses(business_id);
create index if not exists idx_recurring_expenses_business_id on public.recurring_expenses(business_id);
create index if not exists idx_notifications_business_status on public.notifications(business_id, status);
