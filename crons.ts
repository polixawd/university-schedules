import cron from "node-cron";
import moment from "moment-timezone";
import { Group, Schedule, Task } from "./datasource/index.ts";
import { Handler } from "./functions/handler.ts";
import { telegram } from "./functions/main.ts";

const currentTz = moment.tz.guess();
const tzDiff =
  moment.tz(currentTz).utcOffset() - moment.tz("Europe/Kyiv").utcOffset();
const diffHours = tzDiff / 60;

// sending actual schedule to chat every day at 7:00 am
cron.schedule(`0 ${diffHours + 7} * * 1-5`, async () => {
  const groups = await Group.find();

  for (const group of groups) {
    const schedule = new Schedule();
    schedule.group = group.id;
    schedule.from = Date.now();
    schedule.to = Date.now() + 86400000;
    schedule.scheduleOfDisciplines = [];
    await schedule.fetch(schedule.from, schedule.to, group);
    await schedule.save();

    const day = new Date();
    const date = day
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, ".");

    const scheduleToday = schedule.scheduleOfDisciplines.filter(
      (d) => d.full_date === date,
    );
    const tasks = await Task.findBy({ deadline: date });

    const message = await telegram.api.sendMessage({
      chat_id: group.chat_id,
      text:
        `Розклад занять на ${date}${scheduleToday.length ? ":\n\n" : " відсутній"}` +
        scheduleToday
          .map(
            (d) =>
              `<b>[${d.study_time_start}]</b>: <i>${d.name} (${d.study_type})</i>\nКабінет: ${d.cabinet}\nВикладач: <b><u>${d.teacher}</u></b>\nЗавдання: ${
                tasks.filter(
                  (t) => t.discipline === d.name && t.deadline === date,
                ).length
                  ? tasks
                      .filter(
                        (t) => t.discipline === d.name && t.deadline === date,
                      )
                      .map(
                        (t, i) =>
                          `<b>[${i + 1}] (${t.links.map((l, ii) => `<a href="${l}">${ii + 1}</a>`).join(", ")})</b>`,
                      )
                      .join(", ")
                  : "немає"
              }`,
          )
          .join("\n\n"),
      parse_mode: "HTML",
    });

    scheduleToday.length
      ? await telegram.api.pinChatMessage({
          chat_id: message.chat.id,
          message_id: message.message_id,
        })
      : null;

    setTimeout(async () => {
      // unpinning after 24 hours
      await telegram.api.unpinChatMessage({
        chat_id: message.chat.id,
        message_id: message.message_id,
      });
    }, 86400000);
  }
});

export async function nextDay() {
  const groups = await Group.find();

  for (const group of groups) {
    const tasks = (await Task.findBy({ group: group.id })).sort((a, b) => {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const tasksForNextDay = tasks.filter(
      (t) =>
        t.deadline === moment(new Date()).add(1, "days").format("DD.MM.YYYY"),
    );

    const scheduleForTomorrow = await new Schedule().fetch(
      new Date().setDate(new Date().getDate() + 1),
      new Date().setDate(new Date().getDate() + 2),
      group,
    );

    if (scheduleForTomorrow[0].study_time_start !== "08:30") {
      setTimeout(async () => {
        await telegram.api.sendMessage({
          chat_id: group.chat_id,
          text: `Перша пара розпочнеться о ${scheduleForTomorrow[0].study_time_start}, ${scheduleForTomorrow[0].name} (${scheduleForTomorrow[0].study_type})`,
        });
      }, 5000);
    } 

      if (!tasksForNextDay.length) return;

      const message = await telegram.api.sendMessage({
        chat_id: group.chat_id,
        text: `Завдання на завтрашній день (${moment(new Date()).add(1, "days").format("DD.MM.YYYY")})${tasksForNextDay.length ? ":\n\n" : " відсутні"}${tasksForNextDay.map((t, i) => `${i + 1}. (${t.links.map((l) => `<a href="${l}"><b><i>${t.discipline}</i></a>`).join(", ")})</b>`).join("\n")}`,
        parse_mode: "HTML",
      });

      tasksForNextDay.length
        ? await telegram.api.pinChatMessage({
            chat_id: message.chat.id,
            message_id: message.message_id,
          })
        : null;

      tasksForNextDay.length
        ? setTimeout(async () => {
            // unpinning after 24 hours
            await telegram.api.unpinChatMessage({
              chat_id: message.chat.id,
              message_id: message.message_id,
            });
          }, 86400000 / 2)
        : null;
    }
  
}

// on every 17:30 sending tasks for next day expect friday and saturday
cron.schedule(`30 ${diffHours + 17} * * 0-4`, async () => {
  await nextDay();
});

export async function friday() {
  const groups = await Group.find();

  for (const group of groups) {
    const tasks = (await Task.findBy({ group: group.id })).sort((a, b) => {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const today = new Date().setDate(new Date().getDate() - 2);
    const nextWeek = [];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      nextWeek.push(
        date.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      );
    }

    console.log(today, nextWeek, startDate);

    const schedule = new Schedule();
    schedule.group = group.id;
    schedule.from = Date.now();
    schedule.to = Date.now() + 86400000 * 7;
    schedule.scheduleOfDisciplines = [];
    await schedule.fetch(schedule.from, schedule.to, group);
    await schedule.save();

    console.log(await schedule.fetch(schedule.from, schedule.to, group));

    const tasksForNextWeek = tasks.filter((t) => nextWeek.includes(t.deadline));

    console.log(tasksForNextWeek, schedule.scheduleOfDisciplines);

    const message = await telegram.api.sendMessage({
      chat_id: group.chat_id,
      text: `Розклад занять і завдань на наступний тиждень (${nextWeek[0]} - ${nextWeek[6]})${
        schedule.scheduleOfDisciplines.length
          ? `:${nextWeek
              .filter((d) => {
                const scheduleForDay = schedule.scheduleOfDisciplines.filter(
                  (s) => s.full_date === d,
                );
                return scheduleForDay.length;
              })
              .map((d, i) => {
                const tasksForDay = tasksForNextWeek.filter(
                  (t) => t.deadline === d,
                );
                const scheduleForDay = schedule.scheduleOfDisciplines.filter(
                  (s) => s.full_date === d,
                );

                console.log(d, i, tasksForDay, scheduleForDay);

                return `\n\n<b><u>${scheduleForDay[i].week_day}</u></b>\n${scheduleForDay.map((s) => `<b> [${s.study_time_start}]</b>: <i>${s.name} (${s.study_type})</i>`).join("\n")}`;
              })}`
          : " відсутній"
      }`,
      parse_mode: "HTML",
    });

    tasksForNextWeek.length
      ? await telegram.api.pinChatMessage({
          chat_id: message.chat.id,
          message_id: message.message_id,
        })
      : null;

    tasksForNextWeek.length
      ? setTimeout(async () => {
          // unpinning after 72 hours
          await telegram.api.unpinChatMessage({
            chat_id: message.chat.id,
            message_id: message.message_id,
          });
        }, 86400000 * 3)
      : null;
  }
}

// send schedule for next week at friday 17:30
cron.schedule(`30 ${diffHours + 17} * * 5`, async () => {
  await friday();
});
