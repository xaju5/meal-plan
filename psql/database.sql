CREATE TABLE ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE dishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE dish_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC,
  unit TEXT
);

CREATE TABLE weeks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INT NOT NULL,
  week_number INT NOT NULL,
  UNIQUE (year, week_number)
);

CREATE TABLE week_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  slot TEXT NOT NULL,
  dish_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
  UNIQUE (week_id, day, slot)
);

CREATE TABLE shopping_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  checked BOOLEAN DEFAULT false,
  checked_at TIMESTAMP,
  UNIQUE (week_id, ingredient_id)
);