import { telegram } from "./functions/main.ts";

await telegram.api.setMyCommands({ commands: [{
    command: "today",
    description: "Розклад на сьогодні"
  }, {
    command: "tomorrow",
    description: "Розклад на завтра"
}, {
    command: "week",
    description: "Розклад на тиждень"
},
{
    command: "tasks",
    description: "Активні домашні завдання"
}, {
    command: "taskload",
    description: "Завантажити домашні завдання в базу даних"
}]})