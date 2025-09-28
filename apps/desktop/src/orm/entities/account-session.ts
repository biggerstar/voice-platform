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

  @Column({ type: 'varchar', nullable: true, default: '未登录' })
  login_status: string

  @Column({ type: 'json', nullable: true })
  data: Record<any, any>

  @Column({ type: 'varchar', nullable: true })
  webhook_bot: string

  @Column({ type: 'varchar', nullable: true })
  webhook_url: string

  @Column({ type: 'varchar', nullable: true })
  leaderboard_bot: string

  @Column({ type: 'varchar', nullable: true })
  leaderboard_webhook_url: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @CreateDateColumn()
  created_time: Date

  @UpdateDateColumn()
  updated_time: Date
}
