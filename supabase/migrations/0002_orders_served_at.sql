-- Run once in the Supabase SQL editor, after 0001_init.sql.
-- Lets the kitchen dashboard (#4) mark an order as served. Null means still to do.

alter table orders add column served_at timestamptz;
