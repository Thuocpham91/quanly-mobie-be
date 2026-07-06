import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province, District, Ward } from './entities/location.entity';

@Injectable()
export class LocationsSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Province)
    private provinceRepo: Repository<Province>,
    @InjectRepository(District)
    private districtRepo: Repository<District>,
    @InjectRepository(Ward)
    private wardRepo: Repository<Ward>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const provinceCount = await this.provinceRepo.count();
      if (provinceCount > 0) {
        console.log('--- VIETNAM LOCATIONS ALREADY SEEDED ---');
        return;
      }

      console.log('--- STARTING AUTOMATIC VIETNAM LOCATIONS SEED ---');
      await this.seedLocations();
      console.log('--- AUTOMATIC VIETNAM LOCATIONS SEED COMPLETED ---');
    } catch (error) {
      console.error('--- AUTOMATIC VIETNAM LOCATIONS SEED FAILED ---', error);
    }
  }

  private async seedLocations() {
    console.log('Fetching locations JSON data from GitHub...');
    const url = 'https://raw.githubusercontent.com/madnh/hanhchinhvn/master/dist/tree.json';
    
    let tree: any;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      tree = await res.json();
      console.log('Locations data fetched successfully.');
    } catch (err) {
      console.warn(`Failed to fetch locations from GitHub: ${err.message}. Automatic seeding skipped.`);
      return;
    }

    const provinceIdMap = new Map<string, number>();
    const districtIdMap = new Map<string, number>();

    // 1. Parse and insert Provinces
    const provincesToSave = Object.keys(tree).map((provinceCode) => {
      const provinceData = tree[provinceCode];
      return this.provinceRepo.create({
        name: provinceData.name_with_type,
        code: provinceCode,
      });
    });

    console.log(`Seeding ${provincesToSave.length} provinces...`);
    // Save provinces one by one or in small batches to retrieve generated IDs
    for (const p of provincesToSave) {
      const savedProvince = await this.provinceRepo.save(p);
      provinceIdMap.set(p.code, savedProvince.id);
    }

    // 2. Parse and insert Districts
    const districtsToSave: District[] = [];
    for (const provinceCode of Object.keys(tree)) {
      const provinceData = tree[provinceCode];
      const dbProvinceId = provinceIdMap.get(provinceCode);
      const districtsData = provinceData['quan-huyen'] || {};

      if (!dbProvinceId) continue;

      for (const districtCode of Object.keys(districtsData)) {
        const districtData = districtsData[districtCode];
        districtsToSave.push(
          this.districtRepo.create({
            name: districtData.name_with_type,
            code: districtCode,
            provinceId: dbProvinceId,
          })
        );
      }
    }

    console.log(`Seeding ${districtsToSave.length} districts...`);
    const districtBatchSize = 100;
    for (let i = 0; i < districtsToSave.length; i += districtBatchSize) {
      const batch = districtsToSave.slice(i, i + districtBatchSize);
      const savedDistricts = await this.districtRepo.save(batch);
      savedDistricts.forEach((d) => {
        districtIdMap.set(d.code, d.id);
      });
    }

    // 3. Parse and insert Wards
    const wardsToSave: Ward[] = [];
    for (const provinceCode of Object.keys(tree)) {
      const provinceData = tree[provinceCode];
      const districtsData = provinceData['quan-huyen'] || {};

      for (const districtCode of Object.keys(districtsData)) {
        const districtData = districtsData[districtCode];
        const dbDistrictId = districtIdMap.get(districtCode);
        const wardsData = districtData['xa-phuong'] || {};

        if (!dbDistrictId) continue;

        for (const wardCode of Object.keys(wardsData)) {
          const wardData = wardsData[wardCode];
          wardsToSave.push(
            this.wardRepo.create({
              name: wardData.name_with_type,
              code: wardCode,
              districtId: dbDistrictId,
            })
          );
        }
      }
    }

    console.log(`Seeding ${wardsToSave.length} wards...`);
    const wardBatchSize = 500;
    for (let i = 0; i < wardsToSave.length; i += wardBatchSize) {
      const batch = wardsToSave.slice(i, i + wardBatchSize);
      await this.wardRepo.save(batch);
    }
  }
}
