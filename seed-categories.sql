-- Create initial categories for medicines and vaccines
INSERT INTO categories (id, name, description, "createdAt", "updatedAt") VALUES 
(gen_random_uuid(), 'Kháng sinh', 'Các loại thuốc kháng sinh cho thú y', NOW(), NOW()),
(gen_random_uuid(), 'Vacsin dại', 'Các loại vacsin phòng bệnh dại', NOW(), NOW()),
(gen_random_uuid(), 'Vacsin 5 bệnh', 'Vacsin tổng hợp 5 bệnh cho chó/mèo', NOW(), NOW()),
(gen_random_uuid(), 'Thuốc bổ / Vitamin', 'Các loại thực phẩm chức năng và thuốc bổ', NOW(), NOW()),
(gen_random_uuid(), 'Thuốc đặc trị', 'Các loại thuốc điều trị bệnh chuyên biệt', NOW(), NOW()),
(gen_random_uuid(), 'Thuốc ngoài da', 'Thuốc bôi, xịt điều trị bệnh ngoài da, ghẻ, nấm', NOW(), NOW()),
(gen_random_uuid(), 'Thuốc tẩy giun', 'Các loại thuốc tẩy giun sán', NOW(), NOW());
