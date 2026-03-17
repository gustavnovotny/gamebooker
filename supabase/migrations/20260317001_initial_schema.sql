-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- GAMEBOOKS
-- ─────────────────────────────────────────────
create table gamebooks (
  id                   uuid primary key default uuid_generate_v4(),
  creator_id           uuid not null references auth.users(id) on delete cascade,
  creator_display_name text not null,
  title                text not null,
  description          text default '',
  cover_image_url      text,
  genre                text,
  status               text not null default 'draft'
                         check (status in ('draft', 'published')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ITEMS  (defined before choices to avoid forward-reference)
-- ─────────────────────────────────────────────
create table items (
  id                   uuid primary key default uuid_generate_v4(),
  gamebook_id          uuid not null references gamebooks(id) on delete cascade,
  name                 text not null,
  description          text default '',
  stat_bonus_attribute text check (stat_bonus_attribute in
                         ('sila', 'inteligence', 'obratnost', 'stesti')),
  stat_bonus_value     int not null default 0
);

-- ─────────────────────────────────────────────
-- NODES
-- ─────────────────────────────────────────────
create table nodes (
  id          uuid primary key default uuid_generate_v4(),
  gamebook_id uuid not null references gamebooks(id) on delete cascade,
  type        text not null check (type in
                ('story', 'combat', 'item_discovery', 'ending')),
  title       text not null,
  content     text not null default '',
  is_start    boolean not null default false,
  x           float not null default 0,
  y           float not null default 0
);

-- ─────────────────────────────────────────────
-- CHOICES
-- ─────────────────────────────────────────────
create table choices (
  id                 uuid primary key default uuid_generate_v4(),
  from_node_id       uuid not null references nodes(id) on delete cascade,
  to_node_id         uuid not null references nodes(id) on delete cascade,
  text               text not null,
  condition_item_id  uuid references items(id) on delete set null
);

-- ─────────────────────────────────────────────
-- NODE ITEMS (junction: items found at a node)
-- ─────────────────────────────────────────────
create table node_items (
  node_id uuid not null references nodes(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  primary key (node_id, item_id)
);

-- ─────────────────────────────────────────────
-- COMBAT CONFIGS
-- ─────────────────────────────────────────────
create table combat_configs (
  id               uuid primary key default uuid_generate_v4(),
  node_id          uuid not null unique references nodes(id) on delete cascade,
  enemy_name       text not null,
  enemy_sila       int not null default 5,
  enemy_inteligence int not null default 5,
  enemy_obratnost  int not null default 5,
  enemy_stesti     int not null default 5,
  enemy_hp         int not null default 15,
  player_attribute text not null
                     check (player_attribute in ('sila', 'inteligence', 'obratnost')),
  enemy_attribute  text not null
                     check (enemy_attribute in ('sila', 'inteligence', 'obratnost')),
  victory_node_id  uuid references nodes(id) on delete set null,
  defeat_node_id   uuid references nodes(id) on delete set null
);

-- ─────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gamebooks_updated_at
  before update on gamebooks
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table gamebooks     enable row level security;
alter table nodes         enable row level security;
alter table choices       enable row level security;
alter table items         enable row level security;
alter table node_items    enable row level security;
alter table combat_configs enable row level security;

-- gamebooks: public read of published; creator full access
create policy "Public can view published gamebooks"
  on gamebooks for select
  using (status = 'published');

create policy "Creators manage own gamebooks"
  on gamebooks for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- nodes: public read if gamebook published; creator full access
create policy "Public can view nodes of published gamebooks"
  on nodes for select
  using (
    exists (
      select 1 from gamebooks g
      where g.id = nodes.gamebook_id and g.status = 'published'
    )
  );

create policy "Creators manage nodes of own gamebooks"
  on nodes for all
  using (
    exists (
      select 1 from gamebooks g
      where g.id = nodes.gamebook_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from gamebooks g
      where g.id = nodes.gamebook_id and g.creator_id = auth.uid()
    )
  );

-- choices: same pattern as nodes
create policy "Public can view choices of published gamebooks"
  on choices for select
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = choices.from_node_id and g.status = 'published'
    )
  );

create policy "Creators manage choices of own gamebooks"
  on choices for all
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = choices.from_node_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = choices.from_node_id and g.creator_id = auth.uid()
    )
  );

-- items: same pattern
create policy "Public can view items of published gamebooks"
  on items for select
  using (
    exists (
      select 1 from gamebooks g
      where g.id = items.gamebook_id and g.status = 'published'
    )
  );

create policy "Creators manage items of own gamebooks"
  on items for all
  using (
    exists (
      select 1 from gamebooks g
      where g.id = items.gamebook_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from gamebooks g
      where g.id = items.gamebook_id and g.creator_id = auth.uid()
    )
  );

-- node_items: same pattern
create policy "Public can view node_items of published gamebooks"
  on node_items for select
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = node_items.node_id and g.status = 'published'
    )
  );

create policy "Creators manage node_items of own gamebooks"
  on node_items for all
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = node_items.node_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = node_items.node_id and g.creator_id = auth.uid()
    )
  );

-- combat_configs: same pattern
create policy "Public can view combat_configs of published gamebooks"
  on combat_configs for select
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = combat_configs.node_id and g.status = 'published'
    )
  );

create policy "Creators manage combat_configs of own gamebooks"
  on combat_configs for all
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = combat_configs.node_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = combat_configs.node_id and g.creator_id = auth.uid()
    )
  );
