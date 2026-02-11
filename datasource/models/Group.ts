import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Group extends BaseEntity {

    // Унікальний айді групи в нашій базі даних
    @PrimaryColumn("numeric")
    id: number;

    // Айді групи на сайті, де запроси будуть робитись
    @PrimaryColumn("text")
    aStudyGroupId: string;

    // Айді вузу
    @PrimaryColumn("text")
    aVuzId: string;

    // Айді старости в тг
    @PrimaryColumn("numeric")
    headmanId: number;

    // Айди замісника старости в тг 
    @PrimaryColumn("numeric")
    deputyHeadmanId: number;

    // Назва спеціальності
    @PrimaryColumn("text")
    speciality: string;

    // Назва факультету
    @PrimaryColumn("text")
    faculty: string;

    // Курс
    @PrimaryColumn("numeric")
    course: number;

    // Рік початку навчання (для розкладу yearOfStart + course)
    @PrimaryColumn("numeric")
    yearOfStart: number;

    // Баланс групи для продовження дії роботи бота
    @PrimaryColumn("numeric")
    balance: number;

    @PrimaryColumn("simple-array")
    members: number[]

    @Column("numeric")
    chat_id: number
}