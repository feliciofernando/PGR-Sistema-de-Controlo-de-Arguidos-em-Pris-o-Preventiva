-- Migration: Add nome_pai and nome_mae columns to arguidos table
-- Run this SQL in the Supabase SQL Editor (https://supabase.com/dashboard/project/tuzwhphlmaqdljdhztuy/sql)

ALTER TABLE arguidos ADD COLUMN IF NOT EXISTS nome_pai TEXT DEFAULT '';
ALTER TABLE arguidos ADD COLUMN IF NOT EXISTS nome_mae TEXT DEFAULT '';

COMMENT ON COLUMN arguidos.nome_pai IS 'Nome do pai do arguido';
COMMENT ON COLUMN arguidos.nome_mae IS 'Nome da mãe do arguido';
