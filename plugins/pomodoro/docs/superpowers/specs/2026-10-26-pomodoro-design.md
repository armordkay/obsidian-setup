# Pomodoro cho Obsidian

## Phạm vi đã xác nhận

Người dùng đã duyệt mockup v13 và yêu cầu bắt đầu code ngày 2026-10-26.
Plugin hỗ trợ học tập với phút:giây, thời gian học/nghỉ tùy chỉnh, bắt đầu,
tạm dừng/tiếp tục, tự bắt đầu nghỉ khi hết giờ học. Có tab dashboard và khối
nhúng `pomodoro`. Chuông và âm thanh 40 Hz nằm ngoài phiên bản đầu.

## Approaches

- Dashboard có tab riêng và khối nhúng: được người dùng chọn; phù hợp trang học tập.
- Sidebar gọn như Calendar: đã cân nhắc, không chọn vì ưu tiên đồng hồ lớn.

JavaScript CommonJS chạy trực tiếp, CSS scoped và Node test runner theo
Eisenhower. Không thêm runtime dependency, package manager hoặc bước build.

## Giao diện

Theo `dashboard-seven-segment-v13.html`: góc chính diện, vỏ xanh lục bo góc,
thanh trên dài 64%, mặt xám, số đen bảy đoạn nét dày có góc vát. Nét ẩn opacity
0.045. Nút xanh da trời. Giữ bảng màu v11 trong cả hai theme; theme do Obsidian
quản lý. Bỏ thanh điều khiển mockup, nút đổi theme và dữ liệu trạng thái giả.
Toàn bộ UI bằng tiếng Việt, số đọc được bằng trình đọc màn hình; chỉ thông báo
thay đổi trạng thái, không đọc lại từng giây. Bố cục đáp ứng chiều rộng vùng nhúng.

## Quyết định triển khai

Các giá trị dưới đây là lựa chọn triển khai của Codex trong phạm vi được giao:

- Plugin ID `pomodoro`, phiên bản 1.0.0, Obsidian >=1.5.0; hỗ trợ desktop/mobile.
- Mặc định học 25, nghỉ 5 phút; mỗi thời lượng là số nguyên 1..180 phút.
- Tất cả view dùng một timer. Đóng view không dừng timer. Disable/unload dọn interval.
- Running dùng `endTime` tuyệt đối; pause giữ mili giây còn lại. Hiển thị làm tròn
  lên giây. Khi học hết, nghỉ tính từ mốc kết thúc học, không từ lúc callback chạy.
- Hết nghỉ trở về học/sẵn sàng; không tự tạo vô hạn phiên học khi ứng dụng ngủ.
- Đặt lại về học/sẵn sàng; chỉ chỉnh thời lượng khi sẵn sàng. Pause không mất tiến độ.
- Lưu settings và snapshot có version trong `data.json` qua Obsidian loadData/saveData.
  Lưu khi thao tác, chuyển pha và unload; không ghi mỗi giây. Khôi phục phiên sau restart.
- Validate dữ liệu lưu; dữ liệu hỏng dùng mặc định. Lỗi đọc/ghi báo rõ trong UI,
  giữ timer hoạt động trong bộ nhớ và cung cấp nút thử lưu lại.
- Không sửa task của Eisenhower, Calendar, note hoặc cấu hình vault; không gọi mạng.

## Kiểm chứng

Node tests dùng fake clock, DOM/Obsidian host theo mô hình test hiện có. Bao phủ
pause/resume, callback trễ, ngủ qua hai pha, restore, dữ liệu sai, queue save lỗi,
hai view đồng bộ và dọn lifecycle. Smoke preview chạy UI thật trong Firefox ở
theme sáng/tối và vùng 390px; không thay thế kiểm thử trên ứng dụng Obsidian thật.
