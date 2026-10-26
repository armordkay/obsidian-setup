# Pomodoro cho Obsidian

Đồng hồ học tập cục bộ, có dashboard và khối nhúng trong note. Giao diện bám theo
mockup v13: vỏ xanh lục, nút xanh da trời, số điện tử đen và nét ẩn rất nhạt.
Tự theo theme sáng/tối của Obsidian, không có nút đổi theme riêng.

## Cài đặt

Chép ba file `main.js`, `manifest.json`, `styles.css` vào:

```text
VAULT/.obsidian/plugins/pomodoro/
```

Khởi động lại Obsidian, bật **Pomodoro** trong Settings → Community plugins.
Không cần npm, build, Dataview hoặc kết nối mạng. Không chép thư mục `.superpowers`
(mockup và profile trình duyệt), `tests` hay `docs` vào vault.

## Sử dụng

- Bấm icon timer trên ribbon, hoặc Command palette → **Pomodoro: Mở đồng hồ Pomodoro**.
- Để nhúng vào note, thêm block sau và mở Reading view hoặc Live Preview
  ngoài vùng đang sửa block:

````markdown
```pomodoro
```
````

- Sửa **Thời gian học / Thời gian nghỉ** khi đồng hồ sẵn sàng: số nguyên 1–180 phút.
  Mặc định 25 / 5 phút. Rời ô nhập để áp dụng, hoặc bấm **Bắt đầu**.
- **Tạm dừng / Tiếp tục** giữ tiến độ. **Đặt lại** quay về đầu phiên học để chỉnh thời gian.
- Hết giờ học, đồng hồ tự bắt đầu nghỉ. Hết nghỉ sẽ chờ bạn bấm **Bắt đầu** phiên học mới.
- Command palette có lệnh bắt đầu/tạm dừng và đặt lại; có thể gán hotkey trong Obsidian.

Mọi tab và block dùng chung một đồng hồ, không tạo phiên riêng. Đóng note hoặc tab
không dừng giờ. Thời gian đếm dựa trên deadline, nên không cộng sai vì callback bị
trễ khi chạy nền. Nếu máy ngủ qua cả học và nghỉ, đồng hồ trở về sẵn sàng khi mở lại.

Cài đặt và trạng thái được lưu bằng Obsidian `data.json` trong thư mục plugin khi
thao tác hoặc chuyển pha, không ghi mỗi giây. Phiên đang chạy tiếp tục theo deadline
sau khi tắt/bật plugin hoặc khởi động lại ứng dụng. Pause được giữ nguyên.
Khi lỗi lưu, đồng hồ tiếp tục trong bộ nhớ và hiện nút **Thử lưu lại**; chưa lưu được
thì khởi động lại có thể khôi phục snapshot cũ. Thay đổi đồng hồ hệ thống trong khi
chạy có thể làm thời gian còn lại thay đổi theo.

Không sửa note, task của Eisenhower hoặc dữ liệu Calendar. Không phát âm thanh;
chuông và âm thanh 40 Hz dành cho giai đoạn sau. Thông báo kết thúc dùng Notice
của Obsidian khi ứng dụng hoạt động, không phải báo thức hệ điều hành khi app đã đóng.

## Kiểm chứng

Chạy trong thư mục `pomodoro`:

```bash
node --test tests/main.test.cjs
node tests/main.test.cjs
node --check main.js
```

Lệnh thứ hai hiển thị chi tiết từng test khi môi trường chỉ báo kết quả theo file.
Tests bao phủ deadline, pause/resume, ngủ qua hai pha, restore, validation, hai view
đồng bộ, load/save lỗi, queue ghi, command, embed và unload.

Mở `tests/preview.html` bằng trình duyệt để chạy smoke checks trên renderer và CSS
thật. Thêm `#dark`, `#dark-running`, `#dark-paused`, `#dark-error`, hoặc `#dark-long`
để xem trạng thái. Đây chỉ là host kiểm thử, không phải bản web của plugin.

Đã kiểm chứng bằng host Obsidian giả lập và Firefox; chưa kiểm thử trực tiếp trong
ứng dụng Obsidian trên desktop/mobile. Không tuyên bố đã được Obsidian duyệt phát hành.
