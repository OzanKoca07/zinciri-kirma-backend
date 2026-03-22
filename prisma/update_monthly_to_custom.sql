UPDATE "Habit"
SET "frequency" = 'CUSTOM'::"HabitFrequency"
WHERE "frequency"::text = 'MONTHLY';