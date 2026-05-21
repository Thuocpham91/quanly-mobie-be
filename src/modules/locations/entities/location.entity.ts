import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';

@Entity('provinces')
export class Province {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @OneToMany(() => District, (district) => district.province)
  districts: District[];
}

@Entity('districts')
export class District {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  code: string;

  @ManyToOne(() => Province, (province) => province.districts)
  province: Province;

  @Column()
  provinceId: number;

  @OneToMany(() => Ward, (ward) => ward.district)
  wards: Ward[];
}

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  code: string;

  @ManyToOne(() => District, (district) => district.wards)
  district: District;

  @Column()
  districtId: number;
}
