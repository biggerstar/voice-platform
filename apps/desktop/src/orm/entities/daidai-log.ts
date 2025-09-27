import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('daidai_log')
export class DaidaiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  accountSessionId: string;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  roomId: string;

  @Column({ nullable: true, type: 'varchar', length: 100 })
  status: string;

  @Column({ nullable: true, type: 'text' })
  message: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
