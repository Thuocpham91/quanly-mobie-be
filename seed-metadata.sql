-- Seed initial classifications
INSERT INTO classifications (id, name, description, "createdAt", "updatedAt") VALUES 
(gen_random_uuid(), 'Thuốc', 'Các loại thuốc thú y', NOW(), NOW()),
(gen_random_uuid(), 'Vacsin', 'Các loại vacsin phòng bệnh', NOW(), NOW()),
(gen_random_uuid(), 'Vật tư', 'Dụng cụ, vật tư y tế', NOW(), NOW()),
(gen_random_uuid(), 'Dịch vụ', 'Các dịch vụ khám chữa bệnh', NOW(), NOW());

-- Seed initial units
INSERT INTO units (id, name, description, "createdAt", "updatedAt") VALUES 
(gen_random_uuid(), 'Cái', 'Đơn vị đếm', NOW(), NOW()),
(gen_random_uuid(), 'Gói', 'Đơn vị đóng gói', NOW(), NOW()),
(gen_random_uuid(), 'Lọ', 'Đơn vị chai lọ', NOW(), NOW()),
(gen_random_uuid(), 'Viên', 'Đơn vị viên thuốc', NOW(), NOW()),
(gen_random_uuid(), 'Ống', 'Đơn vị ống tiêm/thuốc', NOW(), NOW()),
(gen_random_uuid(), 'Hộp', 'Đơn vị hộp', NOW(), NOW());
