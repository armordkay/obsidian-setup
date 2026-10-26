# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Giao diện web trong Obsidian, gồm tab dashboard riêng và khối nhúng `pomodoro`.

## Users

Người dùng Obsidian muốn hỗ trợ học tập trong trang ghi chú. Chưa xác nhận thêm nhóm người dùng hoặc mục tiêu định lượng.

## Product Purpose

Cung cấp đồng hồ học/nghỉ với hiển thị phút:giây, thời lượng tùy chỉnh và thao tác bắt đầu, tạm dừng, tiếp tục. Hết giờ học tự bắt đầu nghỉ.

## Operating Context

Dashboard và khối nhúng trong note là phương án người dùng đã chọn. Theme do Obsidian quản lý. Giao diện đáp ứng chiều rộng vùng nhúng.

## Capabilities and Constraints

- Phạm vi đã duyệt: dashboard, embed, thời lượng học/nghỉ tùy chỉnh, điều khiển phiên học và tự bắt đầu nghỉ.
- Chuông và âm thanh 40 Hz nằm ngoài phiên bản đầu.
- Những chi tiết sau là **lựa chọn triển khai**, không phải yêu cầu trực tiếp của người dùng: JavaScript CommonJS, CSS scoped, không runtime dependency hoặc bước build; mặc định 25/5 phút và giới hạn số nguyên 1–180 phút; một timer dùng chung giữa các view; lưu và khôi phục settings/snapshot qua Obsidian `data.json`.
- Lựa chọn triển khai: deadline tuyệt đối, pause giữ tiến độ; hết nghỉ trở về học/sẵn sàng; lỗi lưu giữ timer trong bộ nhớ và cung cấp thử lưu lại; không gọi mạng, không sửa note, task Eisenhower, Calendar hoặc cấu hình vault.
- Lựa chọn triển khai: plugin ID `pomodoro`, phiên bản 1.0.0, Obsidian tối thiểu 1.5.0, hỗ trợ desktop/mobile. Hỗ trợ dự kiến này chưa tương đương kiểm thử trên ứng dụng thật.

## Brand Commitments

Tên sản phẩm: Pomodoro cho Obsidian. Toàn bộ UI bằng tiếng Việt. Mockup v13 đã được duyệt ngày 2026-10-26; hệ thị giác được ghi riêng trong `DESIGN.md`.

## Evidence on Hand

- Nguồn xác nhận phạm vi và phân biệt lựa chọn triển khai: `docs/superpowers/specs/2026-10-26-pomodoro-design.md`.
- `README.md` ghi cách dùng, cài đặt và giới hạn kiểm chứng; `styles.css` là nguồn token hiện hành.
- Ảnh review: `.impeccable/review/desktop.png`, `mobile.png`, `error.png`, `long.png`, `narrow.png`.
- Kiểm chứng bằng host giả lập và Firefox không thay thế kiểm thử trực tiếp trên Obsidian desktop/mobile; không có khẳng định Obsidian duyệt phát hành.

## Accessibility & Inclusion

Số đọc được bằng trình đọc màn hình. Chỉ thông báo thay đổi trạng thái, không đọc lại từng giây. Nội dung giao diện dùng tiếng Việt.
