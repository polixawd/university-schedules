import { DataSource } from "typeorm"
import { Group } from "./models/Group.ts";
import { Schedule } from "./models/Schedule.ts";
import { Member } from "./models/Member.ts"
import { Task } from "./models/Task.ts";

const AppDataSource = new DataSource({
  type: "sqljs",
  location: "database.sql",
  autoSave: true,
  // logging: true,
  synchronize: true,
  relationLoadStrategy: "join",
  dropSchema: false,
  entities: [Group, Schedule, Member, Task] 
})

await AppDataSource.initialize()
export { AppDataSource, Group, Schedule, Member, Task }