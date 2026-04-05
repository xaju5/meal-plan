DROP TABLE IF EXISTS week_plan;
DROP TABLE IF EXISTS dish_ingredients;
DROP TABLE IF EXISTS weeks;
DROP TABLE IF EXISTS dishes;
DROP TABLE IF EXISTS ingredients;

CREATE TABLE houses (
  code TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  house_code TEXT NOT NULL REFERENCES houses(code) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE dishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  house_code TEXT NOT NULL REFERENCES houses(code) ON DELETE CASCADE,
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
  house_code TEXT NOT NULL REFERENCES houses(code) ON DELETE CASCADE,
  year INT NOT NULL,
  week_number INT NOT NULL,
  UNIQUE (house_code, year, week_number)
);

CREATE TABLE week_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  slot TEXT NOT NULL,
  dish_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
  UNIQUE (week_id, day, slot)
);