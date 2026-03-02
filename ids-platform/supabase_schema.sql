-- Supabase/PostgreSQL schema for IDS Platform

-- traffic_logs: all analyzed flows
create table if not exists public.traffic_logs (
  id uuid primary key default gen_random_uuid(),
  src_ip text not null,
  dest_ip text not null,
  src_port integer,
  dest_port integer not null,
  protocol text,
  is_attack boolean not null default false,
  probability double precision,
  severity text,
  label text,
  analyzed_at timestamptz not null default now(),
  flow_features jsonb,
  -- Research-oriented fields for hybrid ML/rule evaluation
  ml_probability double precision,
  suspicion_score double precision,
  hybrid_score double precision,
  detection_source text,
  ground_truth_label text,
  traffic_source text DEFAULT 'SYNTHETIC'
);

-- attack_logs: only flows classified as attacks
create table if not exists public.attack_logs (
  id uuid primary key default gen_random_uuid(),
  traffic_log_id uuid references public.traffic_logs(id) on delete cascade,
  src_ip text not null,
  dest_ip text not null,
  dest_port integer,
  severity text,
  probability double precision,
  label text,
  detected_at timestamptz not null default now()
);

-- blocked_ips: simulated firewall block list
create table if not exists public.blocked_ips (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null unique,
  severity text,
  reason text,
  first_blocked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  is_blocked boolean not null default true
);

