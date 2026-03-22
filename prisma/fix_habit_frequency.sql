ALTER TYPE "HabitFrequency" ADD VALUE IF NOT EXISTS 'CUSTOM';

UPDATE "Habit"
SET "frequency" = 'CUSTOM'::"HabitFrequency"
WHERE "frequency"::text = 'MONTHLY';