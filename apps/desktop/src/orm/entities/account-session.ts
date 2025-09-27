import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

@Entity()
export class AccountSessionEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: string

  @Column({ type: 'varchar' })
  name: string

  @Column({ type: 'varchar' })
  type: string

  @Column({ type: 'varchar', nullable: true })
  remark: string

  @Column({ type: 'varchar', nullable: true })
  status: string

  @Column({ type: 'json', nullable: true })
  data: Record<any, any>

  @CreateDateColumn()
  created_time: Date

  @UpdateDateColumn()
  updated_time: Date
}
