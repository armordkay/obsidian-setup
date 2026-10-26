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
- Âm binaural 40 Hz theo yêu cầu cập nhật: sin trái 134 Hz, phải 174 Hz bằng Web Audio; chỉ phát khi tập trung, dừng khi Pause/nghỉ/đặt lại/đóng tab giữ phiên/unload. Không dùng MP3, âm nền, harmonics hoặc điều biến biên độ. Chuông chuyển phiên đã bổ sung theo yêu cầu cập nhật.
- Gain mặc định 0,05; lựa chọn triển khai: thanh trượt 0–0,10, 0 để tắt tiếng. Fade vào 0,3 giây, ra 0,2 giây. Khởi tạo/resume từ thao tác người dùng; restore không tự phát âm. Cần tai nghe stereo và tắt Mono audio; gain không phải âm lượng tại tai.
- Những chi tiết sau là **lựa chọn triển khai**, không phải yêu cầu trực tiếp của người dùng: JavaScript CommonJS, CSS scoped, không runtime dependency hoặc bước build; mặc định 25/5 phút và giới hạn số nguyên 1–180 phút; một timer dùng chung giữa các view; lưu và khôi phục settings/snapshot qua Obsidian `data.json`.
- Lựa chọn triển khai: deadline tuyệt đối, pause giữ tiến độ; hết nghỉ trở về học/sẵn sàng; lỗi lưu giữ timer trong bộ nhớ và cung cấp thử lưu lại; không gọi mạng, không sửa note, task Eisenhower, Calendar hoặc cấu hình vault.
- Lựa chọn triển khai: plugin ID `pomodoro`, phiên bản 1.0.0, Obsidian tối thiểu 1.5.0, hỗ trợ desktop/mobile. Hỗ trợ dự kiến này chưa tương đương kiểm thử trên ứng dụng thật.

## Tab Lifecycle

Theo yêu cầu cập nhật của người dùng: chuyển sang tab khác vẫn chạy ngầm, đóng tab
giữ phiên thì tự tạm dừng. Lựa chọn triển khai: giữ thời gian còn lại để mở lại bấm
Tiếp tục; tab bấm Bắt đầu/Tiếp tục gần nhất là tab giữ phiên, các view vẫn dùng chung timer.
Renderer note unload không đồng nghĩa tab đóng.

## Brand Commitments

Tên sản phẩm: Pomodoro cho Obsidian. Toàn bộ UI bằng tiếng Việt. Mockup v13 đã được duyệt ngày 2026-10-26; hệ thị giác được ghi riêng trong `DESIGN.md`.

## Evidence on Hand

- Nguồn xác nhận phạm vi và phân biệt lựa chọn triển khai: `docs/superpowers/specs/2026-10-26-pomodoro-design.md`.
- `README.md` ghi cách dùng, cài đặt và giới hạn kiểm chứng; `styles.css` là nguồn token hiện hành.
- Ảnh review: `.impeccable/review/desktop.png`, `mobile.png`, `error.png`, `long.png`, `narrow.png`.
- Kiểm chứng bằng host giả lập và Firefox không thay thế kiểm thử trực tiếp trên Obsidian desktop/mobile; không có khẳng định Obsidian duyệt phát hành.

## Accessibility & Inclusion

Số đọc được bằng trình đọc màn hình. Chỉ thông báo thay đổi trạng thái, không đọc lại từng giây. Nội dung giao diện dùng tiếng Việt.

## Chuông chuyển phiên — yêu cầu cập nhật

Chuông Web Audio không dùng file, ba tiếng cách 0,6 giây, mỗi tiếng 1,5 giây,
ba thành phần sine 880/1760/2464 Hz đúng envelope người dùng cung cấp. Bật/tắt,
gain 0–0,30 mặc định 0,10 và Nghe thử. Mặc định bật là lựa chọn triển khai.
Một sự kiện chuyển pha chung cho tự động và Next; bộ đếm không chờ âm thanh.
Binaural fade 0,5 giây trước chuông; chỉ bật lại sau chuông nếu vẫn học/đang chạy.
Lựa chọn triển khai: fade hủy chuông cũ 0,04 giây khi đổi tiếp; Pause/Reset/Stop
và unload hủy lệnh phát chờ. Context chuông giữ mở sau thao tác người dùng, đóng
khi unload. Không thêm nghỉ dài; hết nghỉ tự động vẫn học/sẵn sàng.

## Công tắc Binaural beats — cập nhật giao diện

Theo yêu cầu mới: đặt công tắc Binaural beats phía trên thời gian học, theo mẫu
track xanh và núm trắng. Bỏ hai phần setup âm phía dưới, kể cả slider và Nghe thử.
Mặc định gain binaural 0,20, chuông 0,25; công tắc chỉ điều khiển binaural và lưu
qua restart. Chuông chuyển phiên vẫn hoạt động. Nâng cấp cấu hình âm cũ lên
version 2 để áp dụng gain mới và bật chuông; timer snapshot vẫn version 1.

## Đóng ứng dụng và tắt nguồn âm binaural — cập nhật

Quit/unload tạm dừng tức thì; mở lại chỉ chạy sau khi bấm Tiếp tục. Trong cùng
lần mở app, chuyển tab vẫn chạy nền. Snapshot trên đĩa là paused checkpoint,
bao gồm khi timer trong bộ nhớ đang chạy; snapshot running cũ được khôi phục
paused, không trừ thời gian đóng app. Hook quit đăng ký Tasks chờ lưu và dispose;
đóng cưỡng bức dùng checkpoint thành công gần nhất. Công tắc binaural Off dừng
nguồn thật: fade 0,2 giây, stop hai oscillator, disconnect và close context riêng;
chuông vẫn độc lập, không bị tắt.
