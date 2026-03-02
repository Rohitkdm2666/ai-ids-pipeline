-- Run this in Supabase SQL Editor to add missing columns.
-- Fixes: "Could not find the 'detection_source' column of 'traffic_logs'"

-- Add research/hybrid columns if they don't exist
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS ml_probability double precision;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS suspicion_score double precision;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS hybrid_score double precision;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS detection_source text;
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS ground_truth_label text;

-- Add traffic_source for SYNTHETIC vs REAL_PCAP
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS traffic_source text DEFAULT 'SYNTHETIC';
