# Pomodoro cho Obsidian

Đồng hồ học tập cục bộ, có dashboard và khối nhúng trong note. Giao diện bám theo
mockup v13: vỏ xanh lục, nút xanh da trời, số điện tử đen và nét ẩn rất nhạt.
Tự theo theme sáng/tối của Obsidian, không có nút đổi theme riêng.
Dashboard mở rộng theo chiều ngang: đồng hồ và nút điều khiển ở bên trái,
thời gian học ở trên thời gian nghỉ trong cột bên phải. Khi vùng nhúng hẹp
(không quá 520px), cột thời gian mới chuyển xuống dưới; hai trường vẫn xếp dọc.
Trong pane hoặc note Obsidian rộng khoảng 600–700px, setup vẫn nằm bên phải.
Tương tự Eisenhower, note chứa block `pomodoro` có `--file-line-width:1100px`
trong Reading view và Live Preview. Dashboard dùng tối đa 1040px và tự thu theo
chiều rộng pane khi mở sidebar; note không chứa Pomodoro giữ nguyên chiều rộng.

Khi cập nhật từ bản cũ, thay cả `main.js` và `styles.css`, rồi tắt/bật lại plugin
để Obsidian nạp lại cấu trúc và CSS; chỉ cập nhật một file có thể giữ bố cục cũ.

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
- **Chuyển phiên** bỏ qua phần còn lại và bắt đầu ngay phiên tiếp theo (học ↔ nghỉ),
  dùng được khi đang chạy hoặc tạm dừng. Không dùng khi sẵn sàng. Command palette
  có lệnh chuyển phiên, bắt đầu/tạm dừng và đặt lại; có thể gán hotkey trong Obsidian.

Mọi tab và block dùng chung một đồng hồ, không tạo phiên riêng. Tab nơi bạn bấm
**Bắt đầu / Tiếp tục** giữ phiên hiện tại. Chuyển sang tab khác vẫn chạy ngầm;
đóng tab giữ phiên sẽ tự tạm dừng và lưu thời gian còn lại. Mở lại cần bấm **Tiếp tục**.
Đóng một tab khác không ảnh hưởng phiên. Việc renderer trong note bị gỡ khi cuộn
hoặc chuyển chế độ xem không được xem là đóng tab.
Thời gian đếm dựa trên deadline, nên không cộng sai vì callback bị
trễ khi chạy nền. Nếu máy ngủ qua cả học và nghỉ, đồng hồ trở về sẵn sàng khi mở lại.

Cài đặt và trạng thái được lưu bằng Obsidian `data.json` trong thư mục plugin khi
thao tác hoặc chuyển pha, không ghi mỗi giây. Đóng Obsidian hoặc tắt plugin sẽ tạm dừng
và lưu thời gian còn lại. Mở lại phải bấm **Tiếp tục**, thời gian đóng app không
được tính vào phiên. Chuyển tab khi app còn mở vẫn chạy ngầm bình thường.
Khi lỗi lưu, đồng hồ tiếp tục trong bộ nhớ và hiện nút **Thử lưu lại**; chưa lưu được
thì khởi động lại có thể khôi phục snapshot cũ. Thay đổi đồng hồ hệ thống trong khi
chạy có thể làm thời gian còn lại thay đổi theo.

Không sửa note, task của Eisenhower hoặc dữ liệu Calendar. Thông báo kết thúc dùng Notice
của Obsidian khi ứng dụng hoạt động, không phải báo thức hệ điều hành khi app đã đóng.

## Âm binaural 40 Hz

Bấm **Bắt đầu / Tiếp tục** trong phiên học để phát hai sóng sin liên tục:
kênh trái **134 Hz**, kênh phải **174 Hz**, chênh lệch **40 Hz**. Cần tai nghe
stereo và tắt **Mono audio** để hai tai nhận hai tín hiệu riêng.

Công tắc **Binaural beats** nằm ngay trên Thời gian học, mặc định bật. Tắt khi
học bằng video để ngừng riêng âm binaural; timer và chuông chuyển phiên vẫn
hoạt động. Bật lại trong phiên học đang chạy sẽ phát binaural; bật khi nghỉ,
tạm dừng hoặc sẵn sàng chỉ lưu tùy chọn cho lần học tiếp theo. Các view đồng bộ
công tắc và nhớ lựa chọn sau khi khởi động lại.

Gain mặc định binaural **0,20**, chuông **0,25**. Dashboard không còn hai phần
setup âm phía dưới, thanh chỉnh gain hoặc nút nghe thử. Khi cập nhật từ cấu
hình âm cũ, plugin dùng hai mức mặc định mới và bật lại chuông chuyển phiên.
Gain chỉ là biên độ tín hiệu, không phải âm lượng thực tế tại tai.

Âm tăng dần từ 0 trong 0,3 giây khi bắt đầu, giảm về 0 trong 0,2 giây khi dừng.
Chỉ phát trong phiên tập trung; Pause, Đặt lại, đóng tab giữ phiên hoặc unload
plugin đều dừng âm và giải phóng tài nguyên. Lịch giảm âm và dừng tại cuối phiên
học được đặt trên audio clock, để callback giao diện bị trễ không kéo âm sang
phiên nghỉ. Binaural luôn tắt trong phiên nghỉ và lúc sẵn sàng.

AudioContext được tạo/resume từ thao tác Bắt đầu/Tiếp tục hoặc hotkey tương ứng.
Mở lại plugin luôn giữ phiên ở trạng thái **tạm dừng**, không tự phát âm; bấm
**Tiếp tục** để chạy lại timer và âm binaural nếu công tắc đang bật. Nếu trình duyệt không cho phát, timer vẫn chạy
và hiện hướng dẫn thử lại. Chuyển tab vẫn giữ âm trong phiên học.

Không có MP3, âm nền, harmonics bổ sung, điều biến biên độ hoặc buffer âm trong
plugin. Hai OscillatorNode nối vào ChannelMergerNode(2), qua GainNode đến đầu ra;
khởi động cùng `AudioContext.currentTime`. Không dùng interval để tạo sóng.
Thao tác nhanh chờ bộ oscillator cũ kết thúc trước khi tạo bộ mới.
Khi chuyển phiên, binaural giảm về 0 trong 0,5 giây trước
chuông; chỉ bật lại sau chuông nếu phiên hiện tại là học và đang chạy.
Tham chiếu API: [Web Audio — ChannelMergerNode](https://www.w3.org/TR/webaudio/#ChannelMergerNode).

## Chuông chuyển phiên

Chuông chuyển phiên hoạt động độc lập với công tắc Binaural beats, gain mặc định
**0,25**. Tắt binaural không tắt chuông, kể cả khi chuyển sang học rồi kết thúc
chuỗi chuông. Không có phần điều chỉnh chuông trong dashboard.

Chuông phát một chuỗi cho mỗi lần chuyển phiên thực sự, từ deadline hoặc
**Chuyển phiên**. Start lần đầu, Pause/Resume, Stop và Reset không tạo chuông.
Hết nghỉ tự động vẫn trở về học/sẵn sàng như trước: chuông reo, binaural giữ tắt
cho tới khi bạn bắt đầu học. Plugin hiện có học/nghỉ, chưa có nghỉ dài.
Khi máy ngủ qua nhiều mốc, timer xử lý từng chuyển đổi; chuỗi cũ bị thay bằng
chuỗi mới nhất, không phát dồn các thông báo đã lỡ.

Mỗi chuỗi gồm ba tiếng tại 0 / 0,6 / 1,2 giây, mỗi tiếng ngân 1,5 giây.
Mỗi tiếng dùng ba OscillatorNode sine và GainNode riêng:

| Tần số | Biên độ tương đối | Hằng số tắt dần |
| --- | --- | --- |
| 880 Hz | 0,60 | 0,30 giây |
| 1760 Hz | 0,25 | 0,20 giây |
| 2464 Hz | 0,10 | 0,12 giây |

Envelope tăng từ 0 trong 0,008 giây, tắt dần bằng `setTargetAtTime`; tại 1,4 giây
chốt đúng biên độ hàm mũ rồi ramp về 0 tại 1,5 giây. Oscillator dừng ở 1,51 giây,
gỡ kết nối khi kết thúc. Các nhánh đi qua GainNode âm lượng chung đến đầu ra.
Toàn bộ lịch chuông dùng `AudioContext.currentTime`, không dùng timeout/interval
hoặc file âm thanh. Chuỗi kết thúc sau khoảng 2,71 giây kể từ tiếng đầu tiên.

Bộ đếm phiên mới bắt đầu ngay, không chờ fade hoặc chuông. Nếu đang có binaural,
âm này giảm về 0 trong 0,5 giây trước chuông; sau chuông chỉ phát lại khi vẫn ở
phiên học/đang chạy. Chuyển tiếp trong lúc reo sẽ fade chuỗi cũ 0,04 giây rồi
phát chuỗi mới. Pause/Stop/Reset, đóng tab giữ phiên và unload hủy các lệnh bật
âm còn chờ; unload dừng mọi node và đóng mọi AudioContext plugin sở hữu.

Đóng tab sở hữu cũng dừng chuông cuối phiên khi timer đã
sẵn sàng. Tắt Binaural beats trong lúc chuông reo giữ binaural tắt sau chuông;
Reset/unload trong lúc chờ vẫn hủy việc bật lại âm.

Tắt **Binaural beats** giảm âm trong 0,2 giây để tránh tiếng tách, sau đó gọi
stop cho cả hai oscillator, disconnect các node và đóng AudioContext binaural.
Không giữ oscillator chạy với gain bằng 0. Context chuông độc lập nên vẫn reo
khi chuyển phiên. Bật lại tạo bộ oscillator/context mới.

Context chuông được tạo/resume từ Bắt đầu, Tiếp tục hoặc Chuyển phiên, và giữ mở yên lặng để phục vụ chuyển tự động; đóng khi unload.
Lỗi autoplay hoặc Web Audio được báo trong dashboard, không dừng timer.
Phiên khôi phục đang tạm dừng; bấm **Tiếp tục** để cho phép âm thanh. Tham chiếu envelope:
[Web Audio — setTargetAtTime](https://www.w3.org/TR/webaudio/#dom-audioparam-settargetattime).

## Kiểm chứng

Chạy trong thư mục `pomodoro`:

```bash
node --test tests/main.test.cjs
node tests/main.test.cjs
node --check main.js
```

Lệnh thứ hai hiển thị chi tiết từng test khi môi trường chỉ báo kết quả theo file.
Tests bao phủ deadline, pause/resume, ngủ qua hai pha, restore, validation, hai view
đồng bộ, load/save lỗi, queue ghi, command, embed và unload. Kiểm tra âm bao phủ
định tuyến hai kênh, tần số, mốc start chung, fade, gain, deadline, thao tác liên
tiếp, resume đang chờ, lỗi khởi tạo và giải phóng tài nguyên. Chuông được kiểm tra
đúng tần số/envelope/lịch, thay chuỗi đang reo, hủy lệnh phát muộn, lưu
công tắc binaural, nâng cấp cấu hình âm cũ và luồng chuyển tự động/Next không làm trễ timer.

Mở `tests/preview.html` bằng trình duyệt để chạy smoke checks trên renderer và CSS
thật, cùng phép đo tín hiệu hai kênh bằng OfflineAudioContext của trình duyệt
(buffer 2 giây cho binaural và 3 giây cho chuông chỉ dùng trong kiểm thử, không nằm trong plugin). Host kiểm thử
không phát ra loa. Thêm `#dark`, `#dark-running`, `#dark-paused`, `#dark-error`, hoặc `#dark-long`
để xem trạng thái. Đây chỉ là host kiểm thử, không phải bản web của plugin.

Đã kiểm chứng bằng host Obsidian giả lập và Firefox; chưa kiểm thử trực tiếp trong
ứng dụng Obsidian trên desktop/mobile. Không tuyên bố đã được Obsidian duyệt phát hành.

Báo cáo rà soát và các regression tests: [systematic-debugging](docs/systematic-debugging-2026-10-26.md).

Khi app thoát bình thường, hook `workspace.quit` đăng ký task chờ lưu trạng thái
và dọn audio; unload là đường dự phòng. Mọi lần lưu khi đang học cũng ghi một
checkpoint paused để đóng cưỡng bức không làm timer tự chạy khi mở lại. Nếu hệ
điều hành kết thúc app đột ngột, khôi phục từ checkpoint lưu thành công gần nhất;
phần thời gian sau checkpoint có thể chưa được ghi. Hook thoát là best effort
trong [API Obsidian](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).
