import { BaseEntity, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Group } from "./Group.ts";

interface ScheduleDataRow {
  study_time: string;
  study_time_begin: string;
  study_time_end: string;
  week_day: string;
  full_date: string;
  discipline: string;
  study_type: string;
  cabinet: string;
  employee: string;
  employee_short: string;
  study_subgroup: string | null;
}

interface ScheduleData {
  d: ScheduleDataRow[];
}

export interface ScheduledDisciplines {
    study_time: string, // хз яка різниця, 08_30
    study_time_start: string, // 08:30
    study_time_end: string, // 09:50
    study_type: string, // Лекція, Практичні заняття... (лаби хз)

    name: string // Дискретні структури
    teacher: string // Щирба Віктор Самоілович
    cabinet: string // 43 або 43 (ЦК)

    week_day: string // Понеділок
    full_date: string // 10.09.2025

    tasks?: string[] // ["t.me/c1/1", "t.me/c1/2"]
}

@Entity()
export class Schedule extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;


    // Айді групи в бд
    @PrimaryColumn("numeric")
    group: number;

    // З якого часу дійсний розклад
    @PrimaryColumn("numeric")
    from: number;

    // До якого часу дійсний розклад
    @PrimaryColumn("numeric")
    to: number;

    // Розклад
    @PrimaryColumn("text")
    scheduleOfDisciplines: ScheduledDisciplines[]

    async fetch(from: number, to: number, group: Group) {
        const aStartDate = new Date(from).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
        const aEndDate = new Date(to).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
        

        const url = `https://vnz.osvita.net/WidgetSchedule.asmx/GetScheduleDataX?aVuzID=${group.aVuzId}&aStudyGroupID="${group.aStudyGroupId}"&aStartDate="${aStartDate}"&aEndDate="${aEndDate}"&aStudyTypeID=null`;

        console.log(url)

        const response  = await fetch(url);

        const result: ScheduleData = await response.json();
        const scheduleOfDisciplines: ScheduledDisciplines[] = [];

        result.d.forEach(row => {
            if (row.study_time_begin && row.study_time_end) {
                scheduleOfDisciplines.push({
                    study_time: row.study_time,
                    study_time_start: row.study_time_begin,
                    study_time_end: row.study_time_end,
                    study_type: row.study_type,
                    name: row.discipline,
                    teacher: row.employee,
                    cabinet: row.cabinet,
                    week_day: row.week_day,
                    full_date: row.full_date
                });
            }
        });
        this.scheduleOfDisciplines = scheduleOfDisciplines
        return scheduleOfDisciplines;
    };
}  