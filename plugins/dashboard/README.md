# Dashboard for Obsidian

Plugin dashboard riêng, có tab và khối nhúng trong ghi chú. Giao diện tiếng Anh,
tự theo light/dark theme của Obsidian, bám theo mockup v11 đã chốt.
Phần đầu được cập nhật theo yêu cầu mới: ảnh mèo vuông bo góc bên trái, thứ/ngày
căn trái bên cạnh avatar giữ nguyên ở góc trái, cách nhau bằng đường phân cách dọc
và khoảng đệm thoáng, cùng giờ địa phương dạng `HH:mm`; bỏ lịch tháng nhỏ để dùng cùng plugin Calendar hiện có.

## Cài đặt

Giải nén `releases/dashboard-1.4.4.zip`, chép ba file sau vào
`VAULT/.obsidian/plugins/dashboard/`:

```text
main.js
manifest.json
styles.css
```

Khởi động lại Obsidian rồi bật **Dashboard** trong Settings → Community plugins.
Khi cập nhật, thay cả ba file rồi tắt/bật plugin. Không cần npm, build, Dataview,
server hay kết nối mạng. Không cần chép `src`, `tests`, `docs` vào vault.
Ảnh mèo đã được nhúng vào `main.js`; không cần chép ảnh riêng hoặc giữ ảnh trong Downloads.

## Mở dashboard

- Bấm icon Dashboard trên ribbon hoặc Command palette → **Dashboard: Open dashboard**.
- Lệnh **Dashboard: Refresh dashboard** cập nhật lại chỉ mục daily notes.
- Để nhúng vào note, dùng block sau trong Reading view hoặc Live Preview ngoài
  vùng đang sửa block:

````markdown
```dashboard
```
````

Các tab và block dùng chung dữ liệu vault; ngày đang chọn và truy vấn tìm kiếm
của từng view độc lập. Chỉ note có block dashboard được mở rộng readable width;
dashboard vẫn tự co theo pane khi bật sidebar.

## Tìm file

Search tìm theo tên và đường dẫn của mọi file trong vault, kể cả ảnh/PDF.
Không tìm bên trong nội dung file. Kết quả không phân biệt hoa/thường hoặc dấu;
tên khớp chính xác được ưu tiên, tối đa 20 kết quả.

Gõ để tìm, Arrow Up/Down để chọn, Enter để mở trong tab, Escape hoặc bấm ra ngoài
để đóng kết quả. Khi dùng bộ gõ tiếng Việt, gợi ý vẫn cập nhật trong lúc ghép dấu;
Enter và phím mũi tên trong phiên ghép chữ vẫn do IME xử lý. Sau khi ghép xong,
dùng phím xuống và Enter để chọn/mở file.

## Nguồn daily notes

Mặc định, plugin dùng cấu hình daily của **Periodic Notes** nếu đang bật, rồi đến
core **Daily Notes**. Nếu không có cả hai, plugin tìm trong vault bằng format
`YYYY-MM-DD`; note có tên khác vẫn được nhận nếu có `date` hợp lệ và property
`deep_work` hoặc `wins`.

Bạn có thể tắt **Use Daily Notes settings** trong Settings → Dashboard để chỉ định:

- **Daily note folder:** thư mục daily, bao gồm thư mục con. Để trống là vault root.
- **Daily note format:** format Moment của đường dẫn sau thư mục daily, bỏ `.md`.
  Ví dụ `YYYY-MM-DD`, `DD-MM-YYYY`, hoặc `YYYY/MM/YYYY-MM-DD` cho cấu trúc lồng nhau.

Property `date` hợp lệ được ưu tiên hơn ngày trong đường dẫn. Nếu property thiếu
hoặc không hợp lệ, plugin thử parse đường dẫn theo format trên. Bên trong thư mục
daily được cấu hình, một note có `date` hợp lệ được xem là daily note.

Sau khi đổi cấu hình ở Daily Notes hoặc Periodic Notes, chạy **Refresh dashboard**.
Các thao tác tạo/xóa/đổi tên file, sửa properties và qua ngày mới sẽ tự cập nhật.

## Đổi avatar

Mở **Set up → Avatar → Choose image**, chọn ảnh rồi bấm **Save**. Hỗ trợ PNG,
JPEG, WebP và GIF tối đa 20 MB. Ảnh được sao chép khi lưu vào thư mục `images`
bên trong thư mục plugin `dashboard`, thường là:

```text
VAULT/.obsidian/plugins/dashboard/
├── main.js
├── manifest.json
├── styles.css
└── images/
    └── ten-anh-<ma-rieng>.png
```

Nếu dùng thư mục cấu hình khác `.obsidian`, plugin tự tính vị trí tương ứng;
đường dẫn thực tế hiển thị trong Set up. Cấu hình lưu ảnh đã chọn, tự cập nhật
mọi tab/block và nhớ sau khi mở lại. Không cần build lại để đổi avatar.

**Cancel** bỏ ảnh chưa lưu; **Use default → Save** quay về ảnh mèo. Tên ảnh lưu
có mã riêng để tránh ghi đè file trùng tên. Bản gốc và các ảnh đã nhập được giữ
lại; Use default không xóa ảnh trong `images`. Khi sao lưu/chuyển vault, giữ cả
thư mục `dashboard/images` và file cấu hình `dashboard/data.json` để giữ avatar đã chọn.

Khi nâng cấp từ 1.3.0, avatar đã chọn trong `.obsidian/plugins/images` sẽ được
sao chép sang `dashboard/images` và cập nhật đường dẫn; ảnh cũ được giữ lại. Nếu
sao chép thất bại, plugin giữ cấu hình cũ và thông báo để bạn chọn lại trong Set up.
Ảnh tùy chỉnh đã chọn vẫn được ưu tiên; dùng **Use default → Save** để chuyển
sang ảnh mèo mặc định mới.

Đồng hồ dùng giờ địa phương, định dạng 24 giờ `HH:mm`, tự kiểm tra mỗi 30 giây
và khi chuyển tab. Thứ, ngày và phạm vi tracker tự cập nhật khi qua nửa đêm.

## Quy tắc màu tracker

Nút **Set up** màu xanh lục ở góc trên bên phải tracker mở cấu hình ngay trong
dashboard. Nhãn luôn nằm trên một dòng, không bị bó thành nút dọc ở pane hẹp.
Level 1 luôn là có daily note. Với mỗi level 2 và 3:

- Nhập **Property**: tên property trong frontmatter, khớp chính xác cả hoa/thường.
- Chọn **Text**: chỉ thỏa mãn nếu giá trị là chuỗi có nội dung; khoảng trắng không tính.
- Chọn **Number**: nhập **Minimum value (≥)**; chỉ thỏa mãn nếu giá trị là số
  hữu hạn và lớn hơn hoặc bằng ngưỡng. Chấp nhận ngưỡng 0, số âm và số thập phân.
- Bấm **Save** để áp dụng/lưu cho tất cả tab và block; **Cancel** bỏ thay đổi chưa lưu.

Property là khóa ở cấp đầu của frontmatter; không đọc checkbox hoặc giá trị
trong nội dung note. Level 3 được ưu tiên nếu cả hai điều kiện cùng thỏa mãn.
Thống kê chỉ hiện `active days` và tên property, chẳng hạn `deep_work`, `wins`;
số đếm vẫn theo điều kiện đã cấu hình. Chú giải và chi tiết giữ điều kiện đầy đủ.

Cấu hình mặc định và khi nâng cấp từ 1.0.0:

| Mức | Điều kiện |
| --- | --- |
| 0 | Chưa có daily note |
| 1 | Có daily note |
| 2 | `deep_work` là số, từ **60 phút** trở lên |
| 3 | `wins` là chuỗi có nội dung sau khi bỏ khoảng trắng đầu/cuối |

Với mặc định này, có `wins` vẫn đạt mức 3 dù `deep_work` bằng 0. Giá trị
`deep_work: "60"` dạng chuỗi không thỏa mãn rule Number. Checkbox Habits không
ảnh hưởng màu. Set up không đổi các màu đã chốt, chỉ đổi điều kiện của level.

Ví dụ frontmatter:

```yaml
---
date: 2026-10-26
deep_work: 90
wins: "Completed a focused study session."
---
```

Tracker chứa hôm nay và 364 ngày trước đó, theo ngày địa phương. Các tuần được
xếp từ Chủ nhật. Ô ngoài phạm vi được để trống.
Thống kê số ngày có daily, số ngày thỏa level 2 và số ngày thỏa level 3 được đếm
độc lập; một ngày level 3 không tự động được tính là đã thỏa điều kiện level 2.

Bấm ô heatmap để xem chi tiết ngày. **Open daily** chỉ mở note đã
tồn tại; không tự tạo note. Nếu nhiều daily trùng ngày, ưu tiên file có đường dẫn
khớp format, rồi thứ tự đường dẫn. Không cộng dồn dữ liệu; chi tiết hiển thị số
file trùng và file đang dùng.

Heatmap hỗ trợ Arrow keys và
Home/End. Tooltip và chi tiết có ngày, mức và giá trị của property đã chọn để không
phải suy ra dữ liệu chỉ từ màu. Bảng màu là bảng gốc đã được người dùng chốt.

## Dữ liệu và giới hạn

Plugin chỉ đọc daily notes/properties qua Obsidian API, không sửa daily notes và không
ghi dữ liệu tracker riêng. Settings được lưu vào `data.json` của plugin; ảnh được
chọn trong Set up được sao chép vào thư mục `dashboard/images` bên trong plugin.
Không tải font, gửi nội dung vault hay gọi dịch vụ bên ngoài.

Khi lưu settings thất bại, thay đổi vẫn có tác dụng trong phiên đang mở và thông
báo có **Retry**. Tắt plugin gỡ view, subscription và timer của plugin.

Đã kiểm tra bằng Node và Firefox với host Obsidian giả lập. Kiểm tra này không
thay thế xác nhận trực tiếp trên Obsidian desktop/mobile và theme thực tế của
vault; đặc biệt phần kế thừa cấu hình Daily Notes/Periodic Notes dựa trên adapter
nội bộ tương tự plugin Calendar hiện có. Luôn có cấu hình thư mục/format thủ công.

## Phát triển và kiểm tra

Không có dependency cần cài. Dùng Node.js 22+ để chạy công cụ phát triển:

```bash
node dashboard/build.cjs
node --check dashboard/main.js
node --test dashboard/tests/*.test.cjs
node dashboard/tests/model.test.cjs
node dashboard/tests/integration.test.cjs
TZ=America/New_York node dashboard/tests/model.test.cjs
TZ=Pacific/Auckland node dashboard/tests/model.test.cjs
```

`main.js` được sinh từ `src/`; cần build lại sau khi sửa source. Các file test chạy
trực tiếp cho danh sách từng test chi tiết. Browser fixture chạy đúng `main.js`
và `styles.css`, với dữ liệu tổng hợp; có thể mở `dashboard/tests/preview.html`.

```bash
python3 dashboard/tests/browser_check.py
```

Cần Firefox và geckodriver có sẵn. Có thể đặt `FIREFOX_BINARY`,
`GECKODRIVER_BINARY`. Môi trường quản lý tiến trình dùng WebDriver mở riêng:

```bash
GECKODRIVER_URL=http://127.0.0.1:48732 python3 dashboard/tests/browser_check.py
```

Script không chụp ảnh hoặc sửa vault thật. Chi tiết lượt rà soát cuối nằm trong
`docs/systematic-debugging-2026-10-26.md`.
