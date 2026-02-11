import { Telegram } from "puregram"
import { Group, Schedule, Task } from "../datasource/index.ts";

class Handler {
    telegram: Telegram
    group: Group;
    constructor(telegram: Telegram) {
        this.telegram = telegram
    };

    async getSchedule(dayAfter: number) {
        const schedule = new Schedule();
        schedule.group = this.group.id;
        schedule.from = Date.now()
        schedule.to = Date.now() + 86400000
        schedule.scheduleOfDisciplines = [];

        await schedule.fetch(schedule.from, schedule.to, this.group);

        const day = new Date(new Date().setDate(new Date().getDate() + dayAfter))
        const date = day.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

        const scheduleToday = schedule.scheduleOfDisciplines.filter((d) => d.full_date === date);
        const tasks = await Task.findBy({ deadline: date })

        await schedule.save();
        return { scheduleToday, tasks }
    }

    async sendSchedule(dayAfter: number) {
        const { scheduleToday, tasks } = await this.getSchedule(dayAfter);
        const day = new Date(new Date().setDate(new Date().getDate() + dayAfter))
        const date = day.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

        const message = (await this.telegram.api.sendMessage({
            chat_id: this.group.chat_id,
            text: `Розклад занять на ${date}${scheduleToday.length ? ':\n\n' : ' відсутній'}` + scheduleToday.map((d) => `<b> [${d.study_time_start}]</b>: <i>${d.name} (${d.study_type})</i>\nКабінет: ${d.cabinet}\nВикладач: <b><u>${d.teacher}</u></b>\nЗавдання: ${tasks.filter((t) => t.discipline === d.name && t.deadline === date).length ? tasks.filter((t) => t.discipline === d.name && t.deadline === date).map((t, i) => `<b>[${i + 1}] (${t.links.map((l, ii) => `<a href="${l}">${ii + 1}</a>`).join(', ')})</b>`).join(', ') : 'немає'}`).join('\n\n'),
            parse_mode: 'HTML',
        }));


        scheduleToday.length ? await this.telegram.api.pinChatMessage({
            chat_id: message.chat.id,
            message_id: message.message_id
        }) : null
    };

    async createTask(discipline: string, deadline: string, links: string[]){
        const task = new Task();
        task.discipline = discipline
        task.deadline = deadline;
        task.group = this.group.id;
        task.links = links;
        await task.save();
    }

}

export { Handler }