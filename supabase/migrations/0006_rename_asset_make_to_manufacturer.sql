-- BCS Services Mobile v2.0 Migration: Align Asset Columns
-- Renames public.assets.make column to manufacturer to match Zod and frontend code.

alter table public.assets rename column make to manufacturer;
