import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm"

@Entity("SlenderKeeperState")
export class SlenderKeeperState {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  lastSynced: number

  @PrimaryColumn()
  contractAddress: string

  @PrimaryColumn()
  chain: string
}
