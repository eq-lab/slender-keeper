import { Entity, PrimaryColumn } from "typeorm"

@Entity("SlenderBorrowers")
export class SlenderBorrower {
    @PrimaryColumn()
    keeperStateId: number
    @PrimaryColumn()
    borrower: string
}
