import { Entity, BaseEntity, PrimaryColumn, Column } from "typeorm";

@Entity()
export class Member extends BaseEntity {
    @PrimaryColumn("numeric")
    id: number;

    @Column("text")
    group: string;

    @Column("text")
    name: string;

    @Column("text")
    surname: string;

    @Column("boolean", { default: false })
    blacklisted: boolean
}