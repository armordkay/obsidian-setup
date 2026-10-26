# Kiểm tra Pomodoro bằng systematic-debugging

Ngày: 2026-10-26. Phạm vi: timer, ownership tab, binaural, chuông, thao tác nhanh,
lưu/khôi phục và giải phóng audio. Không sửa bảng màu hoặc bố cục.

Baseline: 54 tests hiện có qua. Đọc implementation, diff và hướng dẫn sử dụng,
truy ngược các đường đóng tab và bàn giao âm thanh; thêm test tái hiện trước khi sửa.

## 1. Đóng tab khi timer sẵn sàng không dừng chuông

Tái hiện: mở dashboard hoặc block nhúng, giữ timer sẵn sàng, bấm Nghe thử rồi
đóng tab. Hai regression tests đều thất bại: voice.stopping vẫn false.

Nguyên nhân: preview chưa ghi nhận tab sở hữu; checkOwner chỉ kiểm tra timer
đang chạy. View.onClose chỉ gọi timer.pause, nhưng pause ở ready không phát sự
kiện changed để hủy âm. Khi hết nghỉ tự động, ownership cũng bị xóa ngay dù
chuông thông báo còn đang reo.

So sánh: phiên đang chạy có ownership và sự kiện pause nên dừng âm đúng.
Sửa tại nguồn: preview gắn owner khi timer không chạy; kiểm tra owner cả khi
đang có audio/hand-off; đóng đúng tab hủy sounds trực tiếp. Giữ owner trong
thời gian chuông ở trạng thái ready. Đóng tab khác không hủy âm.

Sau sửa: tests dashboard/embed và tab không liên quan qua; bổ sung kiểm tra
đóng note sau khi nghỉ tự động kết thúc để bao phủ cùng nguyên nhân.

## 2. Tắt chuông đang reo làm binaural bật lại trước khi fade kết thúc

Tái hiện: chuyển sang học, khi chuông đang reo thì tắt tùy chọn chuông.
Regression test thất bại: đã tạo 1 context binaural trong khi mong đợi 0.

Nguyên nhân: disableBell gọi bell.stop nhưng không chờ Promise fade 0,04 giây,
xóa busy và gọi startFocus ngay. Khác với transition, đường này chưa có guard
chờ hoàn tất và kiểm tra generation trước khi khởi động âm tiếp theo.

Sửa: giữ busy, chờ bell.stop, chỉ startFocus nếu generation vẫn hiện hành và
chưa dispose. Test xác nhận chưa tạo binaural trước khi chuông dừng, cùng
Reset/unload trong lúc chờ không tạo âm muộn.

## Kiểm chứng sau sửa

- `node tests/main.test.cjs`: 60/60 tests qua, 0 thất bại.
- `node --test tests/main.test.cjs`: qua.
- `node --check main.js`: qua.
- `git diff --check`: qua.
- Firefox dùng renderer/CSS thật và OfflineAudioContext: 43 checks ở dashboard
  tối/rộng, 36 checks ở pane sáng 600px, 35 checks ở block tối 360px; đều qua.
- Kiểm chứng native audio bổ sung: hủy chuông trước hai tiếng kế tiếp vẫn nhận
  onended của đủ 9 oscillator, Promise hoàn tất và tín hiệu im lặng sau fade.
- ZIP cài đặt được đối chiếu từng byte với main.js, styles.css, manifest.json.

Giới hạn: DOM/Obsidian host được giả lập; Web Audio được render offline thật,
không nghe bằng tai. Chưa chạy trong ứng dụng Obsidian desktop/mobile và không
khẳng định mọi lỗi có thể xảy ra đã được loại trừ.

## Kiểm chứng yêu cầu tạm dừng khi đóng app

Sau cập nhật công tắc và yêu cầu quit: 71/71 unit/integration tests qua; native
Firefox host qua 50 checks ở dashboard tối, 43 ở pane sáng và 42 ở block 360px.
Bao phủ quit Tasks chờ save/dispose, unload trong học/nghỉ, mở lại sau một ngày,
legacy running snapshot, checkpoint paused trong khi timer bộ nhớ tiếp tục chạy,
shutdown lặp không ghi/dọn trùng, và công tắc Off stop/disconnect/close thực sự.
Native OfflineAudioContext xác nhận Off kết thúc nguồn và hai kênh im lặng sau
fade 0,2 giây. Chưa chạy trực tiếp trong ứng dụng Obsidian desktop/mobile.
