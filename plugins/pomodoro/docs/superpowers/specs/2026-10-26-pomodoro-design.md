# Pomodoro cho Obsidian

## Phạm vi đã xác nhận

Người dùng đã duyệt mockup v13 và yêu cầu bắt đầu code ngày 2026-10-26.
Plugin hỗ trợ học tập với phút:giây, thời gian học/nghỉ tùy chỉnh, bắt đầu,
tạm dừng/tiếp tục, tự bắt đầu nghỉ khi hết giờ học. Có tab dashboard và khối
nhúng `pomodoro`. Theo yêu cầu cập nhật, bổ sung âm binaural 40 Hz; chuông báo
đã được bổ sung theo yêu cầu tiếp theo (xem phần cuối).

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
- Tất cả view dùng một timer. Chuyển tab vẫn chạy ngầm; đóng tab giữ phiên thì pause và lưu tiến độ.
  Tab bấm Bắt đầu/Tiếp tục gần nhất giữ phiên; renderer unload không đồng nghĩa đóng tab.
  Disable/unload dọn interval.
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

## Âm binaural 40 Hz — yêu cầu cập nhật

Hai OscillatorNode sine 134 Hz (trái), 174 Hz (phải), cùng mốc start. Nối từng
oscillator vào input 0/1 của ChannelMergerNode(2), qua GainNode đến destination.
Không thêm âm nền/harmonics/AM, MP3 hoặc buffer trong mã plugin. Sóng liên tục,
không tạo bằng interval. Gain ban đầu 0, tăng tới 0,05 mặc định trong 0,3 giây;
giảm 0 trong 0,2 giây trước khi dừng node và đóng context. Thanh trượt 0–0,10 là
lựa chọn triển khai cho yêu cầu điều chỉnh; 0 tắt tiếng.

Chỉ khởi tạo/resume từ Start/Continue, chỉ phát khi tập trung. Hết học, Pause,
Reset, đóng tab giữ phiên và unload phải dừng. Đặt lịch dừng theo audio clock,
không phụ thuộc tick giao diện. Không phát chồng khi Start/Stop liên tiếp, không
tái dùng node đã stop; dispose gỡ kết nối và đóng context. Resume đang chờ bị
hủy thì không được tạo graph muộn. Restore timer không tự bật âm.

Hiển thị hướng dẫn tai nghe stereo, tắt Mono audio, gain là biên độ tín hiệu và
không thể hiện âm lượng tại tai. Unit tests mô phỏng audio clock và onended;
smoke dùng OfflineAudioContext ngắn để đo tần số/biên độ/tách kênh, không phát
ra loa và không xuất file âm thanh. Chưa kiểm chứng trực tiếp trên Obsidian thật.

## Chuông Web Audio — yêu cầu tiếp theo

Sự kiện chuyển pha chung phát một chuỗi cho mỗi deadline hoặc Next; Start,
Pause/Resume, Stop và Reset không phát chuông. Timer cập nhật trước xử lý âm.
Hết nghỉ tự động giữ học/sẵn sàng; Next từ học hoặc nghỉ bắt đầu ngay pha kia.
Plugin chưa có nghỉ dài. Bật mặc định, gain 0,10 chỉnh 0–0,30 và Nghe thử.

Ba tiếng tại 0/0,6/1,2 giây; mỗi tiếng có sine 880/1760/2464 Hz với amplitude
0,60/0,25/0,10 và decay 0,30/0,20/0,12 giây. Envelope gain riêng: 0 tại t,
ramp đến amplitude tại t+0,008, setTargetAtTime(0,t+0,008,decay); chốt
amplitude*exp(-(1,4-0,008)/decay) tại t+1,4; ramp 0 tại t+1,5 và stop t+1,51.
Gain riêng nối gain chung đến destination. Lịch dùng audio clock, không timer JS.

Binaural đang phát fade 0,5 giây trước chuông. Chỉ phát lại sau chuông nếu trạng
thái mới vẫn học/đang chạy. Dùng generation để hủy tác vụ cũ khi chuyển tiếp,
Pause/Stop/Reset hoặc unload. Thay chuỗi đang reo fade 0,04 giây (lựa chọn triển
khai). Dispose giải phóng node và đóng cả context binaural/chuông. Resume lỗi
không ảnh hưởng timer; context chuông được mở từ thao tác người dùng và giữ
im lặng phục vụ mốc tự động. Kiểm chứng unit lifecycle và offline waveform thật.

## Tạm dừng khi đóng app — yêu cầu mới nhất

Quit hoặc unload phải tạm dừng timer trước khi lưu và dọn audio. Dùng workspace
quit Tasks để chờ Promise lưu cuối và dispose. Chuyển tab khi app vẫn mở không
tạm dừng. Mọi persist ghi paused checkpoint nhưng không thay đổi timer đang
chạy trong bộ nhớ. Khôi phục snapshot running cũ rebases theo remainingMs rồi
pause, tránh tính thời gian đóng app và không tự phát chuông. Mở lại cần Tiếp tục.
Đóng cưỡng bức không bảo đảm hook quit chạy: dùng checkpoint thành công cuối.

Off của công tắc binaural phải stop nguồn thật sau fade 0,2 giây, disconnect
và close context riêng. Không chỉ đưa gain về 0. Context chuông không bị ảnh
hưởng; bật lại tạo nguồn mới. Đã kiểm tra fake audio lifecycle và native offline
Web Audio: hai kênh im lặng sau fade, onended hoàn tất, voice/context được gỡ.
