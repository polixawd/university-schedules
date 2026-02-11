import { BaseEntity, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Task extends BaseEntity {

    @PrimaryGeneratedColumn("uuid")
    id: string;

    @PrimaryColumn("text")
    deadline: string;

    @PrimaryColumn("text")
    discipline: string;

    @PrimaryColumn("numeric")
    group: number;

    @PrimaryColumn("simple-array")
    links: string[];
}