import { Telegram } from "puregram";
import { config } from "dotenv";
import {
  AppDataSource,
  Group,
  Member,
  Schedule,
  Task,
} from "../datasource/index.ts";
import { parse, isValid } from "date-fns";
import { friday, nextDay } from "../crons.ts";

config();

const telegram = Telegram.fromToken(process.env.token);

telegram.updates.on("message", async (context) => {

  let member = await Member.findOneBy({ id: context.from.id });

  if (!member && (await Group.findOneBy({ chat_id: context.chat.id }))) {
    const member = new Member();
    member.id = context.from.id;
    member.group = await Group.findOneBy({ chat_id: context.chat.id }).then(
      (g) => g.aStudyGroupId,
    );
    member.name = context.from.firstName || context.from.id.toString();
    member.surname = context.from.lastName || "";
    await member.save();

    await context.reply(
      `Зареєстровано нового користувача (${member.id}, GROUP=${member.group}, NAME=${member.name}, SURNAME=${member.surname})`,
    );
  }

  if (member?.blacklisted) return;

  if (context.text.startsWith("/engine")) {
    if (context.from.id !== Number(process.env.developer)) return;

    switch (context.text.split(" ")[1]) {
      case "throw_week_script": {
        await friday();
        break;
      }

      case "throw_nextday_script": {
        await nextDay();
        break;
      }

      case "throw_database_reset": {
        await AppDataSource.manager.clear(Schedule);
        await context.reply(`База даних була очищена.`);
        break;
      }

      case "throw_member_check": {
        const members = await Member.find();
        await context.reply(members.length.toString());
        console.log(members);
        break;
      }

      case "throw_member_blacklist": {
        let member = await Member.findOneBy({
          id: Number(context.text.split(" ")[2]),
        });
        if (!member) {
          member = new Member();
          member.id = Number(context.text.split(" ")[2]);
          member.group = (await Group.findOneBy({ chat_id: context.chat.id })).aStudyGroupId;
          member.blacklisted = true;
          member.name = (
            await telegram.api.getChatMember({
              chat_id: context.chat.id,
              user_id: Number(context.text.split(" ")[2]),
            })
          ).user.first_name || context.text.split(" ")[2];
          member.surname = (
            await telegram.api.getChatMember({
              chat_id: context.chat.id,
              user_id: Number(context.text.split(" ")[2]),
            })
          ).user.last_name || "";
        } else {
          member.blacklisted = true;
        }

        await member.save();

        await context.reply(`${member.name} / ${member.id}`);
        break;
      }
      default:
        const [
          id,
          aVuzId,
          aStudyGroupId,
          headmanId,
          deputyHeadmanId,
          speciality,
          faculty,
          course,
          yearOfStart,
          balance,
        ] = context.text.split(", ");

        const group = new Group();
        group.id =
          Number(id) || (await Group.findAndCount().then((g) => g[1] + 1)) || 1;
        group.aVuzId = aVuzId;
        group.aStudyGroupId = aStudyGroupId;
        group.headmanId = parseInt(headmanId);
        group.deputyHeadmanId = parseInt(deputyHeadmanId);
        group.speciality = speciality;
        group.faculty = faculty;
        group.course = parseInt(course);
        group.yearOfStart = parseInt(yearOfStart);
        group.balance = parseInt(balance);
        group.chat_id = context.chat.id;
        group.members = [group.headmanId, group.deputyHeadmanId];
        console.log(group);
        await group.save();

        // parse as js code
        await context.reply(`${JSON.stringify(group, null, 2)}`, {
          parse_mode: "HTML",
        });
        break;
    }
  }

  if (context.text.split(" ")[0] === "дз") {
    await telegram.api.sendChatAction({
      chat_id: context.chat.id,
      action: "typing",
    });

    // for gen
    const schedule = new Schedule();
    schedule.group = context.chat.id;
    schedule.from = Date.now();
    schedule.to = Date.now() + 86400000 * 14;
    schedule.scheduleOfDisciplines = [];
    await schedule.fetch(
      schedule.from,
      schedule.to,
      await Group.findOneBy({ chat_id: context.chat.id }),
    );

    const all_discilplines: string[] = schedule.scheduleOfDisciplines
      .map((d) => d.name)
      .flat()
      .reduce((acc, d) => (acc.includes(d) ? acc : [...acc, d]), []);

    const disciplines_abbr = all_discilplines.map((d) =>
      d
        .replaceAll("(", "")
        .replaceAll(")", "")
        .replaceAll("_", "")
        .split(" ")
        .map((d) => d[0])
        .join(""),
    );

    const disciplines: { full: string; abbr: string }[] = [];
    for (let i = 0; i < all_discilplines.length; i++) {
      disciplines.push({
        full: all_discilplines[i].toLowerCase(),
        abbr: disciplines_abbr[i].toLowerCase(),
      });
    }

    const discipline_ = context.text.split(" ")[1].toLowerCase();
    const deadline_ = context.text.split(" ")[2];
    const replyLink = context.replyToMessage.id;

    const discipline = disciplines.find(
      (d) => d.abbr.includes(discipline_) || d.full.includes(discipline_),
    )?.full;
    const deadline =
      deadline_ ||
      schedule.scheduleOfDisciplines.find(
        (d) =>
          d.name.toLowerCase() === discipline &&
          parse(d.full_date, "dd.MM.yyyy", new Date()).getTime() >
            new Date().getTime(),
      )?.full_date;

    const links = replyLink
      ? [`https://t.me/c/${String(context.chat.id).slice(4)}/${replyLink}`]
      : [`https://t.me/c/${context.chat.id}/${context.id}`];

    if (!discipline) {
      await context.reply(
        `Введіть назву дисципліни, початок її назви, або скорочену назву\n\n<i>Наприклад: вища математика, вища, вишмат / АЛГОРИТМИ та структУРИ ДАНих, алгоритми, атсд</i>\n\n<pre>дз [дисципліна] [дедлайн]</pre>`,
        { parse_mode: "HTML" },
      );
    }

    if (!isValid(parse(deadline, "dd.MM.yyyy", new Date()))) {
      await context.reply(
        "Введіть дедлайн, до якого потрібно буде виконати це завдання. Дата має співпадати з датою наступного заняття\. Якщо дату наступного заняття невідомо - не вказуйте цей пункт, система пізніше сама підтягне потрібу дату\n\n<i>Наприклад: 02\.06\.2024</i>\n\n<pre>дз [дисципліна] [дедлайн]</pre>",
        { parse_mode: "HTML" },
      );
    }

    if (discipline && isValid(parse(deadline, "dd.MM.yyyy", new Date()))) {
      const task = new Task();
      task.discipline = discipline;
      task.deadline = deadline;
      task.group = await Group.findOneBy({ chat_id: context.chat.id }).then(
        (g) => g.id,
      );
      task.links = links;
      await task.save();

      await context.reply(
        `[Завдання](${links[0]}) з дисципліни "**${discipline}**" на дату **${deadline === "01.01.1970" ? "наступного заняття" : deadline}** успішно додано`,
        { parse_mode: "Markdown" },
      );
    }
  } else if (context.text.startsWith("/week")) {
    await telegram.api.sendChatAction({
      chat_id: context.chat.id,
      action: "typing",
    });

    const schedule = new Schedule();
    schedule.group = context.chat.id;
    schedule.from = Date.now();
    schedule.to = Date.now() + 86400000 * 7;
    schedule.scheduleOfDisciplines = [];
    await schedule.fetch(
      schedule.from,
      schedule.to,
      await Group.findOneBy({ chat_id: context.chat.id }),
    );

    const scheduleByDay: {
      day: string;
      tasks: {
        study_time: string;
        study_time_start: string;
        study_time_end: string;
        study_type: string;
        name: string;
        teacher: string;
        cabinet: string;
        week_day: string;
        full_date: string;
        tasklinks?: string[];
      }[];
    }[] = [];

    const tasks = await Task.findBy({ group: context.chat.id });

    for (let i = 0; i < schedule.scheduleOfDisciplines.length; i++) {
      const day = schedule.scheduleOfDisciplines[i].week_day;
      const task = tasks.find(
        (t) =>
          t.discipline === schedule.scheduleOfDisciplines[i].name &&
          t.deadline === schedule.scheduleOfDisciplines[i].full_date,
      );
      if (!scheduleByDay.find((d) => d.day === day)) {
        scheduleByDay.push({ day, tasks: [schedule.scheduleOfDisciplines[i]] });
      } else {
        scheduleByDay
          .find((d) => d.day === day)
          ?.tasks.push(schedule.scheduleOfDisciplines[i]);
      }
    }

    await context.reply(
      `Розклад на тиждень ${new Date(schedule.from).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} - ${new Date(schedule.to).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}:\n\n${scheduleByDay.map((sd) => `<b><u>${sd.day}</u></b>\n${sd.tasks.map((t) => `- [${t.study_time_start}] <i>${t.name}</i> (${t.study_type})`).join("\n")}`).join("\n\n")}`,
      { parse_mode: "HTML" },
    );
  } else if (
    context.text.startsWith("/tomorrow") ||
    context.text.startsWith("/today")
  ) {
    await sendSchedule(
      await Group.findOneBy({ chat_id: context.chat.id }),
      context.text.startsWith("/tomorrow") ? 1 : 0,
    );
  }
});

async function sendSchedule(group: Group, dayAfter: number) {
  const schedule = new Schedule();
  schedule.group = group.id;
  schedule.from = Date.now();
  schedule.to = Date.now() + 86400000;
  schedule.scheduleOfDisciplines = [];

  await schedule.fetch(schedule.from, schedule.to, group);

  const day = new Date(new Date().setDate(new Date().getDate() + dayAfter));
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

  await schedule.save();
  const message = await telegram.api.sendMessage({
    chat_id: group.chat_id,
    text:
      `Розклад занять на ${date}${scheduleToday.length ? ":\n\n" : " відсутній"}` +
      scheduleToday
        .map(
          (d) =>
            `<b> [${d.study_time_start}]</b>: <i>${d.name} (${d.study_type})</i>\nАудиторія: ${d.cabinet}\nВикладач: <b><u>${d.teacher}</u></b>\nЗавдання: ${
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

  // scheduleToday.length ? await telegram.api.pinChatMessage({
  //   chat_id: message.chat.id,
  //   message_id: message.message_id
  // }) : null
}

telegram.updates
  .startPolling()
  .then(() => console.log(`started polling @${telegram.bot.username}`))
  .catch(console.error);

export { telegram };
