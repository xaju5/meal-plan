# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


# MEAL PLAN
## DATABASE MODEL
```mermaid
erDiagram
  dishes {
    uuid id PK
    text house_code
    text name
    timestamp created_at
  }
  ingredients {
    uuid id PK
    text house_code
    text name
  }
  dish_ingredients {
    uuid id PK
    uuid dish_id FK
    uuid ingredient_id FK
    numeric quantity
    text unit
  }
  weeks {
    uuid id PK
    text house_code
    int year
    int week_number
  }
  week_plan {
    uuid id PK
    text house_code
    uuid week_id FK
    text day
    text slot
    uuid dish_id FK
  }
  dishes ||--o{ dish_ingredients : "has"
  ingredients ||--o{ dish_ingredients : "used in"
  weeks ||--o{ week_plan : "contains"
  dishes ||--o{ week_plan : "assigned to"
```

<!-- ```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   dishes    │     │ dish_ingredients │     │   ingredients   │
│─────────────│     │──────────────────│     │─────────────────│
│ id          │◄────│ dish_id          │     │ id              │
│ house_code  │     │ ingredient_id    │────►│ house_code      │
│ name        │     │ quantity         │     │ name            │
└─────────────┘     └──────────────────┘     └─────────────────┘
       ▲
       │
┌──────────────┐        ┌─────────────┐
│  week_plan   │        │    weeks    │
│──────────────│        │─────────────│
│ week_id      │───────►│ id          │
│ day          │        │ house_code  │
│ slot         │        │ start_date  │
│ dish_id      │        └─────────────┘
└──────────────┘
``` -->