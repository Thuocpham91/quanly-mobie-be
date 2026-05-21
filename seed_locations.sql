TRUNCATE TABLE wards, districts, provinces CASCADE;

-- Seed all 63 provinces of Vietnam
INSERT INTO provinces (id, name, code) VALUES 
(1, 'Thành phố Hà Nội', '01'),
(2, 'Tỉnh Hà Giang', '02'),
(3, 'Tỉnh Cao Bằng', '04'),
(4, 'Tỉnh Bắc Kạn', '06'),
(5, 'Tỉnh Tuyên Quang', '08'),
(6, 'Tỉnh Lào Cai', '10'),
(7, 'Tỉnh Điện Biên', '11'),
(8, 'Tỉnh Lai Châu', '12'),
(9, 'Tỉnh Sơn La', '14'),
(10, 'Tỉnh Yên Bái', '15'),
(11, 'Tỉnh Hoà Bình', '17'),
(12, 'Tỉnh Thái Nguyên', '19'),
(13, 'Tỉnh Lạng Sơn', '20'),
(14, 'Tỉnh Quảng Ninh', '22'),
(15, 'Tỉnh Bắc Giang', '24'),
(16, 'Tỉnh Phú Thọ', '25'),
(17, 'Tỉnh Bắc Ninh', '26'),
(18, 'Tỉnh Hải Dương', '30'),
(19, 'Thành phố Hải Phòng', '31'),
(20, 'Tỉnh Hưng Yên', '33'),
(21, 'Tỉnh Thái Bình', '34'),
(22, 'Tỉnh Hà Nam', '35'),
(23, 'Tỉnh Nam Định', '36'),
(24, 'Tỉnh Ninh Bình', '37'),
(25, 'Tỉnh Thanh Hóa', '38'),
(26, 'Tỉnh Nghệ An', '40'),
(27, 'Tỉnh Hà Tĩnh', '42'),
(28, 'Tỉnh Quảng Bình', '44'),
(29, 'Tỉnh Quảng Trị', '45'),
(30, 'Tỉnh Thừa Thiên Huế', '46'),
(31, 'Thành phố Đà Nẵng', '48'),
(32, 'Tỉnh Quảng Nam', '49'),
(33, 'Tỉnh Quảng Ngãi', '51'),
(34, 'Tỉnh Bình Định', '52'),
(35, 'Tỉnh Phú Yên', '54'),
(36, 'Tỉnh Khánh Hòa', '56'),
(37, 'Tỉnh Ninh Thuận', '58'),
(38, 'Tỉnh Bình Thuận', '60'),
(39, 'Tỉnh Kon Tum', '62'),
(40, 'Tỉnh Gia Lai', '64'),
(41, 'Tỉnh Đắk Lắk', '66'),
(42, 'Tỉnh Đắk Nông', '67'),
(43, 'Tỉnh Lâm Đồng', '68'),
(44, 'Tỉnh Bình Phước', '70'),
(45, 'Tỉnh Tây Ninh', '72'),
(46, 'Tỉnh Bình Dương', '74'),
(47, 'Tỉnh Đồng Nai', '75'),
(48, 'Tỉnh Bà Rịa - Vũng Tàu', '77'),
(49, 'Thành phố Hồ Chí Minh', '79'),
(50, 'Tỉnh Long An', '80'),
(51, 'Tỉnh Tiền Giang', '82'),
(52, 'Tỉnh Bến Tre', '83'),
(53, 'Tỉnh Trà Vinh', '84'),
(54, 'Tỉnh Vĩnh Long', '86'),
(55, 'Tỉnh Đồng Tháp', '87'),
(56, 'Tỉnh An Giang', '89'),
(57, 'Tỉnh Kiên Giang', '91'),
(58, 'Thành phố Cần Thơ', '92'),
(59, 'Tỉnh Hậu Giang', '93'),
(60, 'Tỉnh Sóc Trăng', '94'),
(61, 'Tỉnh Bạc Liêu', '95'),
(62, 'Tỉnh Cà Mau', '96'),
(63, 'Tỉnh Vĩnh Phúc', '21')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Seed major districts for Hanoi (Province ID: 1)
INSERT INTO districts (id, name, code, "provinceId") VALUES 
(1, 'Quận Ba Đình', '001', 1),
(2, 'Quận Hoàn Kiếm', '002', 1),
(3, 'Quận Tây Hồ', '003', 1),
(7, 'Quận Long Biên', '004', 1),
(8, 'Quận Cầu Giấy', '005', 1),
(9, 'Quận Đống Đa', '006', 1),
(10, 'Quận Hai Bà Trưng', '007', 1),
(11, 'Quận Hoàng Mai', '008', 1),
(12, 'Quận Thanh Xuân', '009', 1)
ON CONFLICT DO NOTHING;

-- Seed major districts for HCM City (Province ID: 49)
INSERT INTO districts (id, name, code, "provinceId") VALUES 
(4, 'Quận 1', '760', 49),
(5, 'Quận 3', '770', 49),
(6, 'Quận Bình Thạnh', '771', 49),
(13, 'Quận 4', '773', 49),
(14, 'Quận 5', '774', 49),
(15, 'Quận 10', '771', 49),
(16, 'Thành phố Thủ Đức', '769', 49)
ON CONFLICT DO NOTHING;

-- Seed some wards for Quận 1, HCM
INSERT INTO wards (id, name, code, "districtId") VALUES 
(1, 'Phường Bến Nghé', '26734', 4),
(2, 'Phường Bến Thành', '26740', 4),
(3, 'Phường Đa Kao', '26737', 4),
(7, 'Phường Tân Định', '26731', 4),
(8, 'Phường Phạm Ngũ Lão', '26743', 4)
ON CONFLICT DO NOTHING;

-- Seed some wards for Ba Dinh, Hanoi
INSERT INTO wards (id, name, code, "districtId") VALUES 
(4, 'Phường Phúc Xá', '00001', 1),
(5, 'Phường Trúc Bạch', '00004', 1),
(6, 'Phường Vĩnh Phúc', '00006', 1),
(9, 'Phường Cống Vị', '00007', 1),
(10, 'Phường Liễu Giai', '00010', 1)
ON CONFLICT DO NOTHING;
